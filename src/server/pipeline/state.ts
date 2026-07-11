import type {
  Merchant,
  MerchantPolicy,
  Offer,
  Product,
  RecommendationSet,
  ResearchRequest,
  ReviewEvidence,
  Variant,
} from "../../contract";

/** Mutable working state for one research run — becomes RecommendationSet. */
export type RunState = {
  runId: string;
  request: ResearchRequest;
  products: Map<string, Product>;
  variants: Map<string, Variant>;
  merchants: Map<string, Merchant>;
  policies: Map<string, MerchantPolicy>;
  offers: Map<string, Offer>;
  reviews: ReviewEvidence[];
  /** discovery leftovers worth scraping: url → why */
  candidateUrls: Map<string, string>;
  /** LLM fit verdicts: offerId → criterionId → verdict (set by agents/fit-judge) */
  fitJudgments?: Map<string, Map<string, "matched" | "contradicted" | "unknown">>;
};

export function newRunState(runId: string, request: ResearchRequest): RunState {
  return {
    runId,
    request,
    products: new Map(),
    variants: new Map(),
    merchants: new Map(),
    policies: new Map(),
    offers: new Map(),
    reviews: [],
    candidateUrls: new Map(),
  };
}

export function upsertMerchant(state: RunState, m: Merchant): Merchant {
  const existing = state.merchants.get(m.id);
  if (existing) {
    // keep known facts, fill gaps
    existing.platform ??= m.platform;
    existing.countryCode ??= m.countryCode;
    return existing;
  }
  state.merchants.set(m.id, m);
  return m;
}

export function upsertProduct(state: RunState, p: Product): Product {
  const existing = state.products.get(p.id);
  if (!existing) {
    state.products.set(p.id, p);
    return p;
  }
  existing.brand ??= p.brand;
  existing.gtin ??= p.gtin;
  existing.mpn ??= p.mpn;
  existing.imageUrl ??= p.imageUrl;
  for (const fact of p.specs) {
    if (!existing.specs.some((f) => f.aspectId === fact.aspectId && f.confidence >= fact.confidence)) {
      existing.specs.push(fact);
    }
  }
  return existing;
}

/** Higher-confidence field wins; equal confidence → fresher observation wins. */
export function upsertOffer(state: RunState, o: Offer): Offer {
  const existing = state.offers.get(o.id);
  if (!existing) {
    state.offers.set(o.id, o);
    return o;
  }
  for (const key of ["price", "totalPrice", "availability", "delivery"] as const) {
    const next = o[key];
    const prev = existing[key];
    if (next && (!prev || next.confidence > prev.confidence || (next.confidence === prev.confidence && next.observedAt > prev.observedAt))) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (existing as any)[key] = next;
    }
  }
  existing.variantId ??= o.variantId;
  existing.sellerName ??= o.sellerName;
  return existing;
}

export function toRecommendationSet(
  state: RunState,
  extra: Pick<RecommendationSet, "assessments" | "recommendations" | "roundsCompleted">,
): RecommendationSet {
  return {
    runId: state.runId,
    briefRequest: state.request.brief.request,
    products: Object.fromEntries(state.products),
    variants: Object.fromEntries(state.variants),
    merchants: Object.fromEntries(state.merchants),
    policies: Object.fromEntries(state.policies),
    offers: Object.fromEntries(state.offers),
    reviews: state.reviews,
    generatedAt: new Date().toISOString(),
    ...extra,
  };
}
