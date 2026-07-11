import { randomUUID } from "node:crypto";
import type { CheckoutDecision, CheckoutProposal, RecommendationSet } from "../contract";

/**
 * Checkout proposal registry — the consent boundary. A proposal is an
 * immutable snapshot of what the user would buy; nothing proceeds without an
 * explicit recorded decision. The Agents-SDK purchase gate consumes these.
 */

const globalStore = globalThis as unknown as { __checkoutProposals?: Map<string, CheckoutProposal> };
const proposals: Map<string, CheckoutProposal> = (globalStore.__checkoutProposals ??= new Map());

const PROPOSAL_TTL_MS = 30 * 60 * 1000; // prices drift; proposals expire

export function createProposal(result: RecommendationSet, offerId: string): CheckoutProposal | { error: string } {
  const offer = result.offers[offerId];
  if (!offer) return { error: `unknown offer ${offerId}` };
  const merchant = result.merchants[offer.merchantId];
  const policy = result.policies[offer.merchantId];

  const itemPrice = offer.price.value;
  if (!itemPrice) return { error: "offer has no verified price" };

  const policyShip = policy?.shipping.value;
  const qualifiesForFree =
    policyShip?.freeAbove?.amount !== undefined && itemPrice !== undefined && itemPrice.amount >= policyShip.freeAbove.amount;
  const shippingCost =
    offer.delivery?.value?.cost ??
    (qualifiesForFree ? { amount: 0, currency: itemPrice.currency } : policyShip?.cost !== undefined ? policyShip.cost : undefined);
  const total = { amount: Number((itemPrice.amount + (shippingCost?.amount ?? 0)).toFixed(2)), currency: itemPrice.currency };

  const unknowns: string[] = [];
  if (!shippingCost) unknowns.push("exact shipping cost");
  if (offer.availability.value !== "in_stock" || offer.availability.confidence < 0.5) unknowns.push("current stock");
  if (!policy?.returns.value) unknowns.push("return policy");
  if (!policy?.payment.value) unknowns.push("payment methods");

  const etaDays = offer.delivery?.value?.etaDays ?? policy?.shipping.value?.etaDays;
  const now = new Date();
  const proposal: CheckoutProposal = {
    id: `chk-${randomUUID().slice(0, 8)}`,
    runId: result.runId,
    offerSnapshot: offer,
    merchantName: merchant?.name ?? offer.merchantId,
    merchantDomain: merchant?.domain ?? "",
    itemPrice,
    shippingCost,
    totalPrice: total,
    deliveryPromise: etaDays ? `${etaDays[0]}–${etaDays[1]} business days` : undefined,
    paymentMethod: policy?.payment.value?.[0],
    returnSummary: policy?.returns.value?.windowDays !== undefined
      ? `${policy.returns.value.windowDays} days${policy.returns.value.freeReturns ? ", free returns" : ""}`
      : undefined,
    unknowns,
    proposedAt: now.toISOString(),
    expiresAt: new Date(now.getTime() + PROPOSAL_TTL_MS).toISOString(),
    status: "proposed",
  };
  proposals.set(proposal.id, proposal);
  return proposal;
}

export function getProposal(id: string): CheckoutProposal | undefined {
  const p = proposals.get(id);
  if (p && p.status === "proposed" && p.expiresAt < new Date().toISOString()) {
    p.status = "expired";
  }
  return p;
}

export function decideProposal(decision: CheckoutDecision): CheckoutProposal | { error: string } {
  const p = getProposal(decision.proposalId);
  if (!p) return { error: "unknown proposal" };
  if (p.status !== "proposed") return { error: `proposal is ${p.status}` };
  p.status = decision.approve ? "approved" : "rejected";
  p.decidedAt = new Date().toISOString();
  if (!decision.approve) p.rejectionReason = decision.rejectionReason;
  return p;
}
