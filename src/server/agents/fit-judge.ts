import { Agent, run } from "@openai/agents";
import { z } from "zod";
import type { RunState } from "../pipeline/state";
import { MODELS } from "./client";

/**
 * LLM preference-fit judging: replaces keyword matching with semantic
 * verdicts per (offer, criterion). One batched call per run. "contradicted"
 * on a must-criterion becomes a real violation in ranking — something
 * keyword matching can never establish.
 */

export type FitVerdict = "matched" | "contradicted" | "unknown";

const JudgeOutput = z.object({
  offers: z.array(
    z.object({
      offerId: z.string(),
      verdicts: z.array(
        z.object({
          criterionId: z.string(),
          verdict: z.enum(["matched", "contradicted", "unknown"]),
        }),
      ),
    }),
  ),
});

const fitJudge = new Agent({
  name: "fit-judge",
  model: MODELS.fast,
  instructions:
    "You judge whether product offers satisfy user criteria. For every offer and every criterion return a verdict: " +
    "'matched' when the product clearly satisfies it, 'contradicted' when it clearly violates it, 'unknown' when the " +
    "listing does not say. Judge only from the given titles/attributes — no outside knowledge about specific SKUs, " +
    "and never assume an unstated attribute: when in doubt, 'unknown' is the correct answer, not a guess. " +
    "Exception — generation/recency criteria are STRICT: when the user requires the newest/current generation or a " +
    "specific model tier and the listing clearly names an older generation or different tier, that is 'contradicted', " +
    "not 'unknown'. Polish product names are common; understand them.",
  outputType: JudgeOutput,
});

const JUDGE_LIMIT = 15;

export async function judgeFit(state: RunState): Promise<void> {
  const criteria = state.request.brief.criteria.filter((c) => !/budget|budżet/i.test(c.label));
  if (!criteria.length || !state.offers.size) return;

  const offers = [...state.offers.values()].slice(0, JUDGE_LIMIT).map((o) => {
    const p = state.products.get(o.productId);
    return {
      offerId: o.id,
      title: p?.title ?? "",
      brand: p?.brand,
      condition: o.condition,
      specs: p?.specs.map((s) => `${s.aspectId}=${s.value}`).join(", "),
    };
  });

  const prompt =
    `User request: ${state.request.brief.request}\n\n` +
    `Criteria:\n${criteria.map((c) => `- id=${c.id} [${c.kind}] ${c.label}: ${c.value}`).join("\n")}\n\n` +
    `Offers:\n${offers.map((o) => JSON.stringify(o)).join("\n")}`;

  const result = await run(fitJudge, prompt);
  if (!result.finalOutput) return;

  state.fitJudgments = new Map();
  for (const row of result.finalOutput.offers) {
    const m = new Map<string, FitVerdict>();
    for (const v of row.verdicts) m.set(v.criterionId, v.verdict);
    state.fitJudgments.set(row.offerId, m);
  }
}
