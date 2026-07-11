from __future__ import annotations

from uuid import uuid4

from fastapi.testclient import TestClient

from purchase_orchestrator.main import app, get_service
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
