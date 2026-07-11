import type { ProgressEvent, PurchaseBrief } from "../../contract";
import { fcSearch } from "../connectors/firecrawl";
import { googleShopping, immersiveProduct } from "../connectors/serpapi";
import { probeShopify } from "../connectors/shopify";
import { domainOf } from "./ids";
import { fromImmersiveStore, type Normalized } from "./normalize";
import { applyNormalized, type Emit } from "./run-helpers";
import type { RunState } from "./state";

/** Deterministic query composition from the brief (LLM refinement is a later layer). */
export function buildQuery(brief: PurchaseBrief): string {
  const parts = [brief.request];
  for (const c of brief.criteria) {
    if ((c.kind === "must" || c.kind === "prefer") && c.source === "answer" && c.value.length < 40 && !/budget|budżet/i.test(c.label)) {
      parts.push(c.value);
    }
  }
  return parts.join(" ").slice(0, 160);
}

const DRILLDOWN_LIMIT = 5;
const PROBE_LIMIT = 6;

export async function discover(state: RunState, emit: Emit): Promise<void> {
  const brief = state.request.brief;
  const query = buildQuery(brief);
  const maxPrice = brief.budget?.max;

  const [shopping, webHits] = await Promise.all([
    googleShopping(query, { num: 20, maxPrice }).then((r) => {
      emit({ type: "source_searched", channel: "serpapi", label: `Google Shopping (PL): ${r.length} offers for "${query}"` });
      return r;
    }),
    fcSearch(`${query} sklep`, { limit: 8 }).then((r) => {
      emit({ type: "source_searched", channel: "firecrawl", label: `Web search: ${r.length} store pages` });
      return r;
    }),
  ]);

  // SerpAPI → immersive drill-down for direct merchant offers (top N with tokens)
  const tokens = shopping.filter((r) => r.immersive_product_page_token).slice(0, DRILLDOWN_LIMIT);
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
  const toProbe = [...domains].slice(0, PROBE_LIMIT);
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
