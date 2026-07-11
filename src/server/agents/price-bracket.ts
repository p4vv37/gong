import { Agent, run, webSearchTool } from "@openai/agents";
import { z } from "zod";
import type { PriceBracket, PurchaseBrief } from "../../contract";
import { cached } from "../cache";
import { MODELS } from "./client";

/**
 * Warranted price bracket: what the category actually costs on the target
 * market. Deliberately INDEPENDENT of offer discovery — it researches via
 * OpenAI's hosted web search (price guides, rankings, market overviews), a
 * separate channel from the SerpAPI/Firecrawl offer pipeline, so a skewed
 * scrape pool can never redefine the market. Cached per (query, market).
 */

const BracketOutput = z.object({
  low: z.number(), // decent entry-level price
  typicalMin: z.number(),
  typicalMax: z.number(),
  premium: z.number(),
  currency: z.string(),
  summary: z.string(), // one sentence, user's language
  confidence: z.number(), // 0..1, honest
});

const bracketAgent = new Agent({
  name: "price-bracket",
  model: MODELS.fast,
  instructions:
    "You establish the realistic market price bracket for a product category on a given market, using web search " +
    "over price guides, rankings and market overviews — NOT single shop offers. Prices in the market's currency. " +
    "low = cheapest sensible entry-level of acceptable quality; typicalMin..typicalMax = where most solid mainstream " +
    "options sit; premium = above this is specialist/luxury territory. Respect the user's stated requirements — a " +
    "spec-heavy request shifts the bracket up. Be honest in confidence when sources are thin. Never invent numbers " +
    "without search evidence. Write the summary in the same language as the user's request.",
  tools: [webSearchTool({ userLocation: { type: "approximate", country: "PL" } })],
  outputType: BracketOutput,
  modelSettings: { toolChoice: "required" },
});

export async function researchPriceBracket(brief: PurchaseBrief): Promise<PriceBracket | undefined> {
  const mustHaves = brief.criteria
    .filter((c) => (c.kind === "must" || c.kind === "prefer") && !/budget|budżet/i.test(c.label))
    .map((c) => `${c.label}: ${c.value}`)
    .join("; ");
  const cacheKey = { query: brief.request, mustHaves, country: brief.market.country };

  const bracket = await cached("llm.price_bracket", cacheKey, async () => {
    const result = await run(
      bracketAgent,
      `Market: ${brief.market.country}, currency ${brief.market.currency}.\n` +
        `Product request: ${brief.request}\nRequirements: ${mustHaves || "none stated"}\n` +
        `What is the realistic market price bracket for this?`,
    );
    const out = result.finalOutput;
    if (!out || out.typicalMin > out.typicalMax || out.low <= 0) return undefined;
    const sources = [
      // hosted-tool source items when the API returns them...
      ...result.newItems
        .flatMap((item) => ("rawItem" in item && (item.rawItem as { action?: { sources?: { url?: string }[] } }).action?.sources) || [])
        .map((s) => s.url)
        .filter((u): u is string => Boolean(u)),
      // ...plus citation links the model embeds in the summary markdown
      ...[...out.summary.matchAll(/\((https?:\/\/[^\s)]+)\)/g)].map((m) => m[1]),
    ];
    const b: PriceBracket = {
      query: brief.request,
      currency: out.currency || brief.market.currency,
      low: out.low,
      typical: [out.typicalMin, out.typicalMax],
      premium: out.premium,
      summary: out.summary,
      sources: [...new Set(sources)].slice(0, 5),
      confidence: Math.max(0, Math.min(1, out.confidence)),
      observedAt: new Date().toISOString(),
    };
    return b;
  });

  if (!bracket) return undefined;
  return { ...bracket, budgetAssessment: assessBudget(brief, bracket) };
}

export function assessBudget(brief: PurchaseBrief, bracket: PriceBracket): PriceBracket["budgetAssessment"] {
  const max = brief.budget?.max;
  if (max === undefined) return undefined;
  if (max < bracket.low) return "below_market";
  if (max < bracket.typical[0]) return "tight";
  if (max <= bracket.typical[1]) return "within_typical";
  return "above_typical";
}
