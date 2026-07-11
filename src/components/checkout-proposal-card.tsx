"use client";

import { useEffect, useState } from "react";
import { API, type CheckoutProposal } from "@/contract/http";

type CheckoutProposalCardProps = {
  proposal: CheckoutProposal;
  onUpdated: (proposal: CheckoutProposal) => void;
  onClose: () => void;
};

function money(amount: number, currency: string) {
  return new Intl.NumberFormat("pl-PL", { style: "currency", currency }).format(amount);
}

export function CheckoutProposalCard({ proposal, onUpdated, onClose }: CheckoutProposalCardProps) {
  const [deciding, setDeciding] = useState(false);
  const [reason, setReason] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [orderAcknowledged, setOrderAcknowledged] = useState(false);

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  async function decide(approve: boolean) {
    setDeciding(true);
    setError(null);
    try {
      const response = await fetch(API.decideCheckout(proposal.id), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          proposalId: proposal.id,
          approve,
          rejectionReason: approve ? undefined : reason.trim() || "User chose another option",
        }),
      });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.error ?? "Could not record the decision");
      onUpdated(payload as CheckoutProposal);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Could not record the decision");
    } finally {
      setDeciding(false);
    }
  }

  if (proposal.status !== "proposed") {
    const approved = proposal.status === "approved";
    return (
      <section className={`consent-card consent-${proposal.status}`} aria-live="polite">
        <button className="consent-close" type="button" onClick={onClose} aria-label="Close proposal">×</button>
        <span className="consent-result-icon">{approved ? "✓" : "×"}</span>
        <p className="eyebrow">{approved ? "Purchase confirmation" : "Decision recorded"}</p>
        <h3>{approved ? "Purchase Orchestrator completed the request." : "Proposal rejected."}</h3>
        {approved && proposal.order ? (
          <div className="order-confirmation">
            <div><span>Order ID</span><strong>{proposal.order.orderId}</strong></div>
            <div><span>Placed at</span><strong>{new Date(proposal.order.placedAt).toLocaleString()}</strong></div>
            <div><span>Total</span><strong>{money(proposal.totalPrice.amount, proposal.totalPrice.currency)}</strong></div>
          </div>
        ) : null}
        <p>{approved
          ? `The server-side approval was accepted. Orchestrator status: ${proposal.orchestrator?.status ?? "unknown"}.`
          : "The Purchase Orchestrator recorded the rejection and no execution was started."}</p>
      </section>
    );
  }

  return (
    <section className="consent-card" aria-label="Checkout approval proposal">
      <button className="consent-close" type="button" onClick={onClose} aria-label="Close proposal">×</button>
      <p className="eyebrow">Explicit consent boundary</p>
      <h3>Review before authorizing the Purchase Orchestrator.</h3>
      <div className="consent-merchant">
        <div><span>Seller</span><strong>{proposal.merchantName}</strong><small>{proposal.merchantDomain}</small></div>
        <div className="consent-total"><span>Verified total</span><strong>{money(proposal.totalPrice.amount, proposal.totalPrice.currency)}</strong></div>
      </div>
      <dl className="proposal-facts">
        <div><dt>Item</dt><dd>{money(proposal.itemPrice.amount, proposal.itemPrice.currency)}</dd></div>
        <div><dt>Shipping</dt><dd>{proposal.shippingCost ? money(proposal.shippingCost.amount, proposal.shippingCost.currency) : "Unverified"}</dd></div>
        <div><dt>Delivery</dt><dd>{proposal.deliveryPromise ?? "Unverified"}</dd></div>
        <div><dt>Payment</dt><dd>{proposal.paymentMethod ?? "Choose later"}</dd></div>
        <div><dt>Returns</dt><dd>{proposal.returnSummary ?? "Unverified"}</dd></div>
      </dl>
      {proposal.unknowns.length > 0 ? (
        <div className="proposal-unknowns">
          <strong>Still unknown</strong>
          <ul>{proposal.unknowns.map((unknown) => <li key={unknown}>{unknown}</li>)}</ul>
        </div>
      ) : null}
      <p className="consent-expiry">Proposal expires {new Date(proposal.expiresAt).toLocaleString()}</p>
      <label className="order-acknowledgment">
        <input
          type="checkbox"
          checked={orderAcknowledged}
          onChange={(event) => setOrderAcknowledged(event.target.checked)}
        />
        <span>
          <strong>I understand that approval starts the configured purchase adapter.</strong>
          {proposal.adapter === "ai_browser"
            ? " Configured adapter: ai_browser — a visible browser will walk the merchant's checkout. It cannot click payment or place-order buttons and stops for your action."
            : proposal.adapter && proposal.adapter !== "dummy"
              ? ` Configured adapter: ${proposal.adapter} — this may contact the merchant.`
              : " Configured adapter: dummy — a safe fake purchase, no merchant contact, no payment."}
        </span>
      </label>
      <label className="rejection-reason">
        Optional reason if rejecting
        <input value={reason} onChange={(event) => setReason(event.target.value)} placeholder="e.g. compare another offer first" />
      </label>
      {error ? <p className="form-error" role="alert">{error}</p> : null}
      <div className="consent-actions">
        <button type="button" className="reject-button" onClick={() => decide(false)} disabled={deciding}>Reject</button>
        <button type="button" className="approve-button" onClick={() => decide(true)} disabled={deciding || !orderAcknowledged}>
          {deciding ? "Authorizing…" : "Authorize purchase"} <span>→</span>
        </button>
      </div>
      <p className="consent-legal">Reject remains available without checking the acknowledgment.</p>
    </section>
  );
}
