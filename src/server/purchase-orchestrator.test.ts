import { describe, expect, it } from "vitest";
import { FIXTURE_RESULT } from "../contract/fixtures";
import { createProposal } from "./checkout";
import { buildPurchaseRequest } from "./purchase-orchestrator";

describe("Purchase Orchestrator handoff", () => {
  it("maps an immutable Advisor offer snapshot to the FastAPI contract", () => {
    const proposal = createProposal(FIXTURE_RESULT, "off-1");
    if ("error" in proposal) throw new Error(proposal.error);

    const request = buildPurchaseRequest(proposal);

    expect(request.offer).toMatchObject({
      merchant: proposal.merchantDomain,
      product_url: proposal.offerSnapshot.url,
      title: proposal.productTitle,
      quantity: 1,
      currency: proposal.totalPrice.currency,
      maximum_total_amount: request.offer.total_amount,
    });
    expect(Number(request.offer.total_amount)).toBe(
      proposal.itemPrice.amount + (proposal.shippingCost?.amount ?? 0),
    );
    expect(request.checkout.delivery_address.country_code).toBe("PL");
  });
});
