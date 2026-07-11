"use client";

import { FormEvent, useEffect, useState } from "react";
import { API, type RecommendationSet } from "@/contract/http";
import type { ProgressEvent } from "@/contract/events";
import type { ResearchMode } from "@/contract/research";
import {
  applyQuestionAnswer,
  createPurchaseBrief,
  type DecisionQuestion,
  type PurchaseBrief,
  type QuestionChoice,
} from "@/domain/purchase-brief";
import { decisionQuestionSchema, questionPlanSchema } from "@/lib/question-plan/schema";
import { RecommendationResults } from "./recommendation-results";
import { ResearchProgress } from "./research-progress";

const exampleRequest = "A warm everyday winter jacket under 900 PLN, not too sporty, for Warsaw weather";

function depthCopy(depth: number) {
  if (depth <= 25) return "Quick choice · only decisions likely to change the winner";
  if (depth <= 65) return "Balanced · fit, ownership, reviews and seller trust";
  return "Deep · detailed trade-offs, uncertainty and purchase risk";
}

function safeExternalUrl(value: string) {
  try {
    const url = new URL(value);
    return url.protocol === "https:" || url.protocol === "http:" ? url.href : null;
  } catch {
    return null;
  }
}

export function PurchaseWorkbench() {
  const [request, setRequest] = useState(exampleRequest);
  const [depth, setDepth] = useState(58);
  const [brief, setBrief] = useState<PurchaseBrief | null>(null);
  const [questions, setQuestions] = useState<DecisionQuestion[]>([]);
  const [provider, setProvider] = useState<"mock" | "openai">("mock");
  const [planning, setPlanning] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [customAnswer, setCustomAnswer] = useState("");
  const [rangeAnswer, setRangeAnswer] = useState({ min: "", max: "" });
  const [multiAnswerIds, setMultiAnswerIds] = useState<string[]>([]);
  const [taxonomySummary, setTaxonomySummary] = useState<string | null>(null);
  const [taxonomySources, setTaxonomySources] = useState<Array<{ title: string; url: string }>>([]);
  const [view, setView] = useState<"conversation" | "research" | "results">("conversation");
  const [runId, setRunId] = useState<string | null>(null);
  const [progressEvents, setProgressEvents] = useState<ProgressEvent[]>([]);
  const [researchResult, setResearchResult] = useState<RecommendationSet | null>(null);
  const [researchError, setResearchError] = useState<string | null>(null);
  const [researchMode, setResearchMode] = useState<ResearchMode>("fixture");
  const currentQuestion = brief ? questions[brief.answeredQuestionIds.length] : undefined;

  useEffect(() => {
    let restoreTimer: number | undefined;
    try {
      const raw = localStorage.getItem("gong.purchase-session.v1");
      if (!raw) return;
      const saved = JSON.parse(raw) as {
        request: string;
        depth: number;
        brief: PurchaseBrief;
        questions: DecisionQuestion[];
        provider: "mock" | "openai";
        taxonomySummary?: string | null;
        taxonomySources?: Array<{ title: string; url: string }>;
      };
      const validatedQuestions = saved.questions.map((question) => decisionQuestionSchema.parse(question));
      restoreTimer = window.setTimeout(() => {
        setRequest(saved.request);
        setDepth(saved.depth);
        setBrief(saved.brief);
        setQuestions(validatedQuestions);
        setProvider(saved.provider);
        setTaxonomySummary(saved.taxonomySummary ?? null);
        setTaxonomySources(saved.taxonomySources ?? []);
      }, 0);
    } catch {
      localStorage.removeItem("gong.purchase-session.v1");
    }

    return () => {
      if (restoreTimer !== undefined) window.clearTimeout(restoreTimer);
    };
  }, []);

  useEffect(() => {
    if (!brief || questions.length === 0) return;
    localStorage.setItem(
      "gong.purchase-session.v1",
      JSON.stringify({ request, depth, brief, questions, provider, taxonomySummary, taxonomySources }),
    );
  }, [brief, depth, provider, questions, request, taxonomySources, taxonomySummary]);

  useEffect(() => {
    if (!runId || view !== "research") return;
    const source = new EventSource(API.researchEvents(runId));
    let terminal = false;

    source.onmessage = (message) => {
      try {
        const event = JSON.parse(message.data) as ProgressEvent;
        if (!event?.type || !event.label) return;
        setProgressEvents((current) => [...current, event]);

        if (event.type === "run_completed") {
          terminal = true;
          source.close();
          setResearchResult(event.result);
          setView("results");
        } else if (event.type === "run_failed") {
          terminal = true;
          source.close();
          setResearchError(event.detail);
        }
      } catch {
        setResearchError("A malformed research progress event was ignored.");
      }
    };

    source.onerror = () => {
      if (!terminal) setResearchError("Progress connection interrupted. Reconnecting…");
    };

    return () => source.close();
  }, [runId, view]);

  async function startResearch(event: FormEvent) {
    event.preventDefault();
    if (!request.trim() || planning) return;
    setPlanning(true);
    setError(null);

    try {
      const response = await fetch("/api/question-plan", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ request: request.trim(), warrantedDepth: depth }),
      });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.error ?? "Category research failed");

      const plan = questionPlanSchema.parse(payload.plan);
      const nextBrief = createPurchaseBrief(request.trim(), depth);
      const resolvedCriteria = plan.resolvedConstraints.map((constraint) => ({
        id: `research-${constraint.aspectId}`,
        label: constraint.label,
        value: constraint.value,
        kind: constraint.kind,
        source: "inference" as const,
      }));
      setQuestions(plan.questions);
      setProvider(payload.provider === "openai" ? "openai" : "mock");
      setTaxonomySummary(plan.taxonomySummary);
      setTaxonomySources(plan.sources);
      setBrief({ ...nextBrief, category: plan.category, criteria: [...nextBrief.criteria, ...resolvedCriteria] });
      setCustomAnswer("");
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Category research failed");
    } finally {
      setPlanning(false);
    }
  }

  function answer(choice: QuestionChoice | QuestionChoice[] | string) {
    if (!brief || !currentQuestion) return;
    setBrief(applyQuestionAnswer(brief, currentQuestion, choice, questions.length));
    setCustomAnswer("");
    setRangeAnswer({ min: "", max: "" });
    setMultiAnswerIds([]);
  }

  function toggleMultiChoice(choice: QuestionChoice) {
    const isExclusive = choice.criterion.kind === "indifferent" || choice.criterion.kind === "delegate";
    const exclusiveIds = new Set(
      currentQuestion?.choices
        .filter((item) => item.criterion.kind === "indifferent" || item.criterion.kind === "delegate")
        .map((item) => item.id) ?? [],
    );

    setMultiAnswerIds((current) => {
      if (current.includes(choice.id)) return current.filter((id) => id !== choice.id);
      if (isExclusive) return [choice.id];
      return [...current.filter((id) => !exclusiveIds.has(id)), choice.id];
    });
  }

  function reset() {
    localStorage.removeItem("gong.purchase-session.v1");
    setBrief(null);
    setQuestions([]);
    setError(null);
    setCustomAnswer("");
    setRangeAnswer({ min: "", max: "" });
    setMultiAnswerIds([]);
    setTaxonomySummary(null);
    setTaxonomySources([]);
    setView("conversation");
    setRunId(null);
    setProgressEvents([]);
    setResearchResult(null);
    setResearchError(null);
  }

  async function beginProductResearch() {
    if (!brief?.readyForSearch) return;
    setView("research");
    setProgressEvents([]);
    setResearchError(null);
    setResearchResult(null);

    try {
      const response = await fetch(API.startResearch, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ brief, mode: researchMode }),
      });
      const payload = await response.json();
      if (!response.ok || !payload.runId) throw new Error(payload.error ?? "Research could not be started");
      setRunId(payload.runId);
    } catch (cause) {
      setResearchError(cause instanceof Error ? cause.message : "Research could not be started");
    }
  }

  function cancelResearch() {
    setRunId(null);
    setView("conversation");
    setResearchError(null);
  }

  return (
    <main className="min-h-screen px-4 py-5 md:px-8 md:py-8">
      <div className="mx-auto max-w-[1480px]">
        <header className="mb-6 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="logo-mark">g</div>
            <div>
              <p className="text-sm font-semibold tracking-tight">gong</p>
              <p className="text-xs text-[var(--muted)]">purchase intelligence</p>
            </div>
          </div>
          <div className="status-pill"><span /> {view === "research" ? "Researching" : view === "results" ? "Recommendations ready" : brief && provider === "openai" ? "OpenAI agent" : "Local prototype"}</div>
        </header>

        {view === "conversation" ? (
          <section className="hero-grid">
            <div>
              <p className="eyebrow">A decision interface, not another search box</p>
              <h1>Tell us what good looks like.<br /><em>We&apos;ll resolve the rest.</em></h1>
            </div>
            <p className="hero-copy">
              The agent researches what matters for this product, asks only warranted questions,
              then investigates products, sellers, policies and reviews with evidence attached.
            </p>
          </section>
        ) : null}

        {view === "research" ? (
          <ResearchProgress events={progressEvents} error={researchError} mode={researchMode} onCancel={cancelResearch} />
        ) : view === "results" && researchResult ? (
          <RecommendationResults result={researchResult} events={progressEvents} onNewRequest={reset} />
        ) : !brief ? (
          <form className="request-card" onSubmit={startResearch}>
            <label htmlFor="request">What are you looking for?</label>
            <textarea
              id="request"
              value={request}
              onChange={(event) => setRequest(event.target.value)}
              placeholder="Product, budget, use case, preferences…"
              rows={4}
            />
            <div className="depth-row">
              <div>
                <div className="depth-label"><span>Warranted depth</span><strong>{depth}</strong></div>
                <p>{depthCopy(depth)}</p>
              </div>
              <input
                aria-label="Warranted research depth"
                type="range"
                min="0"
                max="100"
                value={depth}
                onChange={(event) => setDepth(Number(event.target.value))}
              />
            </div>
            {error ? <p className="form-error" role="alert">{error}</p> : null}
            <button className="primary-button" type="submit" disabled={planning || !request.trim()}>
              {planning ? "Researching category…" : "Map the decision"} <span>→</span>
            </button>
          </form>
        ) : (
          <div className="workspace-grid">
            <section className="conversation-panel">
              <div className="panel-topline">
                <button className="text-button" type="button" onClick={reset}>← New request</button>
                <span>{brief.answeredQuestionIds.length} / {questions.length} decisions</span>
              </div>

              <div className="request-quote">
                <span>Your request</span>
                <p>{brief.request}</p>
              </div>

              {currentQuestion ? (
                <div className="question-block">
                  <p className="eyebrow">{currentQuestion.eyebrow}</p>
                  <h2>{currentQuestion.title}</h2>
                  <p className="why-copy">{currentQuestion.why}</p>
                  {(currentQuestion.answerFormat?.type ?? "single_select") === "multi_select" ? (
                    <>
                      <div className="choice-grid" aria-label="Select all acceptable options">
                        {currentQuestion.choices.map((choice) => {
                          const selected = multiAnswerIds.includes(choice.id);
                          return (
                            <button
                              key={choice.id}
                              className={`choice-card ${selected ? "choice-selected" : ""}`}
                              type="button"
                              aria-pressed={selected}
                              onClick={() => toggleMultiChoice(choice)}
                            >
                              <strong>{choice.label}</strong><span>{choice.consequence}</span>
                            </button>
                          );
                        })}
                      </div>
                      <button
                        className="typed-submit"
                        type="button"
                        disabled={multiAnswerIds.length === 0}
                        onClick={() => answer(currentQuestion.choices.filter((choice) => multiAnswerIds.includes(choice.id)))}
                      >
                        Continue with {multiAnswerIds.length || 0} selected <span>→</span>
                      </button>
                    </>
                  ) : ["number", "range"].includes(currentQuestion.answerFormat?.type ?? "") ? (
                    <form
                      className="numeric-answer"
                      onSubmit={(event) => {
                        event.preventDefault();
                        const unit = currentQuestion.answerFormat?.unit ? ` ${currentQuestion.answerFormat.unit}` : "";
                        const value = currentQuestion.answerFormat?.type === "range" ? `${rangeAnswer.min}–${rangeAnswer.max}${unit}` : `${rangeAnswer.min}${unit}`;
                        if (rangeAnswer.min && (currentQuestion.answerFormat?.type !== "range" || rangeAnswer.max)) answer(value);
                      }}
                    >
                      <label>
                        {currentQuestion.answerFormat?.type === "range" ? "Minimum" : currentQuestion.eyebrow}
                        <input
                          type="number"
                          value={rangeAnswer.min}
                          min={currentQuestion.answerFormat?.min ?? undefined}
                          max={currentQuestion.answerFormat?.max ?? undefined}
                          step={currentQuestion.answerFormat?.step ?? undefined}
                          placeholder={currentQuestion.answerFormat?.placeholder ?? undefined}
                          onChange={(event) => setRangeAnswer((current) => ({ ...current, min: event.target.value }))}
                        />
                      </label>
                      {currentQuestion.answerFormat?.type === "range" ? (
                        <label>Maximum<input type="number" value={rangeAnswer.max} min={currentQuestion.answerFormat.min ?? undefined} max={currentQuestion.answerFormat.max ?? undefined} step={currentQuestion.answerFormat.step ?? undefined} onChange={(event) => setRangeAnswer((current) => ({ ...current, max: event.target.value }))} /></label>
                      ) : null}
                      {currentQuestion.answerFormat?.unit ? <b>{currentQuestion.answerFormat.unit}</b> : null}
                      <button type="submit" disabled={!rangeAnswer.min || (currentQuestion.answerFormat?.type === "range" && !rangeAnswer.max)}>Continue <span>→</span></button>
                    </form>
                  ) : currentQuestion.answerFormat?.type === "text" ? null : (
                    <div className="choice-grid">
                      {currentQuestion.choices.map((choice) => (
                        <button key={choice.id} className="choice-card" type="button" onClick={() => answer(choice)}>
                          <strong>{choice.label}</strong>
                          <span>{choice.consequence}</span>
                        </button>
                      ))}
                    </div>
                  )}
                  <form
                    className="custom-answer"
                    onSubmit={(event) => {
                      event.preventDefault();
                      if (customAnswer.trim()) answer(customAnswer.trim());
                    }}
                  >
                    <input
                      value={customAnswer}
                      onChange={(event) => setCustomAnswer(event.target.value)}
                      placeholder={currentQuestion.answerFormat?.placeholder ?? "Or describe exactly what you want…"}
                    />
                    <button type="submit" disabled={!customAnswer.trim()}>→</button>
                  </form>
                </div>
              ) : (
                <div className="ready-state">
                  <span className="ready-icon">✓</span>
                  <p className="eyebrow">Decision mapped</p>
                  <h2>Ready to search with intent.</h2>
                  <p>{provider === "openai" ? "The OpenAI category agent produced this plan. Product search is the next stage." : "The deterministic fixture produced this plan. Add an OpenAI key to test live category reasoning."}</p>
                  {taxonomySummary ? (
                    <div className="taxonomy-note">
                      <strong>Researched product taxonomy</strong>
                      <p>{taxonomySummary}</p>
                      {taxonomySources.length ? (
                        <div>
                          {taxonomySources.map((source) => {
                            const href = safeExternalUrl(source.url);
                            return href ? <a href={href} target="_blank" rel="noreferrer" key={source.url}>{source.title} ↗</a> : null;
                          })}
                        </div>
                      ) : null}
                    </div>
                  ) : null}
                  <div className="research-mode-selector" aria-label="Research mode">
                    <button type="button" aria-pressed={researchMode === "fixture"} onClick={() => setResearchMode("fixture")}>
                      <strong>Fixture replay</strong><span>Fast, deterministic, no research API spend</span>
                    </button>
                    <button type="button" aria-pressed={researchMode === "live"} onClick={() => setResearchMode("live")}>
                      <strong>Live web</strong><span>Real offers and policies · may take several minutes</span>
                    </button>
                  </div>
                  {researchError ? <p className="form-error" role="alert">{researchError}</p> : null}
                  <button className="primary-button" type="button" onClick={beginProductResearch}>Start {researchMode === "live" ? "live" : "fixture"} research <span>→</span></button>
                </div>
              )}
            </section>

            <aside className="brief-panel">
              <div className="brief-heading">
                <div><p className="eyebrow">Live purchase brief</p><h3>{brief.category}</h3></div>
                <span>{brief.warrantedDepth}</span>
              </div>
              <div className="market-row"><span>Market</span><strong>{brief.market.country} · {brief.market.currency}</strong></div>
              <div className="criteria-list">
                {brief.criteria.length === 0 ? (
                  <p className="empty-copy">Your answers will become explicit constraints and preferences here.</p>
                ) : brief.criteria.map((criterion) => (
                  <div className="criterion" key={criterion.id}>
                    <span className={`kind kind-${criterion.kind}`}>{criterion.kind}</span>
                    <div><small>{criterion.label}</small><strong>{criterion.value}</strong></div>
                  </div>
                ))}
              </div>
              <div className="evidence-preview">
                <p>Evidence planned</p>
                <div><span>Product specifications</span><b /></div>
                <div><span>Product review quality</span><b /></div>
                <div><span>Store & seller reviews</span><b /></div>
                <div><span>Returns, shipping & payment</span><b /></div>
              </div>
            </aside>
          </div>
        )}

        <footer>
          <span>{view === "results" ? "Checkpoint 04" : view === "research" ? "Checkpoint 03" : "Checkpoint 02"}</span>
          <p>{view === "results" ? "Evidence and consent UI" : view === "research" ? "Fixture research replay" : provider === "openai" ? "Structured OpenAI plan" : "Deterministic clothing demo"} · nothing is purchased</p>
        </footer>
      </div>
    </main>
  );
}
