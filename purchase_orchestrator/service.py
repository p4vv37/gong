from __future__ import annotations

import hashlib
import secrets
from datetime import UTC, datetime, timedelta
from uuid import UUID

from fastapi import HTTPException, status

from .executor import DummyPurchaseAdapter, PurchaseExecutor
from .models import ApprovalDecision, ApprovalMode, ApprovalStatus, PurchasePolicyInput, PurchaseRequest, PurchaseResponse, PurchaseStatus
from .repository import Repository


class PurchaseService:
    def __init__(self, repository: Repository, executor: PurchaseExecutor | None = None) -> None:
        self.repository = repository
        self.executor = executor or PurchaseExecutor(DummyPurchaseAdapter())

    def set_policy(self, user_id: UUID, policy: PurchasePolicyInput) -> None:
        self.repository.save_policy(user_id, policy)

    def submit(self, request: PurchaseRequest) -> PurchaseResponse:
        existing = self.repository.get_purchase_by_client_request_id(request.client_request_id)
        if existing is not None:
            return existing

        policy = self.repository.get_policy(request.user_id)
        if policy is None:
            raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail="Purchase policy is not configured")

        rejection_reason = self._rejection_reason(policy, request)
        if rejection_reason:
            result = self.repository.create_purchase(
                client_request_id=request.client_request_id, user_id=request.user_id, conversation_id=request.conversation_id,
                offer_payload=request.model_dump_json(), status=PurchaseStatus.REJECTED, rejection_reason=rejection_reason,
            )
            self._event("purchase.rejected", result.purchase_id, {"conversationId": str(request.conversation_id), "reason": rejection_reason})
            return result

        if policy.approval_mode is ApprovalMode.OFFER_ONLY:
            result = self.repository.create_purchase(
                client_request_id=request.client_request_id, user_id=request.user_id, conversation_id=request.conversation_id,
                offer_payload=request.model_dump_json(), status=PurchaseStatus.LINK_READY,
            )
            self._event("purchase.product_link_ready", result.purchase_id, {"conversationId": str(request.conversation_id), "productUrl": str(request.offer.product_url)})
            return result

        if policy.approval_mode is ApprovalMode.AUTO_UNDER_LIMIT and request.offer.total_amount <= policy.max_auto_purchase_amount:
            result = self.repository.create_purchase(
                client_request_id=request.client_request_id, user_id=request.user_id, conversation_id=request.conversation_id,
                offer_payload=request.model_dump_json(), status=PurchaseStatus.EXECUTION_QUEUED,
            )
            self._event("purchase.execution_queued", result.purchase_id, {"conversationId": str(request.conversation_id)})
            return self._execute(result.purchase_id)

        result = self.repository.create_purchase(
            client_request_id=request.client_request_id, user_id=request.user_id, conversation_id=request.conversation_id,
            offer_payload=request.model_dump_json(), status=PurchaseStatus.AWAITING_APPROVAL,
        )
        raw_token = secrets.token_urlsafe(32)
        approval_id = self.repository.create_approval(result.purchase_id, self._token_hash(raw_token), datetime.now(UTC) + timedelta(hours=24))
        self._event(
            "purchase.approval_requested", result.purchase_id,
            {"conversationId": str(request.conversation_id), "approvalId": str(approval_id), "approvalToken": raw_token},
        )
        return result.model_copy(update={"approval_id": approval_id})

    def approve(self, approval_id: UUID, decision: ApprovalDecision) -> PurchaseResponse:
        approval = self._valid_pending_approval(approval_id, decision.approval_token)
        purchase_id = UUID(approval["purchase_id"])
        self.repository.set_approval_status(approval_id, ApprovalStatus.APPROVED)
        self.repository.set_purchase_status(purchase_id, PurchaseStatus.EXECUTION_QUEUED)
        purchase = self.repository.get_purchase(purchase_id)
        assert purchase is not None
        self._event("purchase.execution_queued", purchase_id, {"conversationId": str(purchase.conversation_id)})
        result = self._execute(purchase_id)
        return result.model_copy(update={"approval_id": approval_id})

    def reject(self, approval_id: UUID, decision: ApprovalDecision) -> PurchaseResponse:
        approval = self._valid_pending_approval(approval_id, decision.approval_token)
        purchase_id = UUID(approval["purchase_id"])
        self.repository.set_approval_status(approval_id, ApprovalStatus.REJECTED)
        self.repository.set_purchase_status(purchase_id, PurchaseStatus.REJECTED, "Rejected by customer")
        purchase = self.repository.get_purchase(purchase_id)
        assert purchase is not None
        self._event("purchase.rejected", purchase_id, {"conversationId": str(purchase.conversation_id), "reason": "Rejected by customer"})
        return PurchaseResponse(purchase_id=purchase_id, status=PurchaseStatus.REJECTED, approval_id=approval_id, created_at=purchase.created_at)

    @staticmethod
    def _rejection_reason(policy: PurchasePolicyInput, request: PurchaseRequest) -> str | None:
        if request.offer.total_amount > request.offer.maximum_total_amount:
            return "Current total exceeds the maximum total accepted by Shopping Advisor"
        if policy.currency != request.offer.currency:
            return "Offer currency does not match the purchase policy"
        if policy.allowed_merchants and request.offer.merchant not in policy.allowed_merchants:
            return "Merchant is not allowed by the purchase policy"
        if request.offer.is_subscription and not policy.allow_subscriptions:
            return "Subscriptions are not allowed by the purchase policy"
        return None

    def _valid_pending_approval(self, approval_id: UUID, raw_token: str):
        approval = self.repository.get_approval(approval_id)
        if approval is None:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Approval not found")
        if approval["status"] != ApprovalStatus.PENDING.value:
            raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="Approval is no longer pending")
        if datetime.fromisoformat(approval["expires_at"]) <= datetime.now(UTC):
            self.repository.set_approval_status(approval_id, ApprovalStatus.EXPIRED)
            raise HTTPException(status_code=status.HTTP_410_GONE, detail="Approval has expired")
        if not secrets.compare_digest(approval["token_hash"], self._token_hash(raw_token)):
            raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Approval token is invalid")
        return approval

    def _event(self, event_type: str, purchase_id: UUID, payload: dict) -> None:
        self.repository.add_event(event_type, purchase_id, payload)

    def _execute(self, purchase_id: UUID) -> PurchaseResponse:
        purchase = self.repository.get_purchase(purchase_id)
        assert purchase is not None
        self.repository.set_purchase_status(purchase_id, PurchaseStatus.EXECUTING)
        self._event("purchase.executing", purchase_id, {"conversationId": str(purchase.conversation_id)})

        try:
            receipt = self.executor.execute(purchase)
        except Exception:
            self.repository.set_purchase_status(purchase_id, PurchaseStatus.FAILED)
            self._event("purchase.failed", purchase_id, {"conversationId": str(purchase.conversation_id)})
            raise

        event_type = "purchase.completed" if receipt.status is PurchaseStatus.PURCHASED else "purchase.user_action_required"
        self.repository.set_purchase_status(purchase_id, receipt.status)
        self._event(
            event_type,
            purchase_id,
            {
                "conversationId": str(purchase.conversation_id),
                "adapter": receipt.adapter,
                "externalReference": receipt.external_reference,
            },
        )
        return PurchaseResponse(purchase_id=purchase_id, status=receipt.status, created_at=purchase.created_at)

    @staticmethod
    def _token_hash(value: str) -> str:
        return hashlib.sha256(value.encode("utf-8")).hexdigest()
