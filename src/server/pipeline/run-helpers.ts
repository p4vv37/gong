import type { ProgressEvent } from "../../contract";
import type { Normalized } from "./normalize";
import { upsertMerchant, upsertOffer, upsertProduct, type RunState } from "./state";

/** Emit signature used across pipeline stages — runId/at are stamped by the runner. */
type DistributiveOmit<T, K extends PropertyKey> = T extends unknown ? Omit<T, K> : never;
export type Emit = (e: DistributiveOmit<ProgressEvent, "runId" | "at">) => void;

export function applyNormalized(state: RunState, n: Normalized): void {
  upsertMerchant(state, n.merchant);
  upsertProduct(state, n.product);
  upsertOffer(state, n.offer);
  if (n.policyPatch?.merchantId) {
    const existing = state.policies.get(n.policyPatch.merchantId);
    if (existing) {
      if (n.policyPatch.returns && (!existing.returns.value || n.policyPatch.returns.confidence > existing.returns.confidence)) {
        existing.returns = n.policyPatch.returns;
      }
      if (n.policyPatch.shipping && (!existing.shipping.value || n.policyPatch.shipping.confidence > existing.shipping.confidence)) {
        existing.shipping = n.policyPatch.shipping;
      }
      if (n.policyPatch.payment && (!existing.payment.value || n.policyPatch.payment.confidence > existing.payment.confidence)) {
        existing.payment = n.policyPatch.payment;
      }
    } else {
      const unknownField = { confidence: 0, source: "none" as const, depth: "merchant" as const, observedAt: new Date().toISOString() };
      state.policies.set(n.policyPatch.merchantId, {
        merchantId: n.policyPatch.merchantId,
        shipping: n.policyPatch.shipping ?? unknownField,
        returns: n.policyPatch.returns ?? unknownField,
        payment: n.policyPatch.payment ?? unknownField,
        warranty: n.policyPatch.warranty,
      });
    }
  }
}
