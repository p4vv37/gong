from __future__ import annotations

from dataclasses import dataclass
from typing import Protocol
from uuid import UUID

from .models import PurchaseDetails


@dataclass(frozen=True)
class ExecutionReceipt:
    adapter: str
    external_reference: str


class PurchaseAdapter(Protocol):
    def execute(self, purchase: PurchaseDetails) -> ExecutionReceipt:
        """Execute an already authorized purchase."""


class DummyPurchaseAdapter:
    """Demo-only adapter that never contacts a merchant or payment provider."""

    def execute(self, purchase: PurchaseDetails) -> ExecutionReceipt:
        reference = f"demo-{purchase.purchase_id}"
        print(
            f"[dummy-purchase] Purchase {purchase.purchase_id} succeeded: "
            f"{purchase.offer.title} for {purchase.offer.total_amount} {purchase.offer.currency}. "
            f"Reference: {reference}"
        )
        return ExecutionReceipt(adapter="dummy", external_reference=reference)


class PurchaseExecutor:
    def __init__(self, adapter: PurchaseAdapter) -> None:
        self.adapter = adapter

    def execute(self, purchase: PurchaseDetails) -> ExecutionReceipt:
        return self.adapter.execute(purchase)

