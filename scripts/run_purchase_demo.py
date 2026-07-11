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


PRODUCT_URL = "https://cs-studio.pl/products/1x-molten-glass-tank-on-wood-with-stand-large-bowl573"


def main() -> None:
    if hasattr(sys.stdout, "reconfigure"):
        sys.stdout.reconfigure(encoding="utf-8", errors="replace")
    user_id = uuid4()
    database_path = Path("data") / f"purchase-demo-{uuid4().hex}.db"
    adapter = AiAssistedBrowserAdapter(
        BrowserConfig(
            headless=False,
            max_steps=16,
            browser_channel="chrome",
            page_settle_timeout_ms=6_000,
        )
    )
    service = PurchaseService(Repository(str(database_path)), PurchaseExecutor(adapter))
    service.set_policy(
        user_id,
        PurchasePolicyInput(
            currency="PLN",
            max_auto_purchase_amount=Decimal("0.00"),
            approval_mode=ApprovalMode.ALWAYS,
            allowed_merchants=["cs-studio.pl"],
            allow_subscriptions=False,
        ),
    )

    request = PurchaseRequest(
        client_request_id=uuid4(),
        user_id=user_id,
        conversation_id=uuid4(),
        delivery_address_id=uuid4(),
        offer=Offer(
            merchant="cs-studio.pl",
            product_url=PRODUCT_URL,
            merchant_product_id="1x-molten-glass-tank-on-wood-with-stand-large-bowl573",
            title="Misa ze szkła roztopionego na drewnie Gamal z podstawką – duża",
            variant=None,
            quantity=1,
            item_amount=Decimal("139.00"),
            shipping_amount=Decimal("0.00"),
            tax_amount=Decimal("0.00"),
            total_amount=Decimal("139.00"),
            maximum_total_amount=Decimal("200.00"),
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
            preferred_shipping_method="kurier",
            preferred_payment_method="Przelewy24",
            customer_note="DEMO AUTOMATYZACJI — NIE REALIZOWAĆ",
            accept_terms=False,
        ),
    )

    print("\n[demo] 1. Shopping Advisor wysyła PurchaseRequest")
    submitted = service.submit(request)
    print(f"[demo] 2. Orchestrator: {submitted.status}, purchase_id={submitted.purchase_id}")
    approval_event = next(
        event for event in service.repository.list_events()
        if event.event_type == "purchase.approval_requested"
    )
    print("[demo] 3. Symuluję zatwierdzenie użytkownika przez endpoint approval")
    result = service.approve(
        submitted.approval_id,
        ApprovalDecision(approval_token=approval_event.payload["approvalToken"]),
    )
    print(f"[demo] 4. Wynik próby: {result.status}")
    print(f"[demo] Baza przebiegu: {database_path}")


if __name__ == "__main__":
    main()
