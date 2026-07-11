from __future__ import annotations

from datetime import datetime
from decimal import Decimal
from enum import StrEnum
from typing import Any
from uuid import UUID

from pydantic import BaseModel, ConfigDict, Field, HttpUrl, field_validator, model_validator


class ApprovalMode(StrEnum):
    OFFER_ONLY = "OFFER_ONLY"
    ALWAYS = "ALWAYS"
    AUTO_UNDER_LIMIT = "AUTO_UNDER_LIMIT"


class PurchaseStatus(StrEnum):
    LINK_READY = "LINK_READY"
    AWAITING_APPROVAL = "AWAITING_APPROVAL"
    REJECTED = "REJECTED"
    EXECUTION_QUEUED = "EXECUTION_QUEUED"
    EXECUTING = "EXECUTING"
    USER_ACTION_REQUIRED = "USER_ACTION_REQUIRED"
    PURCHASED = "PURCHASED"
    FAILED = "FAILED"


class ApprovalStatus(StrEnum):
    PENDING = "PENDING"
    APPROVED = "APPROVED"
    REJECTED = "REJECTED"
    EXPIRED = "EXPIRED"


class PurchasePolicyInput(BaseModel):
    model_config = ConfigDict(extra="forbid")

    currency: str = Field(min_length=3, max_length=3, default="USD")
    max_auto_purchase_amount: Decimal = Field(ge=Decimal("0"), decimal_places=2)
    approval_mode: ApprovalMode = ApprovalMode.ALWAYS
    allowed_merchants: list[str] = Field(default_factory=list)
    allow_subscriptions: bool = False

    @field_validator("currency")
    @classmethod
    def normalize_currency(cls, value: str) -> str:
        return value.upper()


class Offer(BaseModel):
    model_config = ConfigDict(extra="forbid")

    merchant: str = Field(min_length=1, max_length=255)
    product_url: HttpUrl
    merchant_product_id: str = Field(min_length=1, max_length=255)
    title: str = Field(min_length=1, max_length=500)
    variant: str | None = Field(default=None, max_length=255)
    quantity: int = Field(ge=1, le=100)
    item_amount: Decimal = Field(ge=Decimal("0"), decimal_places=2)
    shipping_amount: Decimal = Field(ge=Decimal("0"), decimal_places=2)
    tax_amount: Decimal = Field(ge=Decimal("0"), decimal_places=2)
    total_amount: Decimal = Field(ge=Decimal("0"), decimal_places=2)
    maximum_total_amount: Decimal = Field(ge=Decimal("0"), decimal_places=2)
    currency: str = Field(min_length=3, max_length=3)
    is_subscription: bool = False

    @field_validator("currency")
    @classmethod
    def normalize_currency(cls, value: str) -> str:
        return value.upper()

    @model_validator(mode="after")
    def validate_total(self) -> "Offer":
        expected = self.item_amount + self.shipping_amount + self.tax_amount
        if self.total_amount != expected:
            raise ValueError("total_amount must equal item_amount + shipping_amount + tax_amount")
        return self


class DeliveryAddress(BaseModel):
    model_config = ConfigDict(extra="forbid")

    recipient_name: str = Field(min_length=1, max_length=255)
    email: str = Field(min_length=3, max_length=320)
    phone: str = Field(min_length=3, max_length=50)
    address_line1: str = Field(min_length=1, max_length=255)
    address_line2: str | None = Field(default=None, max_length=255)
    postal_code: str = Field(min_length=1, max_length=32)
    city: str = Field(min_length=1, max_length=120)
    country_code: str = Field(min_length=2, max_length=2)

    @field_validator("country_code")
    @classmethod
    def normalize_country_code(cls, value: str) -> str:
        return value.upper()


class ProductConfiguration(BaseModel):
    model_config = ConfigDict(extra="forbid")

    options: dict[str, str] = Field(default_factory=dict)
    personalization: dict[str, str] = Field(default_factory=dict)
    upload_asset_ids: list[str] = Field(default_factory=list)


class CheckoutInstructions(BaseModel):
    model_config = ConfigDict(extra="forbid")

    delivery_address: DeliveryAddress
    product_configuration: ProductConfiguration = Field(default_factory=ProductConfiguration)
    preferred_shipping_method: str | None = Field(default=None, max_length=255)
    preferred_payment_method: str | None = Field(default=None, max_length=255)
    customer_note: str | None = Field(default=None, max_length=1000)
    accept_terms: bool = False


class PurchaseRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")

    client_request_id: UUID
    user_id: UUID
    conversation_id: UUID
    delivery_address_id: UUID
    offer: Offer
    checkout: CheckoutInstructions


class ApprovalDecision(BaseModel):
    model_config = ConfigDict(extra="forbid")

    approval_token: str = Field(min_length=32, max_length=512)


class PurchaseResponse(BaseModel):
    purchase_id: UUID
    status: PurchaseStatus
    approval_id: UUID | None = None
    created_at: datetime


class PurchaseDetails(PurchaseResponse):
    user_id: UUID
    conversation_id: UUID
    offer: Offer
    checkout: CheckoutInstructions
    rejection_reason: str | None = None


class OutboxEvent(BaseModel):
    id: UUID
    event_type: str
    aggregate_id: UUID
    payload: dict[str, Any]
    created_at: datetime
