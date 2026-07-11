import type { PurchaseBrief } from "../domain/purchase-brief";

export type { Criterion, CriterionKind, PurchaseBrief } from "../domain/purchase-brief";

/**
 * Research-side data model. This file is the contract between the
 * conversation half (src/domain, src/components — owned by the elicitation
 * workstream) and the research half (src/server — owned by the pipeline
 * workstream). Change it only by agreement between both.
 */

// ---------------------------------------------------------------------------
// Provenance — every meaningful claim carries where/when/how it was learned.
// ---------------------------------------------------------------------------

export type EvidenceSource =
  | "jsonld" // schema.org Product/Offer parsed deterministically
  | "og_meta" // OpenGraph product:* tags
  | "ucp" // /.well-known/ucp (Shopify et al.)
  | "products_json" // Shopify /products.json
  | "serpapi" // Google Shopping via SerpAPI
  | "firecrawl_product" // Firecrawl scrape, `product` format
  | "firecrawl_json" // Firecrawl scrape, `json` format w/ schema
  | "policy_page" // LLM deep-read of shipping/returns/TOS page
  | "review_page" // review page or widget
  | "fixture" // recorded/replayed demo data
  | "none"; // placeholder for unknown fields (confidence 0)

/**
 * How deep the observation was made. A claim at "merchant" level (e.g. the
 * store's general returns page) is weaker than the same claim observed at
 * "offer" level, and the UI must render the difference.
 */
export type DepthLevel = "page" | "merchant" | "offer" | "cart" | "checkout";

export type Field<T> = {
  value?: T; // absent = unknown. Unknown must never silently become false.
  confidence: number; // 0..1
  source: EvidenceSource;
  depth: DepthLevel;
  observedAt: string; // ISO timestamp
  evidenceUrl?: string;
  evidenceText?: string; // short quote supporting the claim
  /**
   * Set on unknown fields we looked for but could not establish: WHY it is
   * unknown and at which depth it could still resolve (e.g. exact shipping
   * often appears only at cart stage). UI renders these as "deferred", never
   * as silent negatives.
   */
  deferred?: { reason: string; resolvableAt: DepthLevel };
};

// ---------------------------------------------------------------------------
// Entities — Product / Variant / Merchant / MerchantPolicy / Offer.
// Separated so offers dedupe by product identity and policies are read once
// per merchant, then attached to all of that merchant's offers.
// ---------------------------------------------------------------------------

export type SpecFact = Field<string | number | boolean> & {
  aspectId: string; // key from the category taxonomy, e.g. "material"
  unit?: string;
};

export type Product = {
  id: string;
  title: string;
  brand?: string;
  mpn?: string;
  gtin?: string;
  category: string;
  specs: SpecFact[];
  imageUrl?: string;
};

export type Variant = {
  id: string;
  productId: string;
  label: string; // "black / L"
  attrs: Record<string, string>; // { color: "black", size: "L" }
  gtin?: string;
};

export type MerchantPlatform = "shopify" | "woocommerce" | "marketplace" | "other";

export type Merchant = {
  id: string;
  name: string;
  domain: string;
  platform?: MerchantPlatform;
  countryCode?: string; // ISO 3166-1 alpha-2
};

export type Money = { amount: number; currency: string };

export type ShippingPolicy = {
  cost?: Money;
  freeAbove?: Money;
  etaDays?: [number, number];
  methods?: string[]; // "InPost", "DPD", "courier"...
};

export type ReturnPolicy = {
  windowDays?: number;
  freeReturns?: boolean;
  notes?: string;
};

export type MerchantPolicy = {
  merchantId: string;
  shipping: Field<ShippingPolicy>;
  returns: Field<ReturnPolicy>;
  payment: Field<string[]>; // "BLIK", "card", "PayPal", "COD"...
  warranty?: Field<string>;
};

export type Availability = "in_stock" | "out_of_stock" | "preorder" | "unknown";

export type Offer = {
  id: string;
  productId: string;
  variantId?: string;
  merchantId: string;
  url: string;
  price: Field<Money>;
  /** price + shipping when both are known; recompute, never trust a scraped total */
  totalPrice?: Field<Money>;
  availability: Field<Availability>;
  condition: "new" | "used" | "refurbished" | "unknown";
  delivery?: Field<{ etaDays?: [number, number]; cost?: Money }>;
  /** marketplace sub-seller, when the merchant is a marketplace */
  sellerName?: string;
};

// ---------------------------------------------------------------------------
// Reviews — two separate evidence streams (product vs merchant), never one
// blended star number.
// ---------------------------------------------------------------------------

export type ReviewEvidence = {
  subject: "product" | "merchant";
  subjectId: string; // productId or merchantId
  rating?: number; // normalized 0..5
  count?: number;
  summary?: string; // short LLM digest of recurring themes
  risks?: string[]; // e.g. "many reports of late delivery"
  manipulationRisk?: "low" | "suspicious" | "unknown";
  source: EvidenceSource;
  url?: string;
  observedAt: string;
};

// ---------------------------------------------------------------------------
// Eligibility & scoring — hard criteria filter, they never enter the score.
// ---------------------------------------------------------------------------

export type EligibilityViolation = {
  criterionId: string;
  reason: string;
};

export type OfferAssessment = {
  offerId: string;
  eligible: boolean;
  violations: EligibilityViolation[];
  score: {
    preferenceFit: number; // 0..1 weighted fit against "prefer" criteria
    value: number; // 0..1 price/value within the eligible set
    trust: number; // 0..1 merchant + review confidence
    uncertaintyPenalty: number; // 0..1 subtracted: important fields unknown
    riskPenalty: number; // 0..1 subtracted
    total: number;
  };
  /** aspectIds/policy fields that matter for this brief but are unknown — drives deepening */
  unknowns: string[];
};

// ---------------------------------------------------------------------------
// Research run I/O
// ---------------------------------------------------------------------------

export type ResearchMode = "fixture" | "live";

export type ResearchRequest = {
  brief: PurchaseBrief;
  mode: ResearchMode;
  limits?: {
    maxCandidates?: number; // default 40
    deepDiveCount?: number; // default 5
    maxRounds?: number; // default 2
  };
};

export type RecommendationRole =
  | "best_overall"
  | "best_value"
  | "lowest_risk"
  | "specialist";

export type Recommendation = {
  role: RecommendationRole;
  offerId: string;
  headline: string; // one sentence, user-facing
  satisfiedCriterionIds: string[];
  compromises: string[]; // user-facing, e.g. "returns window only 14 days"
  unknowns: string[]; // user-facing honesty list
  whyNotTheOthers?: string;
};

export type RecommendationSet = {
  runId: string;
  briefRequest: string; // echo of brief.request for display
  products: Record<string, Product>;
  variants: Record<string, Variant>;
  merchants: Record<string, Merchant>;
  policies: Record<string, MerchantPolicy>; // by merchantId
  offers: Record<string, Offer>;
  reviews: ReviewEvidence[];
  assessments: Record<string, OfferAssessment>; // by offerId
  recommendations: Recommendation[];
  roundsCompleted: number;
  generatedAt: string;
};
