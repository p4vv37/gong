import { Agent, run } from "@openai/agents";
import { z } from "zod";
import type { Field, MerchantPolicy } from "../../contract";
import type { PolicyPageText } from "../pipeline/deepen";
import type { RunState } from "../pipeline/state";
import { MODELS } from "./client";

/**
 * LLM upgrade over the heuristic policy extraction: reads the same cached
 * policy pages and produces structured shipping/returns/payment facts with
 * short evidence quotes. Confidence 0.85 (vs 0.55 heuristic) — higher wins
 * at merge time.
 */

const PolicyOutput = z.object({
  shipping: z
    .object({
      costPln: z.number().nullable(),
      freeAbovePln: z.number().nullable(),
      etaDaysMin: z.number().nullable(),
      etaDaysMax: z.number().nullable(),
      methods: z.array(z.string()),
    })
    .nullable(),
  returns: z
    .object({
      windowDays: z.number().nullable(),
      freeReturns: z.boolean().nullable(),
      notes: z.string().nullable(),
    })
    .nullable(),
  paymentMethods: z.array(z.string()),
  evidenceQuote: z.string().nullable(),
});

const policyReader = new Agent({
  name: "policy-reader",
  model: MODELS.fast,
  instructions:
    "You read online store policy pages (Polish or English) and extract shipping, returns and payment facts. " +
    "Report ONLY what the text explicitly states — never guess. Unknown means null. " +
    "Amounts in PLN. If several shipping methods exist, report the cheapest standard one and list method names.",
  outputType: PolicyOutput,
});

function field<T>(value: T, url: string | undefined, quote: string | null): Field<T> {
  return {
    value,
    confidence: 0.85,
    source: "policy_page",
    depth: "merchant",
    observedAt: new Date().toISOString(),
    evidenceUrl: url,
    evidenceText: quote ?? undefined,
  };
}

export async function upgradePolicyWithLlm(state: RunState, merchantId: string, pages: PolicyPageText[]): Promise<string[]> {
  if (!pages.length) return [];
  const merchant = state.merchants.get(merchantId);
  const corpus = pages.map((p) => `--- ${p.url}\n${p.text.slice(0, 7000)}`).join("\n\n");

  const result = await run(policyReader, `Store: ${merchant?.domain ?? merchantId}\n\nPolicy pages:\n${corpus}`);
  const out = result.finalOutput;
  if (!out) return [];

  const unknownField = { confidence: 0, source: "none" as const, depth: "merchant" as const, observedAt: new Date().toISOString() };
  const policy: MerchantPolicy = state.policies.get(merchantId) ?? {
    merchantId,
    shipping: { ...unknownField },
    returns: { ...unknownField },
    payment: { ...unknownField },
  };
  const url = pages[0]?.url;
  const learned: string[] = [];

  if (out.shipping && (out.shipping.costPln !== null || out.shipping.etaDaysMin !== null || out.shipping.freeAbovePln !== null)) {
    policy.shipping = field(
      {
        ...(out.shipping.costPln !== null ? { cost: { amount: out.shipping.costPln, currency: "PLN" } } : {}),
        ...(out.shipping.freeAbovePln !== null ? { freeAbove: { amount: out.shipping.freeAbovePln, currency: "PLN" } } : {}),
        ...(out.shipping.etaDaysMin !== null && out.shipping.etaDaysMax !== null
          ? { etaDays: [out.shipping.etaDaysMin, out.shipping.etaDaysMax] as [number, number] }
          : {}),
        ...(out.shipping.methods.length ? { methods: out.shipping.methods } : {}),
      },
      url,
      out.evidenceQuote,
    );
    learned.push("shipping");
  }
  if (out.returns && out.returns.windowDays !== null) {
    policy.returns = field(
      { windowDays: out.returns.windowDays, ...(out.returns.freeReturns !== null ? { freeReturns: out.returns.freeReturns } : {}), ...(out.returns.notes ? { notes: out.returns.notes } : {}) },
      url,
      out.evidenceQuote,
    );
    learned.push("returns");
  }
  if (out.paymentMethods.length >= 2) {
    policy.payment = field(out.paymentMethods, url, null);
    learned.push("payment");
  }

  state.policies.set(merchantId, policy);
  return learned;
}
