import type { Field, MerchantPolicy } from "../../contract";
import { llmEnabled } from "../agents/client";
import { fcMap, fcScrape } from "../connectors/firecrawl";
import { fetchHtml } from "../connectors/jsonld";
import type { Emit } from "./run-helpers";
import {
  parseDeliveryDays,
  parseFreeShipping,
  parseFreeShippingThreshold,
  parsePaymentMethods,
  parseReturnDays,
  parseZl,
} from "./polish";
import type { RunState } from "./state";

/**
 * Merchant-level deep dive: find the store's delivery/returns/payment pages,
 * read them, extract policies. Heuristic (regex) extraction runs first at
 * modest confidence; the LLM policy reader (agents layer) upgrades these
 * fields later from the same cached pages. One dive per merchant — results
 * attach to every offer from that merchant.
 */

const POLICY_PATH = /dostaw|wysylk|shipping|delivery|zwrot|return|reklamacj|platnosc|payment|regulamin|terms|faq|pomoc|help/i;
const PAGE_LIMIT = 3;

export type PolicyPageText = { url: string; text: string };

export async function deepenMerchant(state: RunState, offerId: string, emit: Emit): Promise<PolicyPageText[]> {
  const offer = state.offers.get(offerId);
  const merchant = offer && state.merchants.get(offer.merchantId);
  if (!offer || !merchant) return [];

  emit({ type: "deep_dive_started", merchantDomain: merchant.domain, offerId, label: `Reading ${merchant.name}'s delivery and returns pages…` });

  let policyUrls: string[] = [];
  try {
    const links = await fcMap(`https://${merchant.domain}`, "dostawa zwroty płatności regulamin");
    policyUrls = links
      .map((l) => l.url)
      .filter((u) => POLICY_PATH.test(u))
      .slice(0, PAGE_LIMIT);
  } catch (err) {
    emit({ type: "warning", detail: String(err), label: `Could not map ${merchant.domain}` });
  }

  const pages: PolicyPageText[] = [];
  for (const url of policyUrls) {
    try {
      const direct = await fetchHtml(url);
      if (direct.html) {
        pages.push({ url, text: htmlToText(direct.html) });
        continue;
      }
      const doc = await fcScrape(url, ["markdown"]);
      if (doc.markdown) pages.push({ url, text: doc.markdown });
    } catch {
      // page-level failures are fine; we report what we learned overall
    }
  }

  let learned = applyPolicyHeuristics(state, merchant.id, pages);

  // LLM upgrade over the same cached pages (higher-confidence fields win)
  if (llmEnabled() && pages.length) {
    try {
      const { upgradePolicyWithLlm } = await import("../agents/policy-reader");
      const llmLearned = await upgradePolicyWithLlm(state, merchant.id, pages);
      learned = [...new Set([...learned, ...llmLearned])];
    } catch (err) {
      emit({ type: "warning", detail: String(err), label: `${merchant.name}: policy reader failed, keeping heuristic facts` });
    }
  }

  emit({
    type: "deep_dive_completed",
    merchantDomain: merchant.domain,
    offerId,
    learned,
    label: learned.length
      ? `${merchant.name}: learned ${learned.join(", ")}`
      : `${merchant.name}: no policy pages found — offer stays flagged as unverified`,
  });
  return pages;
}

function htmlToText(html: string): string {
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/\s+/g, " ")
    .slice(0, 40_000);
}

function policyField<T>(value: T, url: string, evidence: string): Field<T> {
  return {
    value,
    confidence: 0.55, // heuristic extraction; LLM reader upgrades later
    source: "policy_page",
    depth: "merchant",
    observedAt: new Date().toISOString(),
    evidenceUrl: url,
    evidenceText: evidence.slice(0, 200),
  };
}

export function applyPolicyHeuristics(state: RunState, merchantId: string, pages: PolicyPageText[]): string[] {
  if (!pages.length) return [];
  const unknownField = { confidence: 0, source: "none" as const, depth: "merchant" as const, observedAt: new Date().toISOString() };
  const policy: MerchantPolicy = state.policies.get(merchantId) ?? {
    merchantId,
    shipping: { ...unknownField },
    returns: { ...unknownField },
    payment: { ...unknownField },
  };
  const learned: string[] = [];

  for (const page of pages) {
    const { url, text } = page;

    if (!policy.shipping.value || policy.shipping.confidence < 0.55) {
      const cost = parseFreeShipping(text) ? 0 : parseZl(text);
      const etaDays = parseDeliveryDays(text);
      const freeAbove = parseFreeShippingThreshold(text);
      if (cost !== undefined || etaDays || freeAbove !== undefined) {
        policy.shipping = policyField(
          {
            ...(cost !== undefined ? { cost: { amount: cost, currency: "PLN" } } : {}),
            ...(freeAbove !== undefined ? { freeAbove: { amount: freeAbove, currency: "PLN" } } : {}),
            ...(etaDays ? { etaDays } : {}),
          },
          url,
          text.slice(0, 200),
        );
        learned.push("shipping");
      }
    }

    if (!policy.returns.value || policy.returns.confidence < 0.55) {
      const days = parseReturnDays(text);
      if (days !== undefined) {
        policy.returns = policyField({ windowDays: days }, url, text.match(/.{0,80}zwrot.{0,80}/i)?.[0] ?? "");
        learned.push("returns");
      }
    }

    if (!policy.payment.value || policy.payment.confidence < 0.55) {
      const methods = parsePaymentMethods(text);
      if (methods.length >= 2) {
        policy.payment = policyField(methods, url, methods.join(", "));
        learned.push("payment");
      }
    }
  }

  state.policies.set(merchantId, policy);
  return [...new Set(learned)];
}
