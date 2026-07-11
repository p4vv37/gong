import type { ProgressEvent, PurchaseBrief, ReviewEvidence } from "../../contract";
import { llmEnabled } from "../agents/client";
import { fcSearch } from "../connectors/firecrawl";
import { googleShopping, immersiveProduct } from "../connectors/serpapi";
import { probeShopify } from "../connectors/shopify";
import { domainOf } from "./ids";
import { LIMITS } from "./limits";
import { fromImmersiveStore, type Normalized } from "./normalize";
import { applyNormalized, type Emit } from "./run-helpers";
import type { RunState } from "./state";

function addReview(state: RunState, review: ReviewEvidence): void {
  if (!state.reviews.some((r) => r.subject === review.subject && r.subjectId === review.subjectId)) {
    state.reviews.push(review);
  }
}

/** Deterministic query composition from the brief (LLM refinement is a later layer). */
export function buildQuery(brief: PurchaseBrief): string {
  const parts = [brief.request];
  // At most two short criterion values — overloaded queries return nothing.
  const extras = brief.criteria
    .filter((c) => (c.kind === "must" || c.kind === "prefer") && c.source === "answer" && c.value.length < 30 && !/budget|budżet|stan|condition/i.test(c.label))
    .slice(0, 2);
  for (const c of extras) parts.push(c.value);
  return parts.join(" ").slice(0, 140);
}

export async function discover(state: RunState, emit: Emit): Promise<void> {
  const brief = state.request.brief;
  let query = buildQuery(brief);
  let webQuery = `${query} sklep`;

  // LLM store-intent synthesis: right language, shop phrasing (keyless → deterministic)
  if (llmEnabled()) {
    try {
      const { synthesizeQueries } = await import("../agents/query-synth");
      const q = await synthesizeQueries(brief);
      if (q) {
        query = q.shoppingQuery;
        webQuery = q.webQuery;
      }
    } catch (err) {
      emit({ type: "warning", detail: String(err), label: "Query synthesis unavailable — using literal request" });
    }
  }
  const maxPrice = brief.budget?.max;

  // channels are independent — one failing or returning nothing must not kill the run
  const [shopping, webHits] = await Promise.all([
    (async () => {
      try {
        let r = await googleShopping(query, { num: LIMITS.shoppingResults(), maxPrice });
        if (!r.length && query !== brief.request) {
          emit({ type: "warning", detail: "empty shopping results", label: `No shopping results for the detailed query — retrying with "${brief.request}"` });
          r = await googleShopping(brief.request, { num: LIMITS.shoppingResults(), maxPrice });
        }
        emit({ type: "source_searched", channel: "serpapi", label: `Google Shopping (PL): ${r.length} offers` });
        return r;
      } catch (err) {
        emit({ type: "warning", detail: String(err), label: "Google Shopping unavailable — continuing with web search" });
        return [];
      }
    })(),
    (async () => {
      try {
        const r = await fcSearch(webQuery, { limit: LIMITS.webSearchHits() });
        emit({ type: "source_searched", channel: "firecrawl", label: `Web search: ${r.length} store pages` });
        return r;
      } catch (err) {
        emit({ type: "warning", detail: String(err), label: "Web search unavailable — continuing with Google Shopping" });
        return [];
      }
    })(),
  ]);

  // SerpAPI → immersive drill-down for direct merchant offers. Prefer rated
  // items (trust evidence rides along free), then Google's own ranking.
  const tokens = shopping
    .filter((r) => r.immersive_product_page_token)
    .sort((a, b) => Number(b.rating !== undefined) - Number(a.rating !== undefined) || (a.position ?? 99) - (b.position ?? 99))
    .slice(0, LIMITS.drilldowns());
  const drilldowns = await Promise.all(
    tokens.map(async (item) => {
      try {
        const stores = await immersiveProduct(item.immersive_product_page_token as string);
        return { item, stores };
      } catch (err) {
        emit({ type: "warning", detail: String(err), label: `Store list unavailable for "${item.title?.slice(0, 60)}"` });
        return { item, stores: [] };
      }
    }),
  );

  for (const { item, stores } of drilldowns) {
    for (const store of stores) {
      const normalized: Normalized | undefined = fromImmersiveStore(store, brief.category);
      if (!normalized) continue;
      applyNormalized(state, normalized);
      // reviews ride along for free: item.rating = product, store.rating = merchant
      if (item.rating !== undefined) {
        addReview(state, {
          subject: "product",
          subjectId: normalized.product.id,
          rating: item.rating,
          count: item.reviews,
          manipulationRisk: "unknown",
          source: "serpapi",
          observedAt: new Date().toISOString(),
        });
      }
      if (store.rating !== undefined) {
        addReview(state, {
          subject: "merchant",
          subjectId: normalized.merchant.id,
          rating: store.rating,
          count: store.reviews,
          manipulationRisk: "unknown",
          source: "serpapi",
          observedAt: new Date().toISOString(),
        });
      }
      emit({
        type: "candidate_found",
        url: normalized.offer.url,
        merchantDomain: normalized.merchant.domain,
        label: `${normalized.product.title.slice(0, 60)} @ ${normalized.merchant.name} — ${store.price ?? ""}`,
      });
    }
    // shopping rows without drilldown stores still carry title/price → keep as weak signal only
    if (!stores.length && item.title) {
      emit({ type: "warning", detail: "no direct stores", label: `No direct store links for "${item.title.slice(0, 60)}"` });
    }
  }

  // Firecrawl web hits → candidate URLs for the extraction ladder
  for (const hit of webHits) {
    if (hit.url && !state.candidateUrls.has(hit.url)) {
      state.candidateUrls.set(hit.url, hit.title ?? "web search hit");
    }
  }

  // Shopify probe on unique discovered domains — platform signal + UCP flag
  const domains = new Set<string>();
  for (const m of state.merchants.values()) domains.add(m.domain);
  for (const url of state.candidateUrls.keys()) domains.add(domainOf(url));
  const toProbe = [...domains].slice(0, LIMITS.shopifyProbes());
  const probes = await Promise.all(toProbe.map((d) => probeShopify(d).catch(() => undefined)));
  for (const probe of probes) {
    if (!probe?.isShopify) continue;
    const m = [...state.merchants.values()].find((x) => x.domain === probe.domain);
    if (m) m.platform = "shopify";
    emit({
      type: "source_searched",
      channel: "shopify_probe",
      label: `${probe.domain} is Shopify${probe.hasUcp ? " with machine-readable offers (UCP)" : ""}`,
    });
  }
}

export function progressBase(state: RunState): Pick<ProgressEvent, "runId" | "at"> {
  return { runId: state.runId, at: new Date().toISOString() };
}
