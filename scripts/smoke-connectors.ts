import { inspect } from "node:util";
import { fcScrape, fcSearch } from "../src/server/connectors/firecrawl";
import { extractProductJsonLd, fetchHtml } from "../src/server/connectors/jsonld";
import { googleShopping } from "../src/server/connectors/serpapi";
import { probeShopify } from "../src/server/connectors/shopify";

/**
 * One real call per connector; results land in data/cache (auto mode), so
 * reruns are free. Run: . ../../.envrc && npx tsx scripts/smoke-connectors.ts
 */

const show = (label: string, v: unknown) =>
  console.log(`\n===== ${label}\n${inspect(v, { depth: 4, maxArrayLength: 3, maxStringLength: 160 })}`);

async function main() {
  // 1. SerpAPI Google Shopping (PL)
  const shopping = await googleShopping("kurtka przeciwdeszczowa męska", { num: 10, maxPrice: 400 });
  show(`serpapi google_shopping — ${shopping.length} results`, shopping.slice(0, 3));

  // 2. Firecrawl search (PL market, no scraping)
  const hits = await fcSearch("kurtka przeciwdeszczowa sklep", { limit: 5 });
  show(`firecrawl search — ${hits.length} hits`, hits.slice(0, 3).map(({ markdown: _m, ...rest }) => rest));

  // 3. Direct fetch + JSON-LD on the first shopping result with a direct link
  const target = shopping.find((r) => r.link && !r.link.includes("google."))?.link ?? hits[0]?.url;
  if (target) {
    const page = await fetchHtml(target);
    const products = page.html ? extractProductJsonLd(page.html) : [];
    show(`jsonld @ ${target} (HTTP ${page.status}) — ${products.length} product nodes`, products.slice(0, 2));

    // 4. Firecrawl scrape with product format on the same URL (compare paths)
    const doc = await fcScrape(target, ["product"]);
    show(`firecrawl product format @ ${target}`, {
      metadata: doc.metadata,
      product: doc.product,
      keys: Object.keys(doc as object),
    });
  } else {
    console.log("no scrape target found in discovery results");
  }

  // 5. Shopify probe on a known Shopify store
  const probe = await probeShopify("allbirds.com");
  show(`shopify probe allbirds.com — isShopify=${probe.isShopify} ucp=${probe.hasUcp}`, {
    firstProduct: probe.products?.[0]?.title,
    variants: probe.products?.[0]?.variants?.slice(0, 2),
  });
}

main().catch((err) => {
  console.error("SMOKE FAILED:", err);
  process.exit(1);
});
