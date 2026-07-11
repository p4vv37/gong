import { cached } from "../cache";

/**
 * Shopify fast path: stores expose machine-readable offers today —
 * /products.json (catalog with variants, prices, availability) and, since
 * spring 2026, /.well-known/ucp. When a discovered domain is Shopify, we get
 * structured offers with zero scraping and zero LLM cost.
 */

export type ShopifyVariant = {
  id?: number;
  title?: string;
  price?: string;
  available?: boolean;
  sku?: string;
  option1?: string | null;
  option2?: string | null;
};

export type ShopifyProduct = {
  id?: number;
  title?: string;
  handle?: string;
  vendor?: string;
  product_type?: string;
  variants?: ShopifyVariant[];
  images?: { src?: string }[];
};

export type ShopifyProbe = {
  domain: string;
  isShopify: boolean;
  hasUcp: boolean;
  products?: ShopifyProduct[];
};

const HEADERS = {
  "user-agent": "gong-purchasing-agent/0.1 (+hackathon demo)",
  accept: "application/json",
};

export async function probeShopify(domain: string): Promise<ShopifyProbe> {
  return cached("shopify.probe", { domain }, async () => {
    const base = `https://${domain.replace(/^https?:\/\//, "").replace(/\/.*$/, "")}`;
    const out: ShopifyProbe = { domain, isShopify: false, hasUcp: false };

    try {
      const res = await fetch(`${base}/products.json?limit=5`, {
        headers: HEADERS,
        signal: AbortSignal.timeout(8_000),
      });
      if (res.ok && (res.headers.get("content-type") ?? "").includes("json")) {
        const body = (await res.json()) as { products?: ShopifyProduct[] };
        if (Array.isArray(body.products)) {
          out.isShopify = true;
          out.products = body.products;
        }
      }
    } catch {
      // not reachable or not Shopify — fine
    }

    try {
      const res = await fetch(`${base}/.well-known/ucp`, {
        headers: HEADERS,
        signal: AbortSignal.timeout(6_000),
      });
      out.hasUcp = res.ok;
    } catch {
      // no UCP — fine
    }

    return out;
  });
}
