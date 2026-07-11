import type { ReactNode } from "react";
import type { RecommendationSet } from "@/contract/http";
import type { Field, Recommendation, ReviewEvidence } from "@/contract/research";

type ProductArtifactProps = {
  result: RecommendationSet;
  recommendation: Recommendation;
  onBack: () => void;
  onOpenLog: () => void;
  onPropose: (offerId: string) => void;
  proposing: boolean;
  error?: string | null;
};

function money(amount: number, currency: string) {
  return new Intl.NumberFormat("pl-PL", { style: "currency", currency, maximumFractionDigits: 2 }).format(amount);
}

function reviewFor(reviews: ReviewEvidence[], subject: "product" | "merchant", id: string) {
  return reviews.find((review) => review.subject === subject && review.subjectId === id);
}

function fieldState(field?: Field<unknown>) {
  if (field?.value !== undefined) return { label: field.confidence >= 0.85 ? "Verified" : "Partial evidence", tone: "verified" };
  if (field?.evidenceText || field?.evidenceUrl) return { label: "Checked, unresolved", tone: "unresolved" };
  return { label: "Not checked yet", tone: "unchecked" };
}

function readable(value: unknown): string {
  if (value === undefined || value === null) return "No value established";
  if (typeof value === "boolean") return value ? "Yes" : "No";
  if (typeof value !== "object") return String(value);
  if (Array.isArray(value)) return value.join(", ");
  return Object.entries(value as Record<string, unknown>)
    .map(([key, item]) => `${key.replace(/([A-Z])/g, " $1")}: ${typeof item === "object" ? readable(item) : String(item)}`)
    .join(" · ");
}

function ArtifactField({ label, field, value }: { label: string; field?: Field<unknown>; value?: ReactNode }) {
  const state = fieldState(field);
  return (
    <div className="artifact-field">
      <div className="artifact-field-label"><span>{label}</span><b className={`evidence-state evidence-${state.tone}`}>{state.label}</b></div>
      <strong>{value ?? readable(field?.value)}</strong>
      {field ? (
        <div className="provenance-row">
          <span>{field.source.replaceAll("_", " ")}</span>
          <span>{field.depth} depth</span>
          <span>{Math.round(field.confidence * 100)}% confidence</span>
          {field.evidenceUrl ? <a href={field.evidenceUrl} target="_blank" rel="noreferrer">Evidence ↗</a> : null}
        </div>
      ) : <div className="provenance-row"><span>No observation recorded</span></div>}
      {field?.evidenceText ? <p className="evidence-quote">{field.evidenceText}</p> : null}
    </div>
  );
}

function ReviewArtifact({ title, review }: { title: string; review?: ReviewEvidence }) {
  return (
    <section className="artifact-review">
      <p className="eyebrow">{title}</p>
      {review ? (
        <>
          <div><strong>{review.rating ? `${review.rating.toFixed(1)} ★` : "Rating unavailable"}</strong><span>{review.count ? `${review.count} reviews` : "Review count unknown"}</span></div>
          <p>{review.summary ?? review.risks?.join(" · ") ?? "No recurring theme extracted."}</p>
          <small>Source: {review.source.replaceAll("_", " ")} · manipulation risk: {review.manipulationRisk ?? "unknown"}</small>
        </>
      ) : <p className="artifact-empty">Not checked yet — no review collector returned evidence for this subject.</p>}
    </section>
  );
}

export function ProductArtifact({ result, recommendation, onBack, onOpenLog, onPropose, proposing, error }: ProductArtifactProps) {
  const offer = result.offers[recommendation.offerId];
  const product = result.products[offer.productId];
  const merchant = result.merchants[offer.merchantId];
  const variant = offer.variantId ? result.variants[offer.variantId] : undefined;
  const policy = result.policies[merchant.id];
  const assessment = result.assessments[offer.id];
  const productReview = reviewFor(result.reviews, "product", product.id);
  const merchantReview = reviewFor(result.reviews, "merchant", merchant.id);
  const sameProductOffers = Object.values(result.offers).filter((candidate) => candidate.productId === product.id);
  const unknowns = [...new Set([...recommendation.unknowns, ...assessment.unknowns])];

  return (
    <section className="artifact-shell">
      <div className="artifact-nav">
        <button className="text-button" type="button" onClick={onBack}>← Back to three picks</button>
        <button className="text-button" type="button" onClick={onOpenLog}>Research log →</button>
      </div>

      <div className="artifact-hero">
        <div
          className={`artifact-image ${product.imageUrl ? "has-image" : ""}`}
          style={product.imageUrl ? { backgroundImage: `url("${product.imageUrl}")` } : undefined}
        >
          {!product.imageUrl ? <span>{product.brand?.slice(0, 1) ?? product.title.slice(0, 1)}</span> : null}
        </div>
        <div className="artifact-intro">
          <p className="eyebrow">Standardized product artifact</p>
          <h2>{product.title}</h2>
          <p>{recommendation.headline}</p>
          <div className="artifact-summary-row">
            <div><span>Seller</span><strong>{merchant.name}</strong></div>
            <div><span>Fit score</span><strong>{Math.round(assessment.score.total * 100)} / 100</strong></div>
            <div><span>Variant</span><strong>{variant?.label ?? "Not selected"}</strong></div>
          </div>
        </div>
      </div>

      <div className="artifact-layout">
        <div className="artifact-main-column">
          <section className="artifact-section">
            <div className="artifact-section-heading"><p className="eyebrow">Standardized offer</p><h3>Price, stock and delivery</h3></div>
            <div className="artifact-field-grid">
              <ArtifactField label="Item price" field={offer.price} value={offer.price.value ? money(offer.price.value.amount, offer.price.value.currency) : undefined} />
              <ArtifactField label="Known total" field={offer.totalPrice} value={offer.totalPrice?.value ? money(offer.totalPrice.value.amount, offer.totalPrice.value.currency) : undefined} />
              <ArtifactField label="Availability" field={offer.availability} />
              <ArtifactField label="Offer delivery" field={offer.delivery} />
            </div>
          </section>

          <section className="artifact-section">
            <div className="artifact-section-heading"><p className="eyebrow">Product parameters</p><h3>Normalized specifications</h3></div>
            <div className="artifact-field-grid">
              {product.specs.length ? product.specs.map((spec) => (
                <ArtifactField key={spec.aspectId} label={spec.aspectId.replaceAll("-", " ")} field={spec} value={`${readable(spec.value)}${spec.unit ? ` ${spec.unit}` : ""}`} />
              )) : <p className="artifact-empty">No standardized specifications were established.</p>}
            </div>
          </section>

          <section className="artifact-section">
            <div className="artifact-section-heading"><p className="eyebrow">Merchant artifact</p><h3>Shipping, returns and payment</h3></div>
            <div className="artifact-field-grid">
              <ArtifactField label="Shipping policy" field={policy?.shipping} />
              <ArtifactField label="Return policy" field={policy?.returns} />
              <ArtifactField label="Payment options" field={policy?.payment} />
              <ArtifactField label="Warranty" field={policy?.warranty} />
            </div>
          </section>

          <section className="artifact-section">
            <div className="artifact-section-heading"><p className="eyebrow">Same-product comparison</p><h3>{sameProductOffers.length} known offer{sameProductOffers.length === 1 ? "" : "s"}</h3></div>
            <div className="same-product-offers">
              {sameProductOffers.map((candidate) => {
                const candidateMerchant = result.merchants[candidate.merchantId];
                const price = candidate.totalPrice?.value ?? candidate.price.value;
                return (
                  <a href={candidate.url} target="_blank" rel="noreferrer" key={candidate.id}>
                    <div><strong>{candidateMerchant.name}</strong><span>{candidateMerchant.domain}</span></div>
                    <div><strong>{price ? money(price.amount, price.currency) : "Unverified"}</strong><span>{fieldState(candidate.totalPrice ?? candidate.price).label}</span></div>
                  </a>
                );
              })}
            </div>
          </section>

          <div className="artifact-review-grid">
            <ReviewArtifact title="Product reviews" review={productReview} />
            <ReviewArtifact title="Store / seller reviews" review={merchantReview} />
          </div>
        </div>

        <aside className="artifact-sidebar">
          <div className="artifact-sticky">
            <p className="eyebrow">Decision summary</p>
            <h3>{recommendation.role.replaceAll("_", " ")}</h3>
            <div className="artifact-score-bars">
              {Object.entries(assessment.score).map(([label, value]) => (
                <div key={label}><span>{label.replace(/([A-Z])/g, " $1")}</span><b><i style={{ width: `${Math.max(0, Math.min(100, value * 100))}%` }} /></b><strong>{Math.round(value * 100)}</strong></div>
              ))}
            </div>
            <div className="artifact-list"><span>Compromises</span>{recommendation.compromises.length ? <ul>{recommendation.compromises.map((item) => <li key={item}>{item}</li>)}</ul> : <p>None material</p>}</div>
            <div className="artifact-list"><span>Deferred / unresolved</span>{unknowns.length ? <ul>{unknowns.map((item) => <li key={item}><b>Deferred</b>{item}</li>)}</ul> : <p>Nothing material</p>}</div>
            {error ? <p className="form-error" role="alert">{error}</p> : null}
            <button className="artifact-checkout" type="button" onClick={() => onPropose(offer.id)} disabled={proposing}>
              {proposing ? "Preparing proposal…" : "Prepare checkout proposal"} <span>→</span>
            </button>
            <a className="artifact-source-link" href={offer.url} target="_blank" rel="noreferrer">Open source offer ↗</a>
          </div>
        </aside>
      </div>
    </section>
  );
}
