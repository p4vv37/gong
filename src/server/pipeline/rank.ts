import type { Criterion, OfferAssessment, Recommendation } from "../../contract";
import type { RunState } from "./state";

/**
 * Deterministic eligibility + scoring. Hard constraints filter — they never
 * enter the score. Uncertainty is a first-class penalty and the deepening
 * driver. LLMs are not involved here; they only explain results later.
 */

const WEIGHTS = { fit: 0.4, value: 0.25, trust: 0.2, uncertainty: 0.1, risk: 0.05 };

const PL_STOPWORDS = new Set(["nie", "bez", "dla", "oraz", "and", "not", "with", "raczej", "moze", "może"]);

function tokens(s: string): string[] {
  return s
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/ł/g, "l")
    .split(/[^a-z0-9]+/i)
    .filter((t) => t.length > 2 && !PL_STOPWORDS.has(t));
}

/** Polish inflections ("miejska"/"miejski") — compare on 5-char stems. */
const stem = (t: string) => t.slice(0, 5);

/** true = matched, false = contradicted (not detectable yet), undefined = unverifiable */
function criterionMatch(c: Criterion, corpus: string): boolean | undefined {
  const want = tokens(c.value);
  if (!want.length) return undefined;
  const have = new Set(tokens(corpus).map(stem));
  const hits = want.filter((t) => have.has(stem(t))).length;
  if (hits >= Math.ceil(want.length / 2)) return true;
  return undefined; // absence of words is not evidence of absence
}

export function assess(state: RunState): Record<string, OfferAssessment> {
  const brief = state.request.brief;
  const out: Record<string, OfferAssessment> = {};

  const eligiblePrices: number[] = [];
  for (const offer of state.offers.values()) {
    const price = offer.totalPrice?.value?.amount ?? offer.price.value?.amount;
    if (price !== undefined) eligiblePrices.push(price);
  }
  const minPrice = Math.min(...eligiblePrices);
  const maxPrice = Math.max(...eligiblePrices);

  for (const offer of state.offers.values()) {
    const product = state.products.get(offer.productId);
    const merchant = state.merchants.get(offer.merchantId);
    const policy = state.policies.get(offer.merchantId);
    const corpus = [
      product?.title,
      product?.brand,
      ...(product?.specs.map((s) => `${s.aspectId} ${s.value}`) ?? []),
      state.variants.get(offer.variantId ?? "")?.label,
    ]
      .filter(Boolean)
      .join(" ");

    const violations: OfferAssessment["violations"] = [];
    const unknowns: string[] = [];

    // hard: budget
    const price = offer.totalPrice?.value?.amount ?? offer.price.value?.amount;
    if (brief.budget?.max !== undefined && price !== undefined && price > brief.budget.max) {
      violations.push({ criterionId: "request-budget", reason: `${price} ${offer.price.value?.currency ?? "PLN"} exceeds budget ${brief.budget.max}` });
    }
    if (price === undefined) unknowns.push("price");

    // hard: stock
    if (offer.availability.value === "out_of_stock") {
      violations.push({ criterionId: "availability", reason: "out of stock" });
    } else if (offer.availability.value === "unknown" || offer.availability.confidence < 0.5) {
      unknowns.push("availability");
    }

    // soft criteria
    let preferTotal = 0;
    let preferHit = 0;
    for (const c of brief.criteria) {
      if (/budget|budżet/i.test(c.label)) continue;
      const match = criterionMatch(c, corpus);
      if (c.kind === "must") {
        if (match === undefined) unknowns.push(`must:${c.label}`);
      } else if (c.kind === "prefer") {
        preferTotal += 1;
        if (match) preferHit += 1;
      } else if (c.kind === "avoid" && match === true) {
        violations.push({ criterionId: c.id, reason: `matches avoided "${c.value}"` });
      }
    }

    // policy unknowns (drive deepening)
    if (!policy?.shipping.value) unknowns.push("shipping");
    if (!policy?.returns.value) unknowns.push("returns");
    if (!policy?.payment.value) unknowns.push("payment");

    // trust: product/merchant reviews when present
    const productReview = state.reviews.find((r) => r.subject === "product" && r.subjectId === offer.productId);
    const merchantReview = state.reviews.find((r) => r.subject === "merchant" && r.subjectId === offer.merchantId);
    const ratings = [productReview?.rating, merchantReview?.rating].filter((x): x is number => x !== undefined);
    const trust = ratings.length ? ratings.reduce((a, b) => a + b, 0) / ratings.length / 5 : 0.5;
    const riskPenalty =
      (merchantReview?.risks?.length ? 0.5 : 0) +
      (merchantReview?.manipulationRisk === "suspicious" ? 0.5 : 0) +
      (offer.condition === "used" ? 0.4 : 0); // used items must not silently win

    const value =
      price === undefined || !Number.isFinite(minPrice) || maxPrice === minPrice
        ? 0.5
        : 1 - (price - minPrice) / (maxPrice - minPrice);
    const preferenceFit = preferTotal ? preferHit / preferTotal : 0.5;
    const uncertaintyPenalty = Math.min(1, unknowns.length / 6);
    const merchantTrustBoost = merchant?.platform === "shopify" ? 0.05 : 0;

    const total =
      WEIGHTS.fit * preferenceFit +
      WEIGHTS.value * value +
      WEIGHTS.trust * Math.min(1, trust + merchantTrustBoost) -
      WEIGHTS.uncertainty * uncertaintyPenalty -
      WEIGHTS.risk * riskPenalty;

    out[offer.id] = {
      offerId: offer.id,
      eligible: violations.length === 0,
      violations,
      score: { preferenceFit, value, trust, uncertaintyPenalty, riskPenalty, total: Number(total.toFixed(4)) },
      unknowns,
    };
  }
  return out;
}

/** High score × high uncertainty picks, one per merchant. */
export function pickDeepDives(state: RunState, assessments: Record<string, OfferAssessment>, k: number): string[] {
  const seenMerchants = new Set<string>();
  return Object.values(assessments)
    .filter((a) => a.eligible && a.unknowns.length > 0)
    .sort((a, b) => b.score.total - a.score.total)
    .filter((a) => {
      const m = state.offers.get(a.offerId)?.merchantId;
      if (!m || seenMerchants.has(m)) return false;
      seenMerchants.add(m);
      return true;
    })
    .slice(0, k)
    .map((a) => a.offerId);
}

export function recommend(state: RunState, assessments: Record<string, OfferAssessment>): Recommendation[] {
  const eligible = Object.values(assessments)
    .filter((a) => a.eligible)
    .sort((a, b) => b.score.total - a.score.total);
  if (!eligible.length) return [];

  const describe = (a: OfferAssessment): { offer: NonNullable<ReturnType<RunState["offers"]["get"]>>; headline: string } => {
    const offer = state.offers.get(a.offerId)!;
    const product = state.products.get(offer.productId);
    const merchant = state.merchants.get(offer.merchantId);
    const price = offer.totalPrice?.value ?? offer.price.value;
    return {
      offer,
      headline: `${product?.title ?? "Offer"} at ${merchant?.name ?? offer.url} — ${price ? `${price.amount} ${price.currency}` : "price unknown"}`,
    };
  };

  const satisfied = (a: OfferAssessment) =>
    state.request.brief.criteria.filter((c) => c.kind === "must" && !a.unknowns.includes(`must:${c.label}`)).map((c) => c.id);
  const compromises = (a: OfferAssessment) => {
    const offer = state.offers.get(a.offerId);
    const policy = offer && state.policies.get(offer.merchantId);
    const out: string[] = [];
    if (policy?.returns.value?.windowDays !== undefined && policy.returns.value.windowDays < 30) {
      out.push(`returns window ${policy.returns.value.windowDays} days`);
    }
    const shippingCost = offer?.delivery?.value?.cost?.amount ?? policy?.shipping.value?.cost?.amount;
    if (shippingCost) out.push(`shipping ${shippingCost} PLN`);
    if (offer?.condition === "used") out.push("used / second-life item");
    return out;
  };

  const recs: Recommendation[] = [];
  const best = eligible[0];
  recs.push({
    role: "best_overall",
    offerId: best.offerId,
    headline: describe(best).headline,
    satisfiedCriterionIds: satisfied(best),
    compromises: compromises(best),
    unknowns: best.unknowns,
  });

  const bestValue = [...eligible].filter((a) => a.offerId !== best.offerId).sort((a, b) => b.score.value - a.score.value)[0];
  if (bestValue) {
    recs.push({
      role: "best_value",
      offerId: bestValue.offerId,
      headline: describe(bestValue).headline,
      satisfiedCriterionIds: satisfied(bestValue),
      compromises: compromises(bestValue),
      unknowns: bestValue.unknowns,
    });
  }

  const riskKey = (a: OfferAssessment) => a.score.trust - a.score.uncertaintyPenalty - a.score.riskPenalty;
  const lowestRisk = [...eligible]
    .filter((a) => !recs.some((r) => r.offerId === a.offerId))
    .sort((a, b) => riskKey(b) - riskKey(a))[0];
  if (lowestRisk) {
    recs.push({
      role: "lowest_risk",
      offerId: lowestRisk.offerId,
      headline: describe(lowestRisk).headline,
      satisfiedCriterionIds: satisfied(lowestRisk),
      compromises: compromises(lowestRisk),
      unknowns: lowestRisk.unknowns,
    });
  }
  return recs;
}
