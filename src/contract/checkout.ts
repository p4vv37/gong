import type { Money, Offer } from "./research";

/**
 * Checkout proposal + explicit approval. This is the consent boundary:
 * nothing past "proposed" happens without a recorded user decision, and the
 * decision object is what gets handed to the payment/ordering workstream
 * (steps 3–5).
 */

export type CheckoutProposalStatus =
  | "proposed"
  | "approved"
  | "rejected"
  | "expired";

export type CheckoutProposal = {
  id: string;
  runId: string;
  /** immutable snapshot — re-verified at proposal time, not a live reference */
  offerSnapshot: Offer;
  productTitle: string;
  variantLabel?: string;
  merchantName: string;
  merchantDomain: string;
  itemPrice: Money;
  shippingCost?: Money;
  totalPrice: Money;
  deliveryPromise?: string; // "InPost, 1–2 business days"
  paymentMethod?: string;
  returnSummary?: string; // "30 days, free returns"
  unknowns: string[]; // anything we could NOT verify, shown before approval
  /** which purchase adapter approval will start (PURCHASE_ADAPTER: "dummy", "ai_browser", …) */
  adapter?: string;
  proposedAt: string;
  expiresAt: string; // proposals go stale; prices drift
  status: CheckoutProposalStatus;
  orchestrator?: {
    purchaseId: string;
    approvalId?: string;
    status: string;
  };
  decidedAt?: string;
  rejectionReason?: string;
  /** set on the decision response once an approval placed the (mock) order */
  order?: { orderId: string; placedAt: string };
};

export type CheckoutDecision = {
  proposalId: string;
  approve: boolean;
  rejectionReason?: string;
};
