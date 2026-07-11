import { randomUUID } from "node:crypto";
import type { CheckoutProposal } from "../contract";

type PurchaseResponse = {
  purchase_id: string;
  approval_id?: string | null;
  status: string;
  created_at: string;
};

type OutboxEvent = {
  event_type: string;
  aggregate_id: string;
  payload: Record<string, unknown>;
};

const DEFAULT_USER_ID = "10000000-0000-4000-8000-000000000002";
const DEFAULT_ADDRESS_ID = "10000000-0000-4000-8000-000000000004";

function baseUrl() {
  return (process.env.PURCHASE_ORCHESTRATOR_URL ?? "http://127.0.0.1:8000").replace(/\/$/, "");
}

async function orchestratorFetch<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(`${baseUrl()}${path}`, {
    ...init,
    cache: "no-store",
    headers: { "Content-Type": "application/json", ...init?.headers },
  });
  if (!response.ok) {
    const body = await response.text();
    throw new Error(`Purchase Orchestrator ${response.status}: ${body}`);
  }
  if (response.status === 204) return undefined as T;
  return response.json() as Promise<T>;
}

function checkoutAddress() {
  return {
    recipient_name: process.env.PURCHASE_DEMO_RECIPIENT_NAME ?? "Jan Testowy",
    email: process.env.PURCHASE_DEMO_EMAIL ?? "jan.testowy@example.com",
    phone: process.env.PURCHASE_DEMO_PHONE ?? "+48111222333",
    address_line1: process.env.PURCHASE_DEMO_ADDRESS_LINE1 ?? "Testowa 1",
    address_line2: process.env.PURCHASE_DEMO_ADDRESS_LINE2 || null,
    postal_code: process.env.PURCHASE_DEMO_POSTAL_CODE ?? "00-001",
    city: process.env.PURCHASE_DEMO_CITY ?? "Warszawa",
    country_code: process.env.PURCHASE_DEMO_COUNTRY_CODE ?? "PL",
  };
}

export function buildPurchaseRequest(proposal: CheckoutProposal) {
  const item = proposal.itemPrice.amount;
  const shipping = proposal.shippingCost?.amount ?? 0;
  const total = Number((item + shipping).toFixed(2));
  const currency = proposal.totalPrice.currency;

  return {
    client_request_id: randomUUID(),
    user_id: process.env.PURCHASE_DEMO_USER_ID ?? DEFAULT_USER_ID,
    conversation_id: randomUUID(),
    delivery_address_id: process.env.PURCHASE_DEMO_ADDRESS_ID ?? DEFAULT_ADDRESS_ID,
    offer: {
      merchant: proposal.merchantDomain,
      product_url: proposal.offerSnapshot.url,
      merchant_product_id: proposal.offerSnapshot.id,
      title: proposal.productTitle,
      variant: proposal.variantLabel ?? null,
      quantity: 1,
      item_amount: item.toFixed(2),
      shipping_amount: shipping.toFixed(2),
      tax_amount: "0.00",
      total_amount: total.toFixed(2),
      maximum_total_amount: total.toFixed(2),
      currency,
      is_subscription: false,
    },
    checkout: {
      delivery_address: checkoutAddress(),
      product_configuration: {
        options: proposal.variantLabel ? { variant: proposal.variantLabel } : {},
        personalization: {},
        upload_asset_ids: [],
      },
      preferred_shipping_method: proposal.deliveryPromise ?? null,
      preferred_payment_method: proposal.paymentMethod ?? null,
      customer_note: "Gong purchase pipeline",
      accept_terms: false,
    },
  };
}

export async function submitToPurchaseOrchestrator(proposal: CheckoutProposal): Promise<PurchaseResponse> {
  const request = buildPurchaseRequest(proposal);
  await orchestratorFetch<void>(`/v1/users/${request.user_id}/purchase-policy`, {
    method: "PUT",
    body: JSON.stringify({
      currency: request.offer.currency,
      max_auto_purchase_amount: "0.00",
      approval_mode: "ALWAYS",
      allowed_merchants: [request.offer.merchant],
      allow_subscriptions: false,
    }),
  });
  return orchestratorFetch<PurchaseResponse>("/v1/purchase-requests", {
    method: "POST",
    body: JSON.stringify(request),
  });
}

async function approvalToken(purchaseId: string): Promise<string> {
  const events = await orchestratorFetch<OutboxEvent[]>("/internal/outbox/events");
  const event = [...events].reverse().find(
    (candidate) => candidate.aggregate_id === purchaseId && candidate.event_type === "purchase.approval_requested",
  );
  const token = event?.payload.approvalToken;
  if (typeof token !== "string") throw new Error("Purchase approval token was not found in the server-side outbox");
  return token;
}

export async function decideOrchestratorPurchase(
  proposal: CheckoutProposal,
  approve: boolean,
): Promise<PurchaseResponse> {
  const purchase = proposal.orchestrator;
  if (!purchase?.approvalId) throw new Error("Checkout proposal has no Purchase Orchestrator approval");
  const token = await approvalToken(purchase.purchaseId);
  const action = approve ? "approve" : "reject";
  return orchestratorFetch<PurchaseResponse>(`/v1/purchase-approvals/${purchase.approvalId}/${action}`, {
    method: "POST",
    body: JSON.stringify({ approval_token: token }),
  });
}
