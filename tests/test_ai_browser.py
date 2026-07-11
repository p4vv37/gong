from __future__ import annotations

import json

import pytest
from pydantic import ValidationError

from purchase_orchestrator.ai_browser import AiAssistedBrowserAdapter, BrowserAction, BrowserAssetResolver, BrowserRunError
from purchase_orchestrator.models import PurchaseDetails, PurchaseStatus


def purchase_details() -> PurchaseDetails:
    with open("examples/cs-studio-purchase-request.mock.json", encoding="utf-8") as source:
        payload = json.load(source)
    return PurchaseDetails.model_validate(
        {
            "purchase_id": "20000000-0000-4000-8000-000000000001",
            "status": PurchaseStatus.EXECUTING,
            "created_at": "2026-07-11T10:00:00Z",
            "user_id": payload["user_id"],
            "conversation_id": payload["conversation_id"],
            "offer": payload["offer"],
            "checkout": payload["checkout"],
        }
    )


def test_only_advisor_values_are_available_for_form_fill() -> None:
    values = AiAssistedBrowserAdapter._approved_values(purchase_details())

    assert values["delivery.city"] == "Warszawa"
    assert values["delivery.first_name"] == "Jan"
    assert values["delivery.last_name"] == "Testowy"
    assert values["personalization.dedykacja"] == "Mock testowy — nie realizować"
    assert "payment.card_number" not in values


def test_fill_action_requires_an_approved_source_key_reference() -> None:
    with pytest.raises(ValidationError):
        BrowserAction(
            current_state="DELIVERY",
            action="fill",
            candidate_id="candidate-1",
            expected_outcome="Email field contains the approved address",
            reason="Fill email",
        )


def test_planner_action_declares_state_and_verifiable_outcome() -> None:
    action = BrowserAction(
        current_state="CONFIGURE_PRODUCT",
        action="check",
        candidate_id="candidate-2",
        source_key="option.rodzaj",
        expected_outcome="Płótno radio is checked",
        reason="Select the Advisor-approved product type",
    )

    assert action.current_state == "CONFIGURE_PRODUCT"
    assert action.expected_outcome == "Płótno radio is checked"


def test_asset_resolver_uses_only_worker_allowlist(tmp_path) -> None:
    image = tmp_path / "portrait.png"
    image.write_bytes(b"mock image payload")
    resolver = BrowserAssetResolver({"asset-1": str(image)})

    assert resolver.resolve("asset-1") == str(image.resolve())
    with pytest.raises(BrowserRunError):
        resolver.resolve("C:/arbitrary/file.png")


@pytest.mark.parametrize(
    "text",
    ["Złóż zamówienie", "Zapłać teraz", "Place order", "Complete order"],
)
def test_irreversible_controls_are_blocked(text: str) -> None:
    assert AiAssistedBrowserAdapter._is_irreversible(
        {"text": text, "name": "", "type": "button", "placeholder": "", "labels": []}
    )


@pytest.mark.parametrize(
    "candidate",
    [
        {"text": "Dodaj do koszyka", "name": "", "labels": []},
        {"text": "", "name": "add", "labels": []},
        {"text": "Add to cart", "name": "", "labels": []},
    ],
)
def test_add_to_cart_controls_are_recognized_for_quantity_guard(candidate: dict) -> None:
    assert AiAssistedBrowserAdapter._is_add_to_cart_candidate(candidate)
