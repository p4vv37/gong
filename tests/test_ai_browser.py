from __future__ import annotations

import json

import pytest
from pydantic import ValidationError

from purchase_orchestrator.ai_browser import (
    AiAssistedBrowserAdapter,
    BrowserAction,
    BrowserAssetResolver,
    BrowserRunError,
    CheckoutSnapshot,
)
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


@pytest.mark.parametrize(
    ("label", "priority"),
    [
        ("Potwierdzam wymagane", 0),
        ("  Tylko niezbędne  ", 0),
        ("Reject all", 0),
        ("Potwierdzam wszystkie", 1),
    ],
)
def test_cookie_consent_choices_are_ranked_privacy_first(label: str, priority: int) -> None:
    assert AiAssistedBrowserAdapter._cookie_consent_priority(label) == priority


@pytest.mark.parametrize(
    "label",
    [
        "Analityczne pliki cookie",
        "Reklamowe pliki cookie",
        "Polityka prywatności",
        "Ustawienia cookies",
    ],
)
def test_cookie_preference_controls_are_not_treated_as_confirmation(label: str) -> None:
    assert AiAssistedBrowserAdapter._cookie_consent_priority(label) is None


def checkout_snapshot(purchase: PurchaseDetails, **changes) -> CheckoutSnapshot:
    values = {
        "product_title": purchase.offer.title,
        "variant": purchase.offer.variant,
        "quantity": purchase.offer.quantity,
        "item_amount": purchase.offer.item_amount,
        "shipping_amount": purchase.offer.shipping_amount,
        "tax_amount": purchase.offer.tax_amount,
        "total_amount": purchase.offer.total_amount,
        "currency": purchase.offer.currency,
        "product_evidence": purchase.offer.title,
        "quantity_evidence": f"Ilość: {purchase.offer.quantity}",
        "total_evidence": f"Razem {purchase.offer.total_amount} zł",
    }
    values.update(changes)
    return CheckoutSnapshot.model_validate(values)


def test_final_checkout_accepts_unchanged_advisor_offer() -> None:
    purchase = purchase_details()
    snapshot = checkout_snapshot(purchase)

    result = AiAssistedBrowserAdapter._validate_checkout_snapshot(snapshot, purchase)

    assert result.valid
    assert result.reasons == []


@pytest.mark.parametrize(
    ("change", "expected_reason"),
    [
        ({"quantity": 2, "total_amount": "298.00"}, "quantity changed"),
        ({"item_amount": "159.00", "total_amount": "159.00"}, "item price changed"),
        ({"shipping_amount": "15.00", "total_amount": "164.00"}, "shipping price changed"),
        ({"total_amount": "201.00", "tax_amount": "52.00"}, "exceeds maximum"),
    ],
)
def test_final_checkout_rejects_boundary_changes(change: dict, expected_reason: str) -> None:
    purchase = purchase_details()
    snapshot = checkout_snapshot(purchase, **change)

    result = AiAssistedBrowserAdapter._validate_checkout_snapshot(snapshot, purchase)

    assert not result.valid
    assert any(expected_reason in reason for reason in result.reasons)
