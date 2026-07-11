import { Firecrawl } from "firecrawl";
import { cached } from "../cache";
import { firecrawlKey, requireKey } from "../env";

/**
 * Firecrawl wrappers. Everything goes through the record/replay cache, so
 * SDK responses are stored as plain JSON. Response typing is deliberately
 * loose — normalizers probe defensively.
 */

let client: Firecrawl | undefined;
function fc(): Firecrawl {
  client ??= new Firecrawl({ apiKey: requireKey(firecrawlKey, "FIRECRAWL_API_KEY") });
  return client;
}

export type FcSearchHit = {
  url?: string;
  title?: string;
  description?: string;
  markdown?: string;
};

export async function fcSearch(
  query: string,
  opts: { limit?: number; country?: string; location?: string; scrapeMarkdown?: boolean } = {},
): Promise<FcSearchHit[]> {
  const { limit = 10, country = "PL", location = "Poland", scrapeMarkdown = false } = opts;
  return cached("firecrawl.search", { query, limit, country, location, scrapeMarkdown }, async () => {
    const res = (await fc().search(query, {
      limit,
      country,
      location,
      ...(scrapeMarkdown ? { scrapeOptions: { formats: ["markdown"] } } : {}),
    } as never)) as unknown as { web?: FcSearchHit[] };
    return res.web ?? [];
  });
}

export type FcScrapeResult = {
  markdown?: string;
  rawHtml?: string;
  product?: Record<string, unknown>;
  json?: Record<string, unknown>;
  metadata?: { title?: string; sourceURL?: string; statusCode?: number };
  links?: string[];
};

export type FcFormat =
  | "markdown"
  | "rawHtml"
  | "links"
  | "product"
  | { type: "json"; prompt?: string; schema?: Record<string, unknown> };

export async function fcScrape(url: string, formats: FcFormat[]): Promise<FcScrapeResult> {
  // cache key uses only format discriminators, not full json schemas
  const formatKey = formats.map((f) => (typeof f === "string" ? f : `json:${f.prompt ?? ""}`));
  return cached("firecrawl.scrape", { url, formatKey }, async () => {
    const doc = await fc().scrape(url, {
      formats: formats as never,
      proxy: "auto",
      location: { country: "PL", languages: ["pl"] },
      timeout: 60_000,
    } as never);
    return doc as unknown as FcScrapeResult;
  });
}

export async function fcMap(domainUrl: string, search?: string): Promise<{ url: string; title?: string }[]> {
  return cached("firecrawl.map", { domainUrl, search }, async () => {
    const res = (await fc().map(domainUrl, { search, limit: 60 } as never)) as unknown as {
      links?: ({ url: string; title?: string } | string)[];
    };
    return (res.links ?? []).map((l) => (typeof l === "string" ? { url: l } : l));
  });
}
