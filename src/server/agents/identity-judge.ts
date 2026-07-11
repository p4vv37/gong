import { Agent, run } from "@openai/agents";
import { z } from "zod";
import type { Product } from "../../contract";
import { MODELS } from "./client";

/**
 * Confirms which candidate products are truly the SAME purchasable item.
 * Conservative by instruction: variant differences that change what arrives
 * in the box (storage, size, generation, color when it affects the SKU)
 * mean DIFFERENT products.
 */

const IdentityOutput = z.object({
  groups: z.array(z.array(z.string())), // each inner array: product ids that are the same item
});

const identityJudge = new Agent({
  name: "identity-judge",
  model: MODELS.fast,
  instructions:
    "You decide which product listings refer to the exact same purchasable item (same brand, model, generation and " +
    "variant), despite different titles, languages or word order. Group ONLY when you are confident from the given " +
    "data — different storage/size/generation/tier means different items; when unsure, keep listings separate. " +
    "Return groups of ids; singletons may be omitted. Never invent ids.",
  outputType: IdentityOutput,
});

export async function judgeIdentity(clusters: Product[][]): Promise<string[][]> {
  const payload = clusters.map((group, i) => ({
    cluster: i,
    listings: group.map((p) => ({ id: p.id, title: p.title, brand: p.brand, gtin: p.gtin })),
  }));
  const result = await run(
    identityJudge,
    `Candidate clusters (judge each independently; only group ids within the same cluster):\n${JSON.stringify(payload, null, 1)}`,
  );
  const valid = new Set(clusters.flat().map((p) => p.id));
  return (result.finalOutput?.groups ?? [])
    .map((g) => g.filter((id) => valid.has(id)))
    .filter((g) => g.length > 1);
}
