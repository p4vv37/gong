import { Agent, run } from "@openai/agents";
import { z } from "zod";
import type { PurchaseBrief } from "../../contract";
import { MODELS } from "./client";

/**
 * Store-intent query synthesis. The user writes in any language; searches
 * must be phrased the way the TARGET MARKET shops (brief.market decides the
 * language — Polish market → Polish queries), concise, and buy-oriented.
 * Cached per brief upstream via the run flow (one call per run).
 */

const QueryOutput = z.object({
  shoppingQuery: z.string(), // for Google Shopping: product terms only
  webQuery: z.string(), // for web search: store-intent phrasing ("sklep", "kup")
});

const querySynth = new Agent({
  name: "query-synth",
  model: MODELS.fast,
  instructions:
    "You turn a purchase brief into search queries for the target market. " +
    "Write queries in the market's dominant shopping language (Poland → Polish), regardless of the brief's language. " +
    "shoppingQuery: 3-6 product words for a shopping engine — no filler, no price, brand only if the user named one. " +
    "webQuery: the same terms plus store intent (e.g. 'sklep' / 'kup online'). " +
    "Never invent attributes the user did not state.",
  outputType: QueryOutput,
});

export async function synthesizeQueries(brief: PurchaseBrief): Promise<{ shoppingQuery: string; webQuery: string } | undefined> {
  const criteria = brief.criteria
    .filter((c) => c.kind === "must" || c.kind === "prefer")
    .map((c) => `${c.label}: ${c.value}`)
    .join("; ");
  const result = await run(
    querySynth,
    `Market: ${brief.market.country} (${brief.market.currency})\nRequest: ${brief.request}\nCriteria: ${criteria || "none"}`,
  );
  const out = result.finalOutput;
  if (!out?.shoppingQuery?.trim() || !out.webQuery?.trim()) return undefined;
  return { shoppingQuery: out.shoppingQuery.trim().slice(0, 120), webQuery: out.webQuery.trim().slice(0, 120) };
}
