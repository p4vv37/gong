import type { Field, Merchant, MerchantPolicy, Offer, Product } from "../../contract";
import type { FcScrapeResult } from "../connectors/firecrawl";
import type { JsonLdProduct } from "../connectors/jsonld";
import type { ImmersiveStore } from "../connectors/serpapi";
import { domainOf, merchantIdFromDomain, offerId, productId } from "./ids";
import { parseFreeShipping, parseInStock, parseReturnDays, parseZl } from "./polish";

const now = () => new Date().toISOString();

function conditionFromTitle(title: string): "new" | "used" | "refurbished" {
  if (/second\s*life|używan|uzywan|po\s+zwrocie|odnowion|refurb/i.test(title)) return "used";
  return "new";
}

function field<T>(value: T | undefined, partial: Omit<Field<T>, "value" | "observedAt"> & { observedAt?: string }): Field<T> {
  return { value, observedAt: now(), ...partial };
}

export type Normalized = {
  merchant: Merchant;
  product: Product;
  offer: Offer;
  policyPatch?: Partial<MerchantPolicy>;
};

/** SerpAPI immersive store row → entities. Direct link, price, shipping, sometimes returns. */
export function fromImmersiveStore(store: ImmersiveStore, category: string): Normalized | undefined {
  if (!store.link || !store.title || store.extracted_price === undefined) return undefined;
  const domain = domainOf(store.link);
  const merchant: Merchant = {
    id: merchantIdFromDomain(domain),
    name: store.name ?? domain,
    domain,
    countryCode: domain.endsWith(".pl") ? "PL" : undefined,
  };
  const product: Product = { id: productId({ title: store.title }), title: store.title, category, specs: [] };

  const hints = (store.details_and_offers ?? []).join(" | ");
  const stockHint = parseInStock(hints);
  const shippingCost = store.shipping_extracted ?? (store.shipping ? parseZl(store.shipping) : undefined);

  const offer: Offer = {
    id: offerId(merchant.id, store.link),
    productId: product.id,
    merchantId: merchant.id,
    url: store.link,
    price: field({ amount: store.extracted_price, currency: "PLN" }, { confidence: 0.8, source: "serpapi", depth: "offer", evidenceUrl: store.link }),
    totalPrice:
      store.total_extracted !== undefined
        ? field({ amount: store.total_extracted, currency: "PLN" }, { confidence: 0.8, source: "serpapi", depth: "offer" })
        : undefined,
    availability: field(
      stockHint === true ? "in_stock" : stockHint === false ? "out_of_stock" : "unknown",
      { confidence: stockHint === undefined ? 0.2 : 0.7, source: "serpapi", depth: "offer" },
    ),
    condition: conditionFromTitle(store.title),
    delivery:
      shippingCost !== undefined
        ? field({ cost: { amount: shippingCost, currency: "PLN" } }, { confidence: 0.7, source: "serpapi", depth: "offer", evidenceText: store.shipping ?? hints })
        : undefined,
  };

  const returnDays = parseReturnDays(hints);
  const policyPatch: Partial<MerchantPolicy> | undefined =
    returnDays !== undefined || parseFreeShipping(hints)
      ? {
          merchantId: merchant.id,
          ...(returnDays !== undefined
            ? { returns: field({ windowDays: returnDays }, { confidence: 0.6, source: "serpapi", depth: "offer", evidenceText: hints }) }
            : {}),
        }
      : undefined;

  return { merchant, product, offer, policyPatch };
}

/** JSON-LD rung: deterministic, free, high confidence. */
export function fromJsonLd(p: JsonLdProduct, url: string, category: string): Normalized | undefined {
  const best = p.offers.find((o) => o.price !== undefined) ?? p.offers[0];
  if (!p.name || !best) return undefined;
  const domain = domainOf(url);
  const merchant: Merchant = { id: merchantIdFromDomain(domain), name: domain, domain, countryCode: domain.endsWith(".pl") ? "PL" : undefined };
  const product: Product = {
    id: productId({ gtin: p.gtin, brand: p.brand, title: p.name }),
    title: p.name,
    brand: p.brand,
    gtin: p.gtin,
    mpn: p.mpn,
    category,
    specs: [],
    imageUrl: p.image,
  };
  const offer: Offer = {
    id: offerId(merchant.id, url),
    productId: product.id,
    merchantId: merchant.id,
    url,
    price: field(
      best.price !== undefined ? { amount: best.price, currency: best.priceCurrency ?? "PLN" } : undefined,
      { confidence: best.price !== undefined ? 0.95 : 0, source: "jsonld", depth: "page", evidenceUrl: url },
    ),
    availability: field(best.availability ?? "unknown", {
      confidence: best.availability && best.availability !== "unknown" ? 0.9 : 0.2,
      source: "jsonld",
      depth: "page",
    }),
    condition: /used|refurb/i.test(best.itemCondition ?? "") ? "used" : "new",
  };
  return { merchant, product, offer };
}

/** Firecrawl `product` format rung: LLM-backed, good coverage on blocked/JS pages. */
export function fromFcProduct(doc: FcScrapeResult, url: string, category: string): Normalized | undefined {
  const p = doc.product as
    | {
        title?: string;
        description?: string;
        brand?: string;
        variants?: { sku?: string; price?: { amount?: number; currency?: string }; availability?: { inStock?: boolean } }[];
      }
    | undefined;
  const v = p?.variants?.[0];
  if (!p?.title || v?.price?.amount === undefined) return undefined;
  const domain = domainOf(url);
  const merchant: Merchant = { id: merchantIdFromDomain(domain), name: domain, domain, countryCode: domain.endsWith(".pl") ? "PL" : undefined };
  const product: Product = { id: productId({ brand: p.brand, title: p.title }), title: p.title, brand: p.brand, category, specs: [] };
  const offer: Offer = {
    id: offerId(merchant.id, url),
    productId: product.id,
    merchantId: merchant.id,
    url,
    price: field({ amount: v.price.amount, currency: v.price.currency ?? "PLN" }, { confidence: 0.8, source: "firecrawl_product", depth: "page", evidenceUrl: url }),
    availability: field(
      v.availability?.inStock === true ? "in_stock" : v.availability?.inStock === false ? "out_of_stock" : "unknown",
      { confidence: v.availability ? 0.75 : 0.2, source: "firecrawl_product", depth: "page" },
    ),
    condition: "new",
  };
  return { merchant, product, offer };
}
