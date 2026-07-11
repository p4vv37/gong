/**
 * All pipeline spend knobs in one place, env-overridable. Defaults protect
 * the free tiers (SerpAPI: 250 searches/month; Firecrawl free: 2 concurrent
 * browsers). A default live run costs ≤4 SerpAPI calls and ~10-15 Firecrawl
 * credits; the replay cache makes repeated identical queries free.
 */

function intEnv(name: string, fallback: number): number {
  const v = Number(process.env[name]);
  return Number.isFinite(v) && v >= 0 ? v : fallback;
}

export const LIMITS = {
  /** immersive drill-downs per run (1 SerpAPI search each) */
  drilldowns: () => intEnv("RESEARCH_DRILLDOWN_LIMIT", 3),
  /** google_shopping results requested */
  shoppingResults: () => intEnv("RESEARCH_SHOPPING_RESULTS", 20),
  /** firecrawl web-search hits */
  webSearchHits: () => intEnv("RESEARCH_WEBSEARCH_HITS", 6),
  /** candidate URLs sent through the extraction ladder */
  maxCandidates: () => intEnv("RESEARCH_MAX_CANDIDATES", 10),
  /** listing domains expanded via site map */
  listingExpansions: () => intEnv("RESEARCH_LISTING_EXPANSIONS", 2),
  /** products pulled per expanded listing */
  productsPerListing: () => intEnv("RESEARCH_PRODUCTS_PER_LISTING", 2),
  /** merchants deep-dived per round */
  deepDives: () => intEnv("RESEARCH_DEEPDIVE_LIMIT", 3),
  /** policy pages read per merchant */
  policyPages: () => intEnv("RESEARCH_POLICY_PAGES", 3),
  /** shopify probes per run */
  shopifyProbes: () => intEnv("RESEARCH_SHOPIFY_PROBES", 5),
  /** extraction ladder concurrency */
  ladderConcurrency: () => intEnv("RESEARCH_LADDER_CONCURRENCY", 4),
};
