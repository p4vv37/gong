from __future__ import annotations

from decimal import Decimal
from pathlib import Path
import sys
from uuid import uuid4

from purchase_orchestrator.ai_browser import AiAssistedBrowserAdapter, BrowserConfig
from purchase_orchestrator.executor import PurchaseExecutor
from purchase_orchestrator.models import (
    ApprovalDecision,
    ApprovalMode,
    CheckoutInstructions,
    DeliveryAddress,
    Offer,
    ProductConfiguration,
    PurchasePolicyInput,
    PurchaseRequest,
)
from purchase_orchestrator.repository import Repository
from purchase_orchestrator.service import PurchaseService


PRODUCT_URL = "https://www.abud.pl/product-pol-4881-Ziemia-uniwersalna-do-kwiatow-i-warzyw-20L-Planta.html"


def main() -> None:
    if hasattr(sys.stdout, "reconfigure"):
        sys.stdout.reconfigure(encoding="utf-8", errors="replace")
    user_id = uuid4()
    database_path = Path("data") / f"abud-demo-{uuid4().hex}.db"
    adapter = AiAssistedBrowserAdapter(
        BrowserConfig(
            headless=False,
            max_steps=24,
            browser_channel="chrome",
            page_settle_timeout_ms=8_000,
        )
    )
    service = PurchaseService(Repository(str(database_path)), PurchaseExecutor(adapter))
    service.set_policy(
        user_id,
        PurchasePolicyInput(
            currency="PLN",
            max_auto_purchase_amount=Decimal("0.00"),
            approval_mode=ApprovalMode.ALWAYS,
            allowed_merchants=["abud.pl"],
            allow_subscriptions=False,
        ),
    )
    request = PurchaseRequest(
        client_request_id=uuid4(),
        user_id=user_id,
        conversation_id=uuid4(),
        delivery_address_id=uuid4(),
        offer=Offer(
            merchant="abud.pl",
            product_url=PRODUCT_URL,
            merchant_product_id="4881",
            title="Ziemia uniwersalna do kwiatów i warzyw 20L Planta",
            variant=None,
            quantity=1,
            item_amount=Decimal("8.60"),
            shipping_amount=Decimal("0.00"),
            tax_amount=Decimal("0.00"),
            total_amount=Decimal("8.60"),
            maximum_total_amount=Decimal("50.00"),
            currency="PLN",
            is_subscription=False,
        ),
        checkout=CheckoutInstructions(
            delivery_address=DeliveryAddress(
                recipient_name="Jan Testowy",
                email="jan.testowy@example.com",
                phone="+48111222333",
                address_line1="Testowa 1",
                postal_code="00-001",
                city="Warszawa",
                country_code="PL",
            ),
            product_configuration=ProductConfiguration(),
            preferred_shipping_method="najtańsza dostawa kurierska",
            preferred_payment_method="płatność przy odbiorze",
            customer_note="DEMO AUTOMATYZACJI — NIE REALIZOWAĆ",
            accept_terms=True,
        ),
    )

    print("[demo] 1. Advisor przekazuje snapshot produktu abud.pl")
    submitted = service.submit(request)
    print(f"[demo] 2. Orchestrator oczekuje na zgodę: {submitted.status}")
    approval_event = next(
        event for event in service.repository.list_events()
        if event.event_type == "purchase.approval_requested"
    )
    print("[demo] 3. Użytkownik zatwierdza próbę; uruchamiam widoczny Chrome")
    result = service.approve(
        submitted.approval_id,
        ApprovalDecision(approval_token=approval_event.payload["approvalToken"]),
    )
    print(f"[demo] 4. Wynik: {result.status}")
    print(f"[demo] Baza przebiegu: {database_path}")


if __name__ == "__main__":
    main()
