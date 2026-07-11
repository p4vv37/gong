"use client";

import { FormEvent, useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { API, type CheckoutProposal, type RecommendationSet } from "@/contract/http";
import type { ProgressEvent } from "@/contract/events";
import {
  applyQuestionAnswer,
  createPurchaseBrief,
  type QuestionChoice,
} from "@/domain/purchase-brief";
import { questionPlanSchema } from "@/lib/question-plan/schema";
import {
  createEmptyChat,
  savePurchaseChat,
  subscribeToPurchaseChat,
  type SyncStatus,
  type SyncedPurchaseChat,
} from "@/lib/firebase/purchase-chat";
import { CheckoutProposalCard } from "./checkout-proposal-card";

const roleNames = {
  best_overall: "Best overall",
  best_value: "Best value",
  lowest_risk: "Lowest risk",
  specialist: "Specialist pick",
};

function money(amount: number, currency: string) {
  return new Intl.NumberFormat("pl-PL", { style: "currency", currency, maximumFractionDigits: 2 }).format(amount);
}

function timeLabel() {
  return new Intl.DateTimeFormat(undefined, { hour: "2-digit", minute: "2-digit" }).format(new Date());
}

function initialChatId() {
  const url = new URL(window.location.href);
  const fromUrl = url.searchParams.get("chat");
  if (fromUrl && /^[a-zA-Z0-9_-]{8,80}$/.test(fromUrl)) return fromUrl;
  const saved = localStorage.getItem("gong.whatsapp-chat-id");
  const id = saved ?? crypto.randomUUID();
  localStorage.setItem("gong.whatsapp-chat-id", id);
  url.searchParams.set("chat", id);
  window.history.replaceState({}, "", url);
  return id;
}

function SyncBadge({ status }: { status: SyncStatus }) {
  const copy = {
    connecting: "Connecting…",
    live: "Firebase live",
    saving: "Syncing…",
    local: "Local preview",
    error: "Sync unavailable",
  }[status];
  return <span className={`wa-sync wa-sync-${status}`}><i />{copy}</span>;
}

export function WhatsAppPurchaseChat() {
  const [chatId, setChatId] = useState<string | null>(null);
  const [chat, setChat] = useState<SyncedPurchaseChat>(() => createEmptyChat());
  const [syncStatus, setSyncStatus] = useState<SyncStatus>("connecting");
  const [draft, setDraft] = useState("");
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<RecommendationSet | null>(null);
  const [selectedOfferId, setSelectedOfferId] = useState<string | null>(null);
  const [proposal, setProposal] = useState<CheckoutProposal | null>(null);
  const [multiIds, setMultiIds] = useState<string[]>([]);
  const stateRef = useRef(chat);
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      const id = initialChatId();
      const cached = localStorage.getItem(`gong.whatsapp-chat.${id}`);
      if (cached) {
        try {
          const value = JSON.parse(cached) as SyncedPurchaseChat;
          if (value.version === 1) {
            stateRef.current = value;
            setChat(value);
          }
        } catch { localStorage.removeItem(`gong.whatsapp-chat.${id}`); }
      }
      setChatId(id);
    }, 0);
    return () => window.clearTimeout(timer);
  }, []);
  useEffect(() => { stateRef.current = chat; }, [chat]);

  const commit = useCallback((change: Partial<SyncedPurchaseChat> | ((current: SyncedPurchaseChat) => SyncedPurchaseChat)) => {
    const current = stateRef.current;
    const computed = typeof change === "function" ? change(current) : { ...current, ...change };
    const next = { ...computed, revision: Date.now() };
    stateRef.current = next;
    setChat(next);
    if (chatId) {
      setSyncStatus((status) => status === "local" ? status : "saving");
      void savePurchaseChat(chatId, next).catch(() => setSyncStatus("error"));
      localStorage.setItem(`gong.whatsapp-chat.${chatId}`, JSON.stringify(next));
    }
  }, [chatId]);

  useEffect(() => {
    if (!chatId) return;
    let unsubscribe: () => void = () => undefined;
    let active = true;
    let receivedRemote = false;
    void subscribeToPurchaseChat(chatId, (remote) => {
      if (!active) return;
      if (!remote) {
        receivedRemote = true;
        void savePurchaseChat(chatId, stateRef.current);
        return;
      }
      if (!receivedRemote || remote.revision >= stateRef.current.revision) {
        receivedRemote = true;
        stateRef.current = remote;
        setChat(remote);
        localStorage.setItem(`gong.whatsapp-chat.${chatId}`, JSON.stringify(remote));
      }
    }, setSyncStatus).then((stop) => {
      if (!active) stop(); else unsubscribe = stop;
    });
    return () => { active = false; unsubscribe(); };
  }, [chatId]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [busy, chat.phase, chat.progressLabels.length, chat.brief?.answeredQuestionIds.length, result]);

  useEffect(() => {
    if (!chat.runId || chat.phase !== "researching") return;
    const source = new EventSource(API.researchEvents(chat.runId));
    source.onmessage = (message) => {
      try {
        const event = JSON.parse(message.data) as ProgressEvent;
        if (!event.label) return;
        commit((current) => ({
          ...current,
          progressLabels: [...current.progressLabels, event.label].slice(-30),
          error: event.type === "run_failed" ? event.detail : null,
          phase: event.type === "run_completed" ? "results" : event.type === "run_failed" ? "error" : current.phase,
        }));
        if (event.type === "run_completed") {
          setResult(event.result);
          source.close();
        } else if (event.type === "run_failed") source.close();
      } catch { /* Ignore malformed third-party progress messages. */ }
    };
    source.onerror = () => commit({ error: "The live progress connection is reconnecting." });
    return () => source.close();
  }, [chat.phase, chat.runId, commit]);

  useEffect(() => {
    if (chat.phase !== "results" || !chat.runId || result) return;
    void fetch(API.researchResult(chat.runId)).then(async (response) => {
      if (response.ok) setResult(await response.json() as RecommendationSet);
    });
  }, [chat.phase, chat.runId, result]);

  const currentQuestion = chat.brief ? chat.questions[chat.brief.answeredQuestionIds.length] : undefined;

  async function mapRequest(event: FormEvent) {
    event.preventDefault();
    const request = draft.trim();
    if (!request || busy) return;
    setBusy(true);
    setDraft("");
    commit({ request, error: null });
    try {
      const response = await fetch("/api/question-plan", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ request, warrantedDepth: chat.depth }),
      });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.error ?? "I could not map that purchase yet.");
      const plan = questionPlanSchema.parse(payload.plan);
      const base = createPurchaseBrief(request, chat.depth);
      const inferred = plan.resolvedConstraints.map((constraint) => ({
        id: `research-${constraint.aspectId}`,
        label: constraint.label,
        value: constraint.value,
        kind: constraint.kind,
        source: "inference" as const,
      }));
      commit({
        brief: { ...base, category: plan.category, criteria: [...base.criteria, ...inferred] },
        questions: plan.questions,
        provider: payload.provider === "openai" ? "openai" : "mock",
        phase: "questions",
      });
    } catch (cause) {
      commit({ phase: "error", error: cause instanceof Error ? cause.message : "Question planning failed." });
    } finally { setBusy(false); }
  }

  function answer(value: QuestionChoice | QuestionChoice[] | string) {
    if (!chat.brief || !currentQuestion) return;
    const brief = applyQuestionAnswer(chat.brief, currentQuestion, value, chat.questions.length);
    commit({ brief, phase: brief.readyForSearch ? "ready" : "questions" });
    setDraft("");
    setMultiIds([]);
  }

  function submitDraft(event: FormEvent) {
    event.preventDefault();
    if (currentQuestion && draft.trim()) answer(draft.trim());
  }

  async function startResearch() {
    if (!chat.brief?.readyForSearch || busy) return;
    setBusy(true);
    setResult(null);
    commit({ phase: "researching", progressLabels: [], error: null, runId: null });
    try {
      const response = await fetch(API.startResearch, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ brief: chat.brief, mode: chat.researchMode }),
      });
      const payload = await response.json();
      if (!response.ok || !payload.runId) throw new Error(payload.error ?? "Research could not start.");
      commit({ runId: payload.runId, phase: "researching" });
    } catch (cause) {
      commit({ phase: "error", error: cause instanceof Error ? cause.message : "Research could not start." });
    } finally { setBusy(false); }
  }

  async function proposeCheckout(offerId: string) {
    if (!chat.runId) return;
    setBusy(true);
    try {
      const response = await fetch(API.proposeCheckout, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ runId: chat.runId, offerId }),
      });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.error ?? "Could not prepare checkout.");
      setProposal(payload as CheckoutProposal);
    } catch (cause) {
      commit({ error: cause instanceof Error ? cause.message : "Could not prepare checkout." });
    } finally { setBusy(false); }
  }

  function reset() {
    setResult(null);
    setSelectedOfferId(null);
    setProposal(null);
    setDraft("");
    commit(createEmptyChat());
  }

  const selectedOffer = selectedOfferId && result ? result.offers[selectedOfferId] : null;
  const selectedProduct = selectedOffer && result ? result.products[selectedOffer.productId] : null;

  return (
    <main className="wa-app">
      <aside className="wa-sidebar">
        <div className="wa-sidebar-top"><span className="wa-avatar wa-me">g</span><div><button aria-label="New chat" onClick={reset}>＋</button><button aria-label="Menu">⋮</button></div></div>
        <div className="wa-search">⌕ <input aria-label="Search chats" placeholder="Search or start new chat" /></div>
        <button className="wa-chat-row wa-chat-active">
          <span className="wa-avatar wa-agent">g</span>
          <span><strong>gong purchase agent</strong><small>{chat.request || "Tell me what you need"}</small></span>
          <time>{timeLabel()}</time>
        </button>
        <Link className="wa-main-link" href="/">← Open the main interface</Link>
      </aside>

      <section className="wa-conversation">
        <header className="wa-header">
          <span className="wa-avatar wa-agent">g</span>
          <div><strong>gong purchase agent</strong><small>{busy ? "typing…" : "online · evidence-first shopping"}</small></div>
          <SyncBadge status={syncStatus} />
          <button aria-label="Search">⌕</button><button aria-label="Menu">⋮</button>
        </header>

        <div className="wa-thread" aria-live="polite">
          <div className="wa-encryption">🔒 Messages and decisions sync through your private Firebase chat.</div>
          <div className="wa-day">Today</div>
          <div className="wa-bubble wa-incoming">
            <p>Hi! Tell me what you want to buy, your budget, and what matters. I&apos;ll research the category before asking only the decisions that can change the winner.</p>
            <time>{timeLabel()}</time>
          </div>

          {chat.request ? <div className="wa-bubble wa-outgoing"><p>{chat.request}</p><time>{timeLabel()} ✓✓</time></div> : null}

          {busy && chat.phase === "intake" ? <div className="wa-bubble wa-incoming wa-typing"><i /><i /><i /></div> : null}

          {chat.brief?.criteria.map((criterion) => criterion.source === "answer" ? (
            <div className="wa-bubble wa-outgoing wa-answer" key={criterion.id}><small>{criterion.label}</small><p>{criterion.value}</p><time>{timeLabel()} ✓✓</time></div>
          ) : null)}

          {currentQuestion ? (
            <div className="wa-question-group">
              <div className="wa-bubble wa-incoming">
                <small>{currentQuestion.eyebrow}</small><p><strong>{currentQuestion.title}</strong></p><p>{currentQuestion.why}</p><time>{timeLabel()}</time>
              </div>
              {currentQuestion.choices.length ? (
                <div className="wa-quick-replies">
                  {currentQuestion.choices.map((choice) => {
                    const multi = currentQuestion.answerFormat?.type === "multi_select";
                    const selected = multiIds.includes(choice.id);
                    return <button key={choice.id} className={selected ? "selected" : ""} onClick={() => {
                      if (multi) setMultiIds((ids) => ids.includes(choice.id) ? ids.filter((id) => id !== choice.id) : [...ids, choice.id]);
                      else answer(choice);
                    }}>{selected ? "✓ " : ""}{choice.label}<small>{choice.consequence}</small></button>;
                  })}
                  {currentQuestion.answerFormat?.type === "multi_select" ? <button className="wa-multi-send" disabled={!multiIds.length} onClick={() => answer(currentQuestion.choices.filter((choice) => multiIds.includes(choice.id)))}>Send {multiIds.length} choices →</button> : null}
                </div>
              ) : null}
            </div>
          ) : null}

          {chat.phase === "ready" ? (
            <div className="wa-bubble wa-incoming wa-ready">
              <small>Decision mapped</small><p><strong>I&apos;m ready to search for {chat.brief?.category}.</strong></p>
              <p>{chat.brief?.criteria.length} explicit criteria · depth {chat.depth}/100</p>
              <div className="wa-mode">
                <button className={chat.researchMode === "fixture" ? "active" : ""} onClick={() => commit({ researchMode: "fixture" })}>Fixture</button>
                <button className={chat.researchMode === "live" ? "active" : ""} onClick={() => commit({ researchMode: "live" })}>Live web</button>
              </div>
              <button className="wa-action" onClick={startResearch}>Start {chat.researchMode} research →</button><time>{timeLabel()}</time>
            </div>
          ) : null}

          {chat.progressLabels.map((label, index) => <div className="wa-bubble wa-incoming wa-progress" key={`${index}-${label}`}><span className="wa-spinner" /><p>{label}</p><time>{timeLabel()}</time></div>)}

          {chat.error ? <div className="wa-bubble wa-incoming wa-error"><p>{chat.error}</p><button onClick={reset}>Start again</button></div> : null}

          {result ? (
            <div className="wa-results">
              <div className="wa-bubble wa-incoming"><p><strong>I found {result.recommendations.length} useful answers.</strong></p><p>Tap one to inspect evidence, unknowns, and the seller.</p><time>{timeLabel()}</time></div>
              {result.recommendations.map((recommendation) => {
                const offer = result.offers[recommendation.offerId];
                const product = result.products[offer.productId];
                const merchant = result.merchants[offer.merchantId];
                const price = offer.totalPrice?.value ?? offer.price.value;
                return <button className="wa-product-card" key={`${recommendation.role}-${offer.id}`} onClick={() => setSelectedOfferId(offer.id)}>
                  <div className="wa-product-image" style={product.imageUrl ? { backgroundImage: `url(${product.imageUrl})` } : undefined}>{!product.imageUrl ? product.title.slice(0, 1) : null}</div>
                  <div><small>{roleNames[recommendation.role]} · {merchant.name}</small><strong>{product.title}</strong><p>{recommendation.headline}</p><b>{price ? money(price.amount, price.currency) : "Price unchecked"}</b></div>
                </button>;
              })}
              <button className="wa-new-search" onClick={reset}>＋ Start another search</button>
            </div>
          ) : null}
          <div ref={bottomRef} />
        </div>

        {chat.phase === "intake" ? <div className="wa-depth"><span>Warranted depth</span><input type="range" min="0" max="100" value={chat.depth} onChange={(event) => commit({ depth: Number(event.target.value) })} /><b>{chat.depth}</b></div> : null}
        {(chat.phase === "intake" || currentQuestion) ? (
          <form className="wa-composer" onSubmit={chat.phase === "intake" ? mapRequest : submitDraft}>
            <button type="button" aria-label="Emoji">☺</button><button type="button" aria-label="Attach context">⌕</button>
            <input value={draft} onChange={(event) => setDraft(event.target.value)} placeholder={chat.phase === "intake" ? "Describe what you want to buy" : "Type your own answer"} />
            <button className="wa-send" type="submit" disabled={!draft.trim() || busy} aria-label="Send">➤</button>
          </form>
        ) : <div className="wa-composer wa-composer-idle"><span>Realtime chat · {chatId?.slice(0, 8)}</span></div>}
      </section>

      {selectedOffer && selectedProduct && result ? (
        <aside className="wa-detail">
          <header><button onClick={() => setSelectedOfferId(null)}>×</button><strong>Product details</strong></header>
          <div className="wa-detail-scroll">
            <div className="wa-detail-image" style={selectedProduct.imageUrl ? { backgroundImage: `url(${selectedProduct.imageUrl})` } : undefined} />
            <h2>{selectedProduct.title}</h2>
            <p>{result.merchants[selectedOffer.merchantId].name} · {selectedOffer.condition}</p>
            <h3>Standardized fields</h3>
            {selectedProduct.specs.length ? selectedProduct.specs.map((spec) => <div className="wa-fact" key={spec.aspectId}><span>{spec.aspectId}</span><strong>{String(spec.value ?? "Not yet checked")}{spec.unit ? ` ${spec.unit}` : ""}</strong><small>{spec.source} · {Math.round(spec.confidence * 100)}% · {spec.depth}</small></div>) : <p className="wa-unknown">No product specifications have been checked yet.</p>}
            <div className="wa-fact"><span>Availability</span><strong>{selectedOffer.availability.value ?? "Checked, unknown"}</strong><small>{selectedOffer.availability.source} · {selectedOffer.availability.depth}</small></div>
            <div className="wa-fact"><span>Product page</span><a href={selectedOffer.url} target="_blank" rel="noreferrer">Open evidence ↗</a></div>
            <button className="wa-action" onClick={() => proposeCheckout(selectedOffer.id)} disabled={busy}>Prepare checkout proposal →</button>
          </div>
        </aside>
      ) : null}

      {proposal ? <div className="consent-overlay" role="dialog" aria-modal="true"><CheckoutProposalCard proposal={proposal} onUpdated={setProposal} onClose={() => setProposal(null)} /></div> : null}
    </main>
  );
}
