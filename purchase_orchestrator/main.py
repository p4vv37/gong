from __future__ import annotations

import os
from functools import lru_cache
from uuid import UUID

from fastapi import Depends, FastAPI, HTTPException, status

from .models import ApprovalDecision, OutboxEvent, PurchaseDetails, PurchasePolicyInput, PurchaseRequest, PurchaseResponse
from .executor import DummyPurchaseAdapter, PurchaseExecutor
from .repository import Repository
from .service import PurchaseService

app = FastAPI(title="Purchase Orchestrator", version="0.1.0")


@lru_cache
def get_service() -> PurchaseService:
    database_path = os.getenv("PURCHASE_ORCHESTRATOR_DB", "data/purchase-orchestrator.db")
    adapter_name = os.getenv("PURCHASE_ADAPTER", "dummy")
    if adapter_name == "ai_browser":
        from .ai_browser import AiAssistedBrowserAdapter

        executor = PurchaseExecutor(AiAssistedBrowserAdapter())
    else:
        executor = PurchaseExecutor(DummyPurchaseAdapter())
    return PurchaseService(Repository(database_path), executor)


@app.get("/health")
def health() -> dict[str, str]:
    return {"status": "ok"}


@app.put("/v1/users/{user_id}/purchase-policy", status_code=status.HTTP_204_NO_CONTENT)
def set_purchase_policy(user_id: UUID, policy: PurchasePolicyInput, service: PurchaseService = Depends(get_service)) -> None:
    service.set_policy(user_id, policy)


@app.post("/v1/purchase-requests", response_model=PurchaseResponse, status_code=status.HTTP_202_ACCEPTED)
def submit_purchase_request(request: PurchaseRequest, service: PurchaseService = Depends(get_service)) -> PurchaseResponse:
    return service.submit(request)


@app.get("/v1/purchases/{purchase_id}", response_model=PurchaseDetails)
def get_purchase(purchase_id: UUID, service: PurchaseService = Depends(get_service)) -> PurchaseDetails:
    purchase = service.repository.get_purchase(purchase_id)
    if purchase is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Purchase not found")
    return purchase


@app.post("/v1/purchase-approvals/{approval_id}/approve", response_model=PurchaseResponse, status_code=status.HTTP_202_ACCEPTED)
def approve_purchase(approval_id: UUID, decision: ApprovalDecision, service: PurchaseService = Depends(get_service)) -> PurchaseResponse:
    return service.approve(approval_id, decision)


@app.post("/v1/purchase-approvals/{approval_id}/reject", response_model=PurchaseResponse, status_code=status.HTTP_202_ACCEPTED)
def reject_purchase(approval_id: UUID, decision: ApprovalDecision, service: PurchaseService = Depends(get_service)) -> PurchaseResponse:
    return service.reject(approval_id, decision)


@app.get("/internal/outbox/events", response_model=list[OutboxEvent])
def list_outbox_events(service: PurchaseService = Depends(get_service)) -> list[OutboxEvent]:
    return service.repository.list_events()
