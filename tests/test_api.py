from __future__ import annotations

from uuid import uuid4

from fastapi.testclient import TestClient

from purchase_orchestrator.executor import ExecutionReceipt, PurchaseExecutor
from purchase_orchestrator.main import app, get_service
from purchase_orchestrator.models import PurchaseStatus
from purchase_orchestrator.repository import Repository
from purchase_orchestrator.service import PurchaseService


def client(tmp_path) -> TestClient:
    app.dependency_overrides[get_service] = lambda: PurchaseService(Repository(str(tmp_path / "test.db")))
    return TestClient(app)


def policy_payload() -> dict:
    return {
        "currency": "USD",
        "max_auto_purchase_amount": "10.00",
        "approval_mode": "AUTO_UNDER_LIMIT",
        "allowed_merchants": ["example.com"],
        "allow_subscriptions": False,
    }


def request_payload(user_id: str) -> dict:
    return {
        "client_request_id": str(uuid4()),
        "user_id": user_id,
        "conversation_id": str(uuid4()),
        "delivery_address_id": str(uuid4()),
        "checkout": {
            "delivery_address": {
                "recipient_name": "Jan Testowy",
                "email": "jan.testowy@example.com",
                "phone": "+48111222333",
                "address_line1": "Testowa 1",
                "postal_code": "00-001",
                "city": "Warszawa",
                "country_code": "PL",
            },
            "product_configuration": {
                "options": {},
                "personalization": {},
                "upload_asset_ids": [],
            },
            "preferred_shipping_method": "courier",
            "preferred_payment_method": "Przelewy24",
            "accept_terms": False,
        },
        "offer": {
            "merchant": "example.com",
            "product_url": "https://example.com/products/keyboard",
            "merchant_product_id": "keyboard-1",
            "title": "Keyboard",
            "quantity": 1,
            "item_amount": "8.00",
            "shipping_amount": "1.00",
            "tax_amount": "1.00",
            "total_amount": "10.00",
            "maximum_total_amount": "10.00",
            "currency": "USD",
            "is_subscription": False,
        },
    }


def test_auto_approval_under_limit_runs_dummy_purchase(tmp_path) -> None:
    test_client = client(tmp_path)
    user_id = str(uuid4())
    assert test_client.put(f"/v1/users/{user_id}/purchase-policy", json=policy_payload()).status_code == 204

    response = test_client.post("/v1/purchase-requests", json=request_payload(user_id))

    assert response.status_code == 202
    assert response.json()["status"] == "PURCHASED"


def test_request_above_limit_requires_customer_approval(tmp_path) -> None:
    test_client = client(tmp_path)
    user_id = str(uuid4())
    assert test_client.put(f"/v1/users/{user_id}/purchase-policy", json=policy_payload()).status_code == 204
    request = request_payload(user_id)
    request["offer"]["item_amount"] = "10.00"
    request["offer"]["total_amount"] = "12.00"
    request["offer"]["maximum_total_amount"] = "12.00"

    response = test_client.post("/v1/purchase-requests", json=request)

    assert response.status_code == 202
    assert response.json()["status"] == "AWAITING_APPROVAL"
    assert response.json()["approval_id"]


def test_disallowed_merchant_is_rejected(tmp_path) -> None:
    test_client = client(tmp_path)
    user_id = str(uuid4())
    assert test_client.put(f"/v1/users/{user_id}/purchase-policy", json=policy_payload()).status_code == 204
    request = request_payload(user_id)
    request["offer"]["merchant"] = "not-allowed.example"

    response = test_client.post("/v1/purchase-requests", json=request)

    assert response.status_code == 202
    assert response.json()["status"] == "REJECTED"


def test_customer_approval_runs_dummy_purchase(tmp_path) -> None:
    test_client = client(tmp_path)
    user_id = str(uuid4())
    assert test_client.put(
        f"/v1/users/{user_id}/purchase-policy",
        json={**policy_payload(), "approval_mode": "ALWAYS"},
    ).status_code == 204

    request_response = test_client.post("/v1/purchase-requests", json=request_payload(user_id))
    approval_id = request_response.json()["approval_id"]
    events = test_client.get("/internal/outbox/events").json()
    token = next(event["payload"]["approvalToken"] for event in events if event["event_type"] == "purchase.approval_requested")

    response = test_client.post(
        f"/v1/purchase-approvals/{approval_id}/approve",
        json={"approval_token": token},
    )

    assert response.status_code == 202
    assert response.json()["status"] == "PURCHASED"


def test_adapter_can_require_user_action_without_marking_purchase_paid(tmp_path) -> None:
    class CheckoutOnlyAdapter:
        def execute(self, purchase):
            return ExecutionReceipt(
                adapter="browser",
                external_reference="https://example.com/checkout",
                status=PurchaseStatus.USER_ACTION_REQUIRED,
            )

    service = PurchaseService(Repository(str(tmp_path / "checkout.db")), PurchaseExecutor(CheckoutOnlyAdapter()))
    app.dependency_overrides[get_service] = lambda: service
    test_client = TestClient(app)
    user_id = str(uuid4())
    assert test_client.put(
        f"/v1/users/{user_id}/purchase-policy",
        json={**policy_payload(), "approval_mode": "ALWAYS"},
    ).status_code == 204
    request_response = test_client.post("/v1/purchase-requests", json=request_payload(user_id))
    approval_id = request_response.json()["approval_id"]
    events = test_client.get("/internal/outbox/events").json()
    token = next(event["payload"]["approvalToken"] for event in events if event["event_type"] == "purchase.approval_requested")

    response = test_client.post(
        f"/v1/purchase-approvals/{approval_id}/approve",
        json={"approval_token": token},
    )

    assert response.status_code == 202
    assert response.json()["status"] == "USER_ACTION_REQUIRED"


def test_basic_advisor_approval_and_fake_purchase_flow(tmp_path) -> None:
    """Advisor proposal -> boundary check -> approval endpoint -> fake purchase."""
    test_client = client(tmp_path)
    user_id = str(uuid4())
    policy = {
        **policy_payload(),
        "currency": "PLN",
        "approval_mode": "ALWAYS",
        "allowed_merchants": ["cs-studio.pl"],
    }
    assert test_client.put(f"/v1/users/{user_id}/purchase-policy", json=policy).status_code == 204

    proposal = request_payload(user_id)
    proposal["offer"].update(
        {
            "merchant": "cs-studio.pl",
            "product_url": "https://cs-studio.pl/products/test-product",
            "merchant_product_id": "test-product",
            "title": "Test product",
            "item_amount": "149.00",
            "shipping_amount": "15.00",
            "tax_amount": "0.00",
            "total_amount": "164.00",
            "maximum_total_amount": "170.00",
            "currency": "PLN",
        }
    )

    submitted = test_client.post("/v1/purchase-requests", json=proposal)
    assert submitted.status_code == 202
    assert submitted.json()["status"] == "AWAITING_APPROVAL"
    approval_id = submitted.json()["approval_id"]

    events = test_client.get("/internal/outbox/events").json()
    approval_event = next(event for event in events if event["event_type"] == "purchase.approval_requested")
    assert approval_event["payload"]["conversationId"] == proposal["conversation_id"]

    approved = test_client.post(
        f"/v1/purchase-approvals/{approval_id}/approve",
        json={"approval_token": approval_event["payload"]["approvalToken"]},
    )
    assert approved.status_code == 202
    assert approved.json()["status"] == "PURCHASED"


def test_advisor_proposal_exceeding_maximum_price_is_rejected(tmp_path) -> None:
    test_client = client(tmp_path)
    user_id = str(uuid4())
    assert test_client.put(
        f"/v1/users/{user_id}/purchase-policy",
        json={**policy_payload(), "approval_mode": "ALWAYS"},
    ).status_code == 204
    proposal = request_payload(user_id)
    proposal["offer"]["maximum_total_amount"] = "9.99"

    response = test_client.post("/v1/purchase-requests", json=proposal)

    assert response.status_code == 202
    assert response.json()["status"] == "REJECTED"
    purchase = test_client.get(f"/v1/purchases/{response.json()['purchase_id']}").json()
    assert purchase["rejection_reason"] == "Current total exceeds the maximum total accepted by Shopping Advisor"


def test_customer_can_cancel_advisor_proposal(tmp_path) -> None:
    test_client = client(tmp_path)
    user_id = str(uuid4())
    assert test_client.put(
        f"/v1/users/{user_id}/purchase-policy",
        json={**policy_payload(), "approval_mode": "ALWAYS"},
    ).status_code == 204
    submitted = test_client.post("/v1/purchase-requests", json=request_payload(user_id))
    approval_id = submitted.json()["approval_id"]
    events = test_client.get("/internal/outbox/events").json()
    token = next(event["payload"]["approvalToken"] for event in events if event["event_type"] == "purchase.approval_requested")

    rejected = test_client.post(
        f"/v1/purchase-approvals/{approval_id}/reject",
        json={"approval_token": token},
    )

    assert rejected.status_code == 202
    assert rejected.json()["status"] == "REJECTED"
