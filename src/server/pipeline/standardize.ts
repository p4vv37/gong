import { fcMap, fcScrape } from "../connectors/firecrawl";
import { extractProductJsonLd, fetchHtml } from "../connectors/jsonld";
import { buildQuery } from "./discover";
import { domainOf } from "./ids";
import { fromFcProduct, fromJsonLd } from "./normalize";
import { applyNormalized, type Emit } from "./run-helpers";
import type { RunState } from "./state";

/**
 * Extraction ladder over candidate URLs from open-web discovery:
 *   rung 0 — listing/category pages expand into product URLs via site map
 *   rung 1 — direct fetch + JSON-LD (free, deterministic)
 *   rung 2 — Firecrawl `product` format (handles 403s and JS-rendered pages)
 */

const LADDER_CONCURRENCY = 4;
const LISTING_EXPANSIONS = 3; // domains
const PRODUCTS_PER_LISTING = 2;

const PRODUCT_PATH = /\/(p|produkt|product|prod)\/|-\d{4,}|\/dp\//i;

async function expandListings(state: RunState, emit: Emit): Promise<void> {
  const listingDomains = [...state.candidateUrls.keys()]
    .filter((u) => looksLikeListing(u))
    .map((u) => domainOf(u));
  const unique = [...new Set(listingDomains)].slice(0, LISTING_EXPANSIONS);
  const query = buildQuery(state.request.brief);

  await Promise.all(
    unique.map(async (domain) => {
      try {
        const links = await fcMap(`https://${domain}`, query);
        const productUrls = links.map((l) => l.url).filter((u) => PRODUCT_PATH.test(u)).slice(0, PRODUCTS_PER_LISTING);
        for (const u of productUrls) {
          if (!state.candidateUrls.has(u)) state.candidateUrls.set(u, `expanded from ${domain} listing`);
        }
        if (productUrls.length) {
          emit({ type: "source_searched", channel: "firecrawl", label: `${domain}: found ${productUrls.length} matching products in catalog` });
        }
      } catch {
        // listing expansion is opportunistic
      }
    }),
  );
}

export async function standardize(state: RunState, emit: Emit): Promise<void> {
  await expandListings(state, emit);
  const urls = [...state.candidateUrls.keys()]
    .filter((u) => !looksLikeListing(u))
    .slice(0, state.request.limits?.maxCandidates ?? 12);
  const queue = [...urls];

  async function worker(): Promise<void> {
    for (let url = queue.shift(); url; url = queue.shift()) {
      try {
        // rung 1
        const page = await fetchHtml(url);
        if (page.html) {
          const products = extractProductJsonLd(page.html);
          const n = products.map((p) => fromJsonLd(p, url, state.request.brief.category)).find(Boolean);
          if (n) {
            applyNormalized(state, n);
            emit({ type: "offer_normalized", offerId: n.offer.id, extractionSource: "jsonld", label: `${n.merchant.domain}: read structured data (price ${n.offer.price.value?.amount ?? "?"} ${n.offer.price.value?.currency ?? ""})` });
            continue;
          }
        }
        // rung 2 — Firecrawl product format
        const doc = await fcScrape(url, ["product"]);
        const n = fromFcProduct(doc, url, state.request.brief.category);
        if (n) {
          applyNormalized(state, n);
          emit({ type: "offer_normalized", offerId: n.offer.id, extractionSource: "firecrawl_product", label: `${n.merchant.domain}: extracted product data` });
          continue;
        }
        emit({ type: "warning", detail: `no product extracted: ${url}`, label: `Skipped ${new URL(url).hostname} (listing or unreadable page)` });
      } catch (err) {
        emit({ type: "warning", detail: String(err), label: `Failed to read ${url.slice(0, 60)}` });
      }
    }
  }

  await Promise.all(Array.from({ length: LADDER_CONCURRENCY }, worker));
}

function looksLikeListing(url: string): boolean {
  const path = (() => {
    try {
      return new URL(url).pathname;
    } catch {
      return url;
    }
  })();
  // heuristic: category paths are shallow or plural collections; product pages carry ids/slugs
  return /\/(c|category|kategoria|kolekcje?|collections?)\//i.test(path) || path.split("/").filter(Boolean).length <= 1;
}
