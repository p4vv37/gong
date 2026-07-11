import { cached } from "../cache";
import { requireKey, serpapiKey } from "../env";

/**
 * SerpAPI Google Shopping — the structured-discovery workhorse. Returns
 * merchant, price, delivery and rating per offer without any scraping.
 */

export type ShoppingResult = {
  position?: number;
  title?: string;
  link?: string;
  product_link?: string;
  product_id?: string;
  source?: string; // merchant display name
  price?: string;
  extracted_price?: number;
  old_price?: string;
  rating?: number;
  reviews?: number;
  delivery?: string;
  thumbnail?: string;
  second_hand_condition?: string;
  immersive_product_page_token?: string;
  multiple_sources?: boolean;
};

export type ImmersiveStore = {
  name?: string;
  link?: string; // direct merchant product URL
  title?: string;
  tag?: string; // "Najlepsza cena" etc.
  details_and_offers?: string[]; // e.g. ["W magazynie, online", "Dostawa 12,99 zł", "Zwroty do 14 dni"]
  price?: string;
  extracted_price?: number;
  shipping?: string;
  shipping_extracted?: number;
  total?: string;
  total_extracted?: number;
  rating?: number;
  reviews?: number;
  payment_methods?: string;
};

/**
 * Google Shopping results usually carry no direct merchant URL — the
 * immersive-product drill-down returns the per-store offer list (price,
 * shipping, total, direct link). One SerpAPI credit per call, so the
 * pipeline calls it only for shortlisted candidates.
 */
export async function immersiveProduct(pageToken: string): Promise<ImmersiveStore[]> {
  return cached("serpapi.immersive_product", { pageToken }, async () => {
    const params = new URLSearchParams({
      engine: "google_immersive_product",
      page_token: pageToken,
      api_key: requireKey(serpapiKey, "SERPAPI_API_KEY"),
    });
    const res = await fetch(`https://serpapi.com/search.json?${params}`, {
      signal: AbortSignal.timeout(30_000),
    });
    if (!res.ok) throw new Error(`SerpAPI HTTP ${res.status}`);
    const body = (await res.json()) as {
      error?: string;
      stores?: ImmersiveStore[];
      product_results?: { stores?: ImmersiveStore[] };
    };
    if (body.error) throw new Error(`SerpAPI: ${body.error}`);
    return body.stores ?? body.product_results?.stores ?? [];
  });
}

export type GoogleShoppingOptions = {
  gl?: string; // country, default "pl"
  hl?: string; // language, default "pl"
  num?: number; // max results
  minPrice?: number;
  maxPrice?: number;
};

export async function googleShopping(
  query: string,
  opts: GoogleShoppingOptions = {},
): Promise<ShoppingResult[]> {
  const { gl = "pl", hl = "pl", num = 20, minPrice, maxPrice } = opts;

  return cached("serpapi.google_shopping", { query, gl, hl, num, minPrice, maxPrice }, async () => {
    const params = new URLSearchParams({
      engine: "google_shopping",
      q: query,
      gl,
      hl,
      num: String(num),
      api_key: requireKey(serpapiKey, "SERPAPI_API_KEY"),
    });
    if (minPrice !== undefined) params.set("min_price", String(minPrice));
    if (maxPrice !== undefined) params.set("max_price", String(maxPrice));

    const res = await fetch(`https://serpapi.com/search.json?${params}`, {
      signal: AbortSignal.timeout(30_000),
    });
    if (!res.ok) throw new Error(`SerpAPI HTTP ${res.status}`);
    const body = (await res.json()) as { error?: string; shopping_results?: ShoppingResult[] };
    if (body.error && !/hasn't returned any results/i.test(body.error)) {
      throw new Error(`SerpAPI: ${body.error}`);
    }
    return body.shopping_results ?? [];
  });
}
