"use client";

import { useState } from "react";
import { API, type CheckoutProposal, type RecommendationSet } from "@/contract/http";
import type { Field, MerchantPolicy, RecommendationRole, ReviewEvidence } from "@/contract/research";
import { CheckoutProposalCard } from "./checkout-proposal-card";

type RecommendationResultsProps = {
  result: RecommendationSet;
  onNewRequest: () => void;
};

const roleLabels: Record<RecommendationRole, string> = {
  best_overall: "Best overall",
  best_value: "Best value",
  lowest_risk: "Lowest risk",
  specialist: "Specialist pick",
};

function money(amount: number, currency: string) {
  return new Intl.NumberFormat("pl-PL", { style: "currency", currency, maximumFractionDigits: 2 }).format(amount);
}

function reviewFor(reviews: ReviewEvidence[], subject: "product" | "merchant", id: string) {
  return reviews.find((review) => review.subject === subject && review.subjectId === id);
}

function confidenceLabel(field?: Field<unknown>) {
  if (!field?.value || field.source === "none" || field.confidence === 0) return "Unverified";
  if (field.confidence >= 0.85) return "High confidence";
  if (field.confidence >= 0.6) return "Moderate confidence";
  return "Low confidence";
}

function PolicyFacts({ policy }: { policy?: MerchantPolicy }) {
  const returns = policy?.returns.value;
  const shipping = policy?.shipping.value;
  const payments = policy?.payment.value;

  return (
    <div className="policy-facts">
      <div><span>Shipping</span><strong>{shipping?.cost ? money(shipping.cost.amount, shipping.cost.currency) : shipping?.freeAbove ? `Free over ${money(shipping.freeAbove.amount, shipping.freeAbove.currency)}` : "Unverified"}</strong><small>{confidenceLabel(policy?.shipping)} · {policy?.shipping.depth ?? "unknown depth"}</small></div>
      <div><span>Returns</span><strong>{returns?.windowDays ? `${returns.windowDays} days${returns.freeReturns ? ", free" : ""}` : "Unverified"}</strong><small>{confidenceLabel(policy?.returns)} · {policy?.returns.depth ?? "unknown depth"}</small></div>
      <div><span>Payment</span><strong>{payments?.slice(0, 3).join(", ") || "Unverified"}</strong><small>{confidenceLabel(policy?.payment)} · {policy?.payment.depth ?? "unknown depth"}</small></div>
    </div>
  );
}

function ReviewSignal({ title, review }: { title: string; review?: ReviewEvidence }) {
  return (
    <div className="review-signal">
      <span>{title}</span>
      {review ? (
        <>
          <div><strong>{review.rating ? `${review.rating.toFixed(1)} ★` : "No rating"}</strong><small>{review.count ? `${review.count} reviews` : "count unknown"}</small></div>
          <p>{review.summary ?? review.risks?.[0] ?? "No recurring theme extracted."}</p>
          <b className={`manipulation manipulation-${review.manipulationRisk ?? "unknown"}`}>{review.manipulationRisk ?? "unknown"} manipulation risk</b>
        </>
      ) : <p className="unverified-copy">No review evidence collected</p>}
    </div>
  );
}

export function RecommendationResults({ result, onNewRequest }: RecommendationResultsProps) {
  const [proposal, setProposal] = useState<CheckoutProposal | null>(null);
  const [proposingOfferId, setProposingOfferId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const evidenceGaps = Object.values(result.merchants).flatMap((merchant) => {
    const policy = result.policies[merchant.id];
    if (!policy) return [{ merchant: merchant.name, fields: ["shipping", "returns", "payment"] }];
    const fields = [
      !policy.shipping.value || policy.shipping.confidence === 0 ? "shipping" : null,
      !policy.returns.value || policy.returns.confidence === 0 ? "returns" : null,
      !policy.payment.value || policy.payment.confidence === 0 ? "payment" : null,
    ].filter((field): field is string => field !== null);
    return fields.length ? [{ merchant: merchant.name, fields }] : [];
  });

  async function proposeCheckout(offerId: string) {
    setProposingOfferId(offerId);
    setError(null);
    try {
      const response = await fetch(API.proposeCheckout, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ runId: result.runId, offerId }),
      });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.error ?? "Could not prepare checkout proposal");
      setProposal(payload as CheckoutProposal);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Could not prepare checkout proposal");
    } finally {
      setProposingOfferId(null);
    }
  }

  return (
    <section className="results-shell">
      <div className="results-heading">
        <div>
          <p className="eyebrow">Evidence-backed shortlist</p>
          <h2>Three useful answers,<br /><em>not thirty blue links.</em></h2>
          <p>{result.briefRequest}</p>
        </div>
        <div className="results-meta">
          <span>{Object.keys(result.offers).length} offers compared</span>
          <span>{result.roundsCompleted} research rounds</span>
          <button className="text-button" type="button" onClick={onNewRequest}>← Start another search</button>
        </div>
      </div>

      {error ? <p className="research-error" role="alert">{error}</p> : null}

      <div className="recommendation-list">
        {result.recommendations.map((recommendation, index) => {
          const offer = result.offers[recommendation.offerId];
          const product = result.products[offer.productId];
          const merchant = result.merchants[offer.merchantId];
          const assessment = result.assessments[offer.id];
          const policy = result.policies[merchant.id];
          const productReview = reviewFor(result.reviews, "product", product.id);
          const merchantReview = reviewFor(result.reviews, "merchant", merchant.id);
          const displayedPrice = offer.totalPrice?.value ?? offer.price.value;
          const unknowns = [...new Set([...recommendation.unknowns, ...assessment.unknowns])];

          return (
            <article className="recommendation-card" key={`${recommendation.role}-${recommendation.offerId}`}>
              <div className="recommendation-index">0{index + 1}</div>
              <div className="recommendation-main">
                <div className="recommendation-topline">
                  <span className={`role role-${recommendation.role}`}>{roleLabels[recommendation.role]}</span>
                  <span className="match-score">{Math.round(assessment.score.total * 100)} fit</span>
                </div>
                <h3>{product.title}</h3>
                <p className="recommendation-headline">{recommendation.headline}</p>
                <div className="merchant-price">
                  <div><span>Sold by</span><strong>{merchant.name}</strong><small>{merchant.domain}</small></div>
                  <div><span>{offer.totalPrice?.value ? "Known total" : "Item price"}</span><strong>{displayedPrice ? money(displayedPrice.amount, displayedPrice.currency) : "Unverified"}</strong><small>{confidenceLabel(offer.totalPrice ?? offer.price)}</small></div>
                </div>
                <PolicyFacts policy={policy} />
                <div className="reviews-grid">
                  <ReviewSignal title="Product reviews" review={productReview} />
                  <ReviewSignal title="Store / seller reviews" review={merchantReview} />
                </div>
                <div className="tradeoff-grid">
                  <div><span>Compromises</span>{recommendation.compromises.length ? <ul>{recommendation.compromises.map((item) => <li key={item}>{item}</li>)}</ul> : <p>None material</p>}</div>
                  <div><span>Still unknown</span>{unknowns.length ? <ul>{unknowns.map((item) => <li key={item}>{item}</li>)}</ul> : <p>Nothing material</p>}</div>
                </div>
                {recommendation.whyNotTheOthers ? <p className="why-not"><strong>Why not the cheaper-looking alternative?</strong>{recommendation.whyNotTheOthers}</p> : null}
                <div className="offer-actions">
                  <a href={offer.url} target="_blank" rel="noreferrer">View source offer ↗</a>
                  <button type="button" onClick={() => proposeCheckout(offer.id)} disabled={proposingOfferId === offer.id}>
                    {proposingOfferId === offer.id ? "Preparing…" : "Prepare checkout"} <span>→</span>
                  </button>
                </div>
              </div>
            </article>
          );
        })}
      </div>

      {evidenceGaps.length > 0 ? (
        <section className="evidence-gaps">
          <div>
            <p className="eyebrow">What we refused to guess</p>
            <h3>Unknown means unknown.</h3>
            <p>These facts were not converted into reassuring defaults or silent negatives.</p>
          </div>
          <ul>
            {evidenceGaps.map((gap) => (
              <li key={gap.merchant}>
                <div><strong>{gap.merchant}</strong><span>{gap.fields.join(" · ")}</span></div>
                <b>Unverified</b>
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      {proposal ? (
        <div className="consent-overlay" role="dialog" aria-modal="true" aria-label="Checkout proposal">
          <CheckoutProposalCard proposal={proposal} onUpdated={setProposal} onClose={() => setProposal(null)} />
        </div>
      ) : null}
    </section>
  );
}
