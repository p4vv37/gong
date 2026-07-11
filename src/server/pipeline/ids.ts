import { createHash } from "node:crypto";

export function shortHash(input: string): string {
  return createHash("sha256").update(input).digest("hex").slice(0, 12);
}

export function merchantIdFromDomain(domain: string): string {
  return `m-${domain.replace(/^www\./, "")}`;
}

export function domainOf(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return url.replace(/^https?:\/\/(www\.)?/, "").split("/")[0];
  }
}

const STOPWORDS = new Set(["the", "a", "i", "z", "na", "do", "dla", "and", "or", "-", "–"]);

export function normalizeTitle(title: string): string {
  return title
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[ł]/g, "l")
    .replace(/[^a-z0-9 ]/g, " ")
    .split(/\s+/)
    .filter((w) => w && !STOPWORDS.has(w))
    .sort()
    .join(" ");
}

/** Identity: GTIN when known, else brand+normalized-title hash. */
export function productId(p: { gtin?: string; brand?: string; title: string }): string {
  if (p.gtin) return `p-gtin-${p.gtin}`;
  return `p-${shortHash(`${(p.brand ?? "").toLowerCase()}|${normalizeTitle(p.title)}`)}`;
}

export function offerId(merchantId: string, url: string): string {
  return `o-${merchantId.slice(2, 14)}-${shortHash(url)}`;
}
