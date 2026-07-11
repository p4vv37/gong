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

/**
 * Rebuild working state from a stored result — powers on-demand deepening
 * after the original run finished (or after a server restart). LLM fit
 * verdicts are reconstructed from the stored assessments: recorded
 * criterion violations → contradicted, must-criteria absent from unknowns →
 * matched. Prefer-criteria verdicts fall back to keyword matching (small,
 * acceptable score drift).
 */
export function hydrateState(runId: string, request: ResearchRequest, result: RecommendationSet): RunState {
  const state = newRunState(runId, request);
  for (const [k, v] of Object.entries(result.products)) state.products.set(k, v);
  for (const [k, v] of Object.entries(result.variants)) state.variants.set(k, v);
  for (const [k, v] of Object.entries(result.merchants)) state.merchants.set(k, v);
  for (const [k, v] of Object.entries(result.policies)) state.policies.set(k, v);
  for (const [k, v] of Object.entries(result.offers)) state.offers.set(k, v);
  state.reviews = [...result.reviews];

  state.fitJudgments = new Map();
  const mustLabels = new Map(request.brief.criteria.filter((c) => c.kind === "must").map((c) => [c.id, c.label]));
  for (const a of Object.values(result.assessments)) {
    const m = new Map<string, "matched" | "contradicted" | "unknown">();
    for (const v of a.violations) {
      if (mustLabels.has(v.criterionId)) m.set(v.criterionId, "contradicted");
    }
    for (const [id, label] of mustLabels) {
      if (!m.has(id)) m.set(id, a.unknowns.includes(`must:${label}`) ? "unknown" : "matched");
    }
    state.fitJudgments.set(a.offerId, m);
  }
  return state;
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
