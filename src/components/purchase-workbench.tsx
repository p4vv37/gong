"use client";

import { FormEvent, useMemo, useState } from "react";
import { questionsForDepth } from "@/domain/clothing-questions";
import {
  applyQuestionAnswer,
  createPurchaseBrief,
  type PurchaseBrief,
  type QuestionChoice,
} from "@/domain/purchase-brief";

const exampleRequest = "A warm everyday winter jacket under 900 PLN, not too sporty, for Warsaw weather";

function depthCopy(depth: number) {
  if (depth <= 25) return "Quick choice · only decisions likely to change the winner";
  if (depth <= 65) return "Balanced · fit, ownership, reviews and seller trust";
  return "Deep · detailed trade-offs, uncertainty and purchase risk";
}

export function PurchaseWorkbench() {
  const [request, setRequest] = useState(exampleRequest);
  const [depth, setDepth] = useState(58);
  const [brief, setBrief] = useState<PurchaseBrief | null>(null);
  const [customAnswer, setCustomAnswer] = useState("");
  const questions = useMemo(() => questionsForDepth(brief?.warrantedDepth ?? depth), [brief?.warrantedDepth, depth]);
  const currentQuestion = brief ? questions[brief.answeredQuestionIds.length] : undefined;

  function startResearch(event: FormEvent) {
    event.preventDefault();
    if (!request.trim()) return;
    setBrief(createPurchaseBrief(request.trim(), depth));
    setCustomAnswer("");
  }

  function answer(choice: QuestionChoice | string) {
    if (!brief || !currentQuestion) return;
    setBrief(applyQuestionAnswer(brief, currentQuestion, choice, questions.length));
    setCustomAnswer("");
  }

  function reset() {
    setBrief(null);
    setCustomAnswer("");
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
          <div className="status-pill"><span /> Local prototype</div>
        </header>

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

        {!brief ? (
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
            <button className="primary-button" type="submit">Map the decision <span>→</span></button>
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
                  <div className="choice-grid">
                    {currentQuestion.choices.map((choice) => (
                      <button key={choice.id} className="choice-card" type="button" onClick={() => answer(choice)}>
                        <strong>{choice.label}</strong>
                        <span>{choice.consequence}</span>
                      </button>
                    ))}
                  </div>
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
                      placeholder="Or describe exactly what you want…"
                    />
                    <button type="submit" disabled={!customAnswer.trim()}>→</button>
                  </form>
                </div>
              ) : (
                <div className="ready-state">
                  <span className="ready-icon">✓</span>
                  <p className="eyebrow">Decision mapped</p>
                  <h2>Ready to search with intent.</h2>
                  <p>The next checkpoint connects this brief to the OpenAI Agents SDK. No live search has run in this keyless prototype.</p>
                  <button className="primary-button" type="button" disabled>Start product research <span>→</span></button>
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
          <span>Checkpoint 01</span>
          <p>Deterministic clothing demo · no API keys · nothing is purchased</p>
        </footer>
      </div>
    </main>
  );
}
