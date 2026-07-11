import type { ProgressEvent } from "./events";
import type { Availability, Field, RecommendationSet } from "./research";

/**
 * Fixture data for keyless development and demo replay. The UI can be built
 * against FIXTURE_RESULT + makeFixtureEvents() before any API key exists;
 * the /api/research route serves exactly these shapes in fixture mode.
 * Scenario matches the CP1 demo: waterproof jacket, budget 400 PLN, Poland.
 */

const at = () => new Date().toISOString();

const seen = <T>(value: T, overrides?: Partial<Field<T>>): Field<T> => ({
  value,
  confidence: 0.95,
  source: "fixture",
  depth: "page",
  observedAt: "2026-07-11T10:00:00.000Z",
  ...overrides,
});

const unknown = <T>(overrides?: Partial<Field<T>>): Field<T> => ({
  confidence: 0,
  source: "fixture",
  depth: "page",
  observedAt: "2026-07-11T10:00:00.000Z",
  ...overrides,
});

export const FIXTURE_RUN_ID = "run-fixture-jacket";

export const FIXTURE_RESULT: RecommendationSet = {
  runId: FIXTURE_RUN_ID,
  briefRequest: "waterproof jacket for city commuting, under 400 zł",
  products: {
    "prod-hardshell-01": {
      id: "prod-hardshell-01",
      title: "Halti Fort DrymaxX Shell Jacket",
      brand: "Halti",
      category: "Outerwear",
      specs: [
        { aspectId: "waterproof-rating", ...seen<string | number | boolean>("10000 mm") },
        { aspectId: "hood", ...seen<string | number | boolean>(true) },
      ],
    },
    "prod-rain-02": {
      id: "prod-rain-02",
      title: "4F Membrane 5000 Rain Jacket",
      brand: "4F",
      category: "Outerwear",
      specs: [{ aspectId: "waterproof-rating", ...seen<string | number | boolean>("5000 mm") }],
    },
  },
  variants: {
    "var-hardshell-01-l": {
      id: "var-hardshell-01-l",
      productId: "prod-hardshell-01",
      label: "black / L",
      attrs: { color: "black", size: "L" },
    },
  },
  merchants: {
    "m-sklepgorski": {
      id: "m-sklepgorski",
      name: "Sklep Górski (independent)",
      domain: "sklepgorski.example.pl",
      platform: "shopify",
      countryCode: "PL",
    },
    "m-bigretail": {
      id: "m-bigretail",
      name: "SportMax",
      domain: "sportmax.example.pl",
      platform: "other",
      countryCode: "PL",
    },
    "m-outlet": {
      id: "m-outlet",
      name: "OutletWear",
      domain: "outletwear.example.pl",
      platform: "woocommerce",
      countryCode: "PL",
    },
  },
  policies: {
    "m-sklepgorski": {
      merchantId: "m-sklepgorski",
      shipping: seen(
        { cost: { amount: 12.99, currency: "PLN" }, etaDays: [1, 2] as [number, number], methods: ["InPost", "DPD"] },
        { source: "policy_page", depth: "merchant" },
      ),
      returns: seen(
        { windowDays: 30, freeReturns: true },
        { source: "policy_page", depth: "merchant" },
      ),
      payment: seen(["BLIK", "card", "PayPal"], { source: "policy_page", depth: "merchant" }),
    },
    "m-bigretail": {
      merchantId: "m-bigretail",
      shipping: seen(
        { cost: { amount: 0, currency: "PLN" }, freeAbove: { amount: 199, currency: "PLN" }, etaDays: [1, 3] as [number, number] },
        { source: "jsonld", depth: "merchant" },
      ),
      returns: seen({ windowDays: 14, freeReturns: false }, { source: "policy_page", depth: "merchant", confidence: 0.7 }),
      payment: seen(["BLIK", "card", "COD"], { source: "policy_page", depth: "merchant" }),
    },
    "m-outlet": {
      merchantId: "m-outlet",
      shipping: unknown({ evidenceText: "no shipping page found in round 1" }),
      returns: unknown(),
      payment: unknown(),
    },
  },
  offers: {
    "off-1": {
      id: "off-1",
      productId: "prod-hardshell-01",
      variantId: "var-hardshell-01-l",
      merchantId: "m-sklepgorski",
      url: "https://sklepgorski.example.pl/p/halti-fort-drymaxx",
      price: seen({ amount: 379, currency: "PLN" }, { source: "jsonld" }),
      totalPrice: seen({ amount: 391.99, currency: "PLN" }, { depth: "merchant" }),
      availability: seen<Availability>("in_stock", { source: "jsonld" }),
      condition: "new",
    },
    "off-2": {
      id: "off-2",
      productId: "prod-rain-02",
      merchantId: "m-bigretail",
      url: "https://sportmax.example.pl/p/4f-membrane-5000",
      price: seen({ amount: 249, currency: "PLN" }, { source: "serpapi" }),
      totalPrice: seen({ amount: 249, currency: "PLN" }, { depth: "merchant" }),
      availability: seen<Availability>("in_stock", { source: "serpapi", confidence: 0.8 }),
      condition: "new",
    },
    "off-3": {
      id: "off-3",
      productId: "prod-hardshell-01",
      merchantId: "m-outlet",
      url: "https://outletwear.example.pl/p/halti-fort",
      price: seen({ amount: 299, currency: "PLN" }, { source: "firecrawl_product" }),
      availability: seen<Availability>("unknown", { confidence: 0.3 }),
      condition: "new",
    },
  },
  reviews: [
    {
      subject: "product",
      subjectId: "prod-hardshell-01",
      rating: 4.6,
      count: 212,
      summary: "Praised for real waterproofing in daily commuting; sizing runs small.",
      manipulationRisk: "low",
      source: "review_page",
      observedAt: "2026-07-11T10:00:00.000Z",
    },
    {
      subject: "merchant",
      subjectId: "m-outlet",
      rating: 3.1,
      count: 48,
      risks: ["several recent reports of week-long shipping delays"],
      manipulationRisk: "unknown",
      source: "review_page",
      observedAt: "2026-07-11T10:00:00.000Z",
    },
  ],
  assessments: {
    "off-1": {
      offerId: "off-1",
      eligible: true,
      violations: [],
      score: { preferenceFit: 0.92, value: 0.7, trust: 0.9, uncertaintyPenalty: 0.02, riskPenalty: 0, total: 0.88 },
      unknowns: [],
    },
    "off-2": {
      offerId: "off-2",
      eligible: true,
      violations: [],
      score: { preferenceFit: 0.68, value: 0.9, trust: 0.85, uncertaintyPenalty: 0.05, riskPenalty: 0, total: 0.79 },
      unknowns: ["waterproof-rating vs heavy rain"],
    },
    "off-3": {
      offerId: "off-3",
      eligible: true,
      violations: [],
      score: { preferenceFit: 0.92, value: 0.85, trust: 0.4, uncertaintyPenalty: 0.3, riskPenalty: 0.15, total: 0.62 },
      unknowns: ["availability", "shipping", "returns", "payment"],
    },
  },
  recommendations: [
    {
      role: "best_overall",
      offerId: "off-1",
      headline: "The Halti shell at Sklep Górski: fully verified, in stock, free 30-day returns, 391.99 zł delivered.",
      satisfiedCriterionIds: ["request-budget"],
      compromises: ["12.99 zł shipping"],
      unknowns: [],
    },
    {
      role: "best_value",
      offerId: "off-2",
      headline: "The 4F membrane jacket at SportMax: 249 zł with free delivery — lighter waterproofing, fine for city rain.",
      satisfiedCriterionIds: ["request-budget"],
      compromises: ["5000 mm membrane instead of 10000 mm", "returns cost extra, 14-day window"],
      unknowns: ["stock confirmed only via Google Shopping, not the store page"],
    },
    {
      role: "lowest_risk",
      offerId: "off-1",
      headline: "Same Halti shell from the verified seller — an outlet lists it for 299 zł, but that store's shipping, returns and stock are unverified.",
      satisfiedCriterionIds: ["request-budget"],
      compromises: [],
      unknowns: [],
      whyNotTheOthers: "OutletWear has a 3.1★ seller rating with delay reports and no discoverable policies.",
    },
  ],
  priceBracket: {
    query: "waterproof jacket for city commuting",
    currency: "PLN",
    low: 150,
    typical: [250, 550],
    premium: 900,
    summary: "Solidne miejskie kurtki przeciwdeszczowe kosztują zwykle 250–550 zł; poniżej 150 zł membrany bywają symboliczne.",
    sources: ["https://example.pl/ranking-kurtek-przeciwdeszczowych"],
    confidence: 0.8,
    observedAt: "2026-07-11T10:00:30.000Z",
    budgetAssessment: "within_typical",
  },
  roundsCompleted: 2,
  generatedAt: "2026-07-11T10:02:30.000Z",
};

/** Scripted event feed for fixture mode; the API route replays these with small delays. */
export function makeFixtureEvents(runId: string = FIXTURE_RUN_ID): ProgressEvent[] {
  return [
    { type: "run_started", runId, at: at(), mode: "fixture", label: "Research started (fixture mode)" },
    { type: "phase_started", runId, at: at(), phase: "discovery", round: 1, label: "Searching Google Shopping, the open web and Shopify catalogs…" },
    { type: "source_searched", runId, at: at(), channel: "serpapi", label: "Google Shopping (PL): 14 candidate offers" },
    { type: "source_searched", runId, at: at(), channel: "firecrawl", label: "Web search: 6 independent stores found" },
    { type: "candidate_found", runId, at: at(), url: "https://sklepgorski.example.pl/p/halti-fort-drymaxx", merchantDomain: "sklepgorski.example.pl", label: "Found Halti Fort DrymaxX at Sklep Górski" },
    { type: "phase_started", runId, at: at(), phase: "standardize", round: 1, label: "Reading product pages and normalizing offers…" },
    { type: "offer_normalized", runId, at: at(), offerId: "off-1", extractionSource: "jsonld", label: "sklepgorski.example.pl: price and stock read from structured data" },
    { type: "offer_normalized", runId, at: at(), offerId: "off-3", extractionSource: "firecrawl_product", label: "outletwear.example.pl: extracted product data" },
    { type: "offers_ranked", runId, at: at(), eligibleCount: 9, round: 1, label: "9 offers within budget — picking 3 to investigate deeper" },
    { type: "phase_started", runId, at: at(), phase: "deepen", round: 2, label: "Checking shipping, returns and payment policies in parallel…" },
    { type: "deep_dive_started", runId, at: at(), merchantDomain: "sklepgorski.example.pl", offerId: "off-1", label: "Reading Sklep Górski's delivery and returns pages" },
    { type: "deep_dive_completed", runId, at: at(), merchantDomain: "sklepgorski.example.pl", offerId: "off-1", learned: ["shipping", "returns", "payment"], label: "Sklep Górski: 30-day free returns, InPost from 12.99 zł, BLIK accepted" },
    { type: "warning", runId, at: at(), detail: "outletwear.example.pl has no discoverable shipping/returns pages", label: "OutletWear: policies not found — flagged as unverified" },
    { type: "offers_ranked", runId, at: at(), eligibleCount: 9, round: 2, label: "Final ranking ready" },
    { type: "run_completed", runId, at: at(), result: FIXTURE_RESULT, label: "Research complete: 3 recommendations" },
  ];
}
