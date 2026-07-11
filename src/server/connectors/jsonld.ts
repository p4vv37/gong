import * as cheerio from "cheerio";
import { cached } from "../cache";

/**
 * Deterministic extraction: schema.org Product/Offer from JSON-LD script
 * tags. This is the free, LLM-less fast path — platform stores (Shopify,
 * WooCommerce, most PL retailers) emit price/currency/availability here.
 * Shipping/returns usually are NOT here; those come from policy deep-reads.
 */

export type JsonLdOffer = {
  price?: number;
  priceCurrency?: string;
  availability?: "in_stock" | "out_of_stock" | "preorder" | "unknown";
  itemCondition?: string;
  priceValidUntil?: string;
  lowPrice?: number;
  highPrice?: number;
  offerCount?: number;
};

export type JsonLdProduct = {
  name?: string;
  brand?: string;
  gtin?: string;
  mpn?: string;
  sku?: string;
  image?: string;
  description?: string;
  aggregateRating?: { ratingValue?: number; reviewCount?: number };
  offers: JsonLdOffer[];
};

function asArray<T>(v: T | T[] | undefined | null): T[] {
  return v == null ? [] : Array.isArray(v) ? v : [v];
}

function num(v: unknown): number | undefined {
  if (typeof v === "number" && Number.isFinite(v)) return v;
  if (typeof v === "string") {
    const n = Number(v.replace(",", ".").replace(/[^\d.-]/g, ""));
    return Number.isFinite(n) ? n : undefined;
  }
  return undefined;
}

function str(v: unknown): string | undefined {
  if (typeof v === "string") return v;
  if (v && typeof v === "object" && "name" in v) return str((v as { name: unknown }).name);
  return undefined;
}

function mapAvailability(v: unknown): JsonLdOffer["availability"] {
  const s = String(v ?? "").toLowerCase();
  if (s.includes("instock") || s.includes("instoreonly") || s.includes("onlineonly")) return "in_stock";
  if (s.includes("outofstock") || s.includes("soldout") || s.includes("discontinued")) return "out_of_stock";
  if (s.includes("preorder") || s.includes("presale") || s.includes("backorder")) return "preorder";
  return "unknown";
}

function parseOffer(o: Record<string, unknown>): JsonLdOffer {
  return {
    price: num(o.price),
    priceCurrency: str(o.priceCurrency),
    availability: mapAvailability(o.availability),
    itemCondition: str(o.itemCondition),
    priceValidUntil: str(o.priceValidUntil),
    lowPrice: num(o.lowPrice),
    highPrice: num(o.highPrice),
    offerCount: num(o.offerCount),
  };
}

function isProductNode(node: Record<string, unknown>): boolean {
  return asArray(node["@type"]).some((t) => String(t).toLowerCase() === "product");
}

/** Walk arbitrary JSON-LD (single node, array, @graph) collecting Product nodes. */
function collectProducts(root: unknown, out: Record<string, unknown>[]): void {
  for (const node of asArray(root)) {
    if (!node || typeof node !== "object") continue;
    const obj = node as Record<string, unknown>;
    if (isProductNode(obj)) out.push(obj);
    if (obj["@graph"]) collectProducts(obj["@graph"], out);
  }
}

export function extractProductJsonLd(html: string): JsonLdProduct[] {
  const $ = cheerio.load(html);
  const nodes: Record<string, unknown>[] = [];

  $('script[type="application/ld+json"]').each((_, el) => {
    const text = $(el).text();
    if (!text?.trim()) return;
    try {
      collectProducts(JSON.parse(text), nodes);
    } catch {
      // malformed JSON-LD is common in the wild; skip silently
    }
  });

  return nodes.map((p) => {
    const rating = (p.aggregateRating ?? undefined) as Record<string, unknown> | undefined;
    const offerNodes = asArray<unknown>(p.offers).flatMap((o) => {
      if (!o || typeof o !== "object") return [];
      const obj = o as Record<string, unknown>;
      // AggregateOffer may nest concrete offers
      const nested = asArray<unknown>(obj.offers).filter(
        (x): x is Record<string, unknown> => !!x && typeof x === "object",
      );
      return nested.length ? [obj, ...nested] : [obj];
    });
    return {
      name: str(p.name),
      brand: str(p.brand),
      gtin: str(p.gtin13 ?? p.gtin14 ?? p.gtin12 ?? p.gtin8 ?? p.gtin),
      mpn: str(p.mpn),
      sku: str(p.sku),
      image: str(Array.isArray(p.image) ? p.image[0] : p.image),
      description: str(p.description)?.slice(0, 500),
      aggregateRating: rating
        ? { ratingValue: num(rating.ratingValue), reviewCount: num(rating.reviewCount ?? rating.ratingCount) }
        : undefined,
      offers: offerNodes.map(parseOffer),
    };
  });
}

const USER_AGENT = "gong-purchasing-agent/0.1 (+hackathon demo; contact: repo owner)";

export type FetchedPage = { status: number; html?: string; finalUrl?: string };

/** Cheap direct fetch for the deterministic path; blocked/JS-only pages fall back to Firecrawl. */
export async function fetchHtml(url: string): Promise<FetchedPage> {
  return cached("fetch.html", { url }, async () => {
    try {
      const res = await fetch(url, {
        headers: { "user-agent": USER_AGENT, accept: "text/html,application/xhtml+xml" },
        redirect: "follow",
        signal: AbortSignal.timeout(15_000),
      });
      const ct = res.headers.get("content-type") ?? "";
      if (!ct.includes("html")) return { status: res.status, finalUrl: res.url };
      return { status: res.status, html: await res.text(), finalUrl: res.url };
    } catch {
      return { status: 0 };
    }
  });
}
