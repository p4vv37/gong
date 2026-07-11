import { Agent, run } from "@openai/agents";
import { z } from "zod";
import type { Recommendation } from "../../contract";
import type { RunState } from "../pipeline/state";
import { MODELS } from "./client";

/**
 * Recommendation prose: turns deterministic ranking results into clear,
 * honest one-liners in the user's language. The LLM explains; it never
 * changes which offers were picked or their numbers.
 */

const WriterOutput = z.object({
  items: z.array(
    z.object({
      offerId: z.string(),
      headline: z.string(),
      whyNotTheOthers: z.string().nullable(),
    }),
  ),
});

const writer = new Agent({
  name: "recommendation-writer",
  model: MODELS.smart,
  instructions:
    "You write one-sentence purchase recommendations. Use the same language as the user's request. " +
    "Be concrete (product, store, delivered price) and honest about compromises and unverified facts. " +
    "Never invent facts not present in the input. Keep each headline under 200 characters.",
  outputType: WriterOutput,
});

export async function polishRecommendations(state: RunState, recs: Recommendation[]): Promise<void> {
  if (!recs.length) return;
  const payload = recs.map((rec) => {
    const offer = state.offers.get(rec.offerId);
    const product = offer && state.products.get(offer.productId);
    const merchant = offer && state.merchants.get(offer.merchantId);
    const policy = offer && state.policies.get(offer.merchantId);
    return {
      offerId: rec.offerId,
      role: rec.role,
      product: product?.title,
      condition: offer?.condition,
      merchant: merchant?.name,
      price: offer?.price.value,
      shipping: offer?.delivery?.value?.cost ?? policy?.shipping.value?.cost,
      returnsDays: policy?.returns.value?.windowDays,
      compromises: rec.compromises,
      unknowns: rec.unknowns,
    };
  });

  const result = await run(
    writer,
    `User request: ${state.request.brief.request}\n\nPicked offers (do not reorder, one headline each):\n${JSON.stringify(payload, null, 1)}`,
  );
  if (!result.finalOutput) return;

  for (const item of result.finalOutput.items) {
    const rec = recs.find((r) => r.offerId === item.offerId);
    if (rec && item.headline) {
      rec.headline = item.headline;
      rec.whyNotTheOthers = item.whyNotTheOthers ?? rec.whyNotTheOthers;
    }
  }
}
