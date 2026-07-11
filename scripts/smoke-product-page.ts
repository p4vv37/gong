import { inspect } from "node:util";
import { fcMap, fcScrape } from "../src/server/connectors/firecrawl";
import { extractProductJsonLd, fetchHtml } from "../src/server/connectors/jsonld";
import { immersiveProduct } from "../src/server/connectors/serpapi";
import { googleShopping } from "../src/server/connectors/serpapi";

/**
 * Validates the extraction ladder on a real PL product page + the SerpAPI
 * store drill-down. Run: . ../../.envrc && npx tsx scripts/smoke-product-page.ts
 */

const show = (label: string, v: unknown) =>
  console.log(`\n===== ${label}\n${inspect(v, { depth: 5, maxArrayLength: 4, maxStringLength: 200 })}`);

async function main() {
  // A. find a concrete product page on a friendly PL store
  const links = await fcMap("https://militaria.pl", "kurtka przeciwdeszczowa");
  const productUrl = links.find((l) => /\/p\/|\/produkt|\d{4,}/.test(l.url))?.url ?? links[2]?.url;
  show(`map militaria.pl — ${links.length} links, picked`, { productUrl, sample: links.slice(0, 4) });
  if (!productUrl) return;

  // B. rung 1: direct fetch + JSON-LD
  const page = await fetchHtml(productUrl);
  const jsonld = page.html ? extractProductJsonLd(page.html) : [];
  show(`rung1 jsonld (HTTP ${page.status}) — ${jsonld.length} products`, jsonld.slice(0, 2));

  // C. rung 2: firecrawl product format
  const doc = await fcScrape(productUrl, ["product"]);
  show("rung2 firecrawl product format", { product: doc.product, title: doc.metadata?.title });

  // D. SerpAPI immersive drill-down for direct store links
  const shopping = await googleShopping("kurtka przeciwdeszczowa męska", { num: 10, maxPrice: 400 });
  const token = shopping.find((r) => r.immersive_product_page_token)?.immersive_product_page_token;
  if (token) {
    const stores = await immersiveProduct(token);
    show(`immersive stores — ${stores.length}`, stores.slice(0, 4));
  } else {
    console.log("no immersive token in shopping results");
  }
}

main().catch((err) => {
  console.error("SMOKE FAILED:", err);
  process.exit(1);
});
