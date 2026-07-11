"use client";

import { useState } from "react";
import { API, type CheckoutProposal, type RecommendationSet } from "@/contract/http";
import type { ProgressEvent } from "@/contract/events";
import type { Recommendation } from "@/contract/research";
import { CheckoutProposalCard } from "./checkout-proposal-card";
import { ProductArtifact } from "./product-artifact";
import { ResearchLog } from "./research-log";

type RecommendationResultsProps = {
  result: RecommendationSet;
  events: ProgressEvent[];
  onNewRequest: () => void;
};

const roleLabels: Record<Recommendation["role"], string> = {
  best_overall: "Best overall",
  best_value: "Best value",
  lowest_risk: "Lowest risk",
  specialist: "Specialist pick",
};

function money(amount: number, currency: string) {
  return new Intl.NumberFormat("pl-PL", { style: "currency", currency, maximumFractionDigits: 2 }).format(amount);
}

export function RecommendationResults({ result, events, onNewRequest }: RecommendationResultsProps) {
  const [selected, setSelected] = useState<number | null>(null);
  const [showLog, setShowLog] = useState(false);
  const [proposal, setProposal] = useState<CheckoutProposal | null>(null);
  const [proposingOfferId, setProposingOfferId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

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

  if (showLog) {
    return <ResearchLog events={events} result={result} onBack={() => setShowLog(false)} />;
  }

  if (selected !== null) {
    const recommendation = result.recommendations[selected];
    return (
      <>
        <ProductArtifact
          result={result}
          recommendation={recommendation}
          onBack={() => setSelected(null)}
          onOpenLog={() => setShowLog(true)}
          onPropose={proposeCheckout}
          proposing={proposingOfferId === recommendation.offerId}
          error={error}
        />
        {proposal ? (
          <div className="consent-overlay" role="dialog" aria-modal="true" aria-label="Checkout proposal">
            <CheckoutProposalCard proposal={proposal} onUpdated={setProposal} onClose={() => setProposal(null)} />
          </div>
        ) : null}
      </>
    );
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
          <button className="text-button" type="button" onClick={() => setShowLog(true)}>View research log →</button>
          <button className="text-button" type="button" onClick={onNewRequest}>← Start another search</button>
        </div>
      </div>

      <div className="product-card-grid">
        {result.recommendations.map((recommendation, index) => {
          const offer = result.offers[recommendation.offerId];
          const product = result.products[offer.productId];
          const merchant = result.merchants[offer.merchantId];
          const assessment = result.assessments[offer.id];
          const displayedPrice = offer.totalPrice?.value ?? offer.price.value;

          return (
            <article className="product-card" key={`${recommendation.role}-${recommendation.offerId}`}>
              <button className="product-card-open" type="button" onClick={() => setSelected(index)} aria-label={`Open details for ${product.title}`}>
                <div
                  className={`product-card-image ${product.imageUrl ? "has-image" : ""}`}
                  style={product.imageUrl ? { backgroundImage: `url("${product.imageUrl}")` } : undefined}
                >
                  {!product.imageUrl ? <span>{product.brand?.slice(0, 1) ?? product.title.slice(0, 1)}</span> : null}
                  <b className={`role role-${recommendation.role}`}>{roleLabels[recommendation.role]}</b>
                </div>
                <div className="product-card-body">
                  <div className="product-card-score"><span>{merchant.name}</span><strong>{Math.round(assessment.score.total * 100)} fit</strong></div>
                  <h3>{product.title}</h3>
                  <p>{recommendation.headline}</p>
                  <div className="product-card-price">
                    <strong>{displayedPrice ? money(displayedPrice.amount, displayedPrice.currency) : "Price unverified"}</strong>
                    <span>Open product artifact →</span>
                  </div>
                </div>
              </button>
            </article>
          );
        })}
      </div>
    </section>
  );
}
