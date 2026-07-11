import { describe, expect, it } from "vitest";
import type { ResearchRequest } from "../../contract";
import { resolveIdentity } from "./identity";
import { newRunState, upsertMerchant, upsertOffer, upsertProduct } from "./state";

const request: ResearchRequest = {
  mode: "live",
  brief: {
    request: "test",
    category: "Test",
    market: { country: "Poland", currency: "PLN", language: "Polish" },
    warrantedDepth: 50,
    criteria: [],
    answeredQuestionIds: [],
    readyForSearch: true,
  },
};

const field = { confidence: 0.9, source: "jsonld" as const, depth: "page" as const, observedAt: "2026-07-11T00:00:00Z" };

function seed() {
  const state = newRunState("run-test", request);
  upsertMerchant(state, { id: "m-a.pl", name: "A", domain: "a.pl" });
  upsertMerchant(state, { id: "m-b.pl", name: "B", domain: "b.pl" });
  return state;
}

describe("resolveIdentity (keyless deterministic path)", () => {
  it("merges near-identical titles and re-points offers", async () => {
    const state = seed();
    upsertProduct(state, { id: "p-1", title: "Kurtka turystyczna męska Quechua MH500 Light wodoodporna", category: "Test", specs: [] });
    upsertProduct(state, { id: "p-2", title: "Quechua MH500 Light kurtka turystyczna meska wodoodporna", category: "Test", specs: [] });
    upsertOffer(state, { id: "o-1", productId: "p-1", merchantId: "m-a.pl", url: "https://a.pl/1", price: { value: { amount: 300, currency: "PLN" }, ...field }, availability: { value: "in_stock", ...field }, condition: "new" });
    upsertOffer(state, { id: "o-2", productId: "p-2", merchantId: "m-b.pl", url: "https://b.pl/2", price: { value: { amount: 280, currency: "PLN" }, ...field }, availability: { value: "in_stock", ...field }, condition: "new" });

    await resolveIdentity(state, () => {});

    expect(state.products.size).toBe(1);
    const survivorId = [...state.products.keys()][0];
    expect(state.offers.get("o-1")?.productId).toBe(survivorId);
    expect(state.offers.get("o-2")?.productId).toBe(survivorId);
  });

  it("keeps clearly different products separate", async () => {
    const state = seed();
    upsertProduct(state, { id: "p-1", title: "Kurtka przeciwdeszczowa Halti Fort", category: "Test", specs: [] });
    upsertProduct(state, { id: "p-2", title: "Okulary kolarskie PolarSky Premium", category: "Test", specs: [] });

    await resolveIdentity(state, () => {});

    expect(state.products.size).toBe(2);
  });

  it("never merges products with different GTINs", async () => {
    const state = seed();
    upsertProduct(state, { id: "p-1", title: "Quechua MH500 Light kurtka", gtin: "111", category: "Test", specs: [] });
    upsertProduct(state, { id: "p-2", title: "Quechua MH500 Light kurtka", gtin: "222", category: "Test", specs: [] });

    await resolveIdentity(state, () => {});

    expect(state.products.size).toBe(2);
  });
});
