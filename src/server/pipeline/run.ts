import { randomUUID } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import type { ProgressEvent, RecommendationSet, ResearchRequest } from "../../contract";
import { FIXTURE_RESULT, makeFixtureEvents } from "../../contract";
import { llmEnabled } from "../agents/client";
import { auditStorage, type AuditEntry } from "../audit";
import { deepenMerchant } from "./deepen";
import { resolveIdentity } from "./identity";
import { LIMITS } from "./limits";
import { discover } from "./discover";
import { assess, pickDeepDives, recommend } from "./rank";
import type { Emit } from "./run-helpers";
import { hydrateState, newRunState, toRecommendationSet } from "./state";
import { standardize } from "./standardize";

/**
 * Run orchestrator + in-process registry. Runs execute in the background of
 * the Next.js server process; the SSE route subscribes to events and the
 * result route reads the registry (with a JSON file fallback under data/runs
 * for robustness across dev reloads).
 */

type RunEntry = {
  id: string;
  status: "running" | "completed" | "failed";
  events: ProgressEvent[];
  listeners: Set<(e: ProgressEvent) => void>;
  result?: RecommendationSet;
  audit: AuditEntry[];
  request?: ResearchRequest;
};

const globalStore = globalThis as unknown as { __researchRuns?: Map<string, RunEntry> };
const runs: Map<string, RunEntry> = (globalStore.__researchRuns ??= new Map());

const runFile = (runId: string) => path.join(process.cwd(), "data", "runs", `${runId}.json`);

export function getRun(runId: string): RunEntry | undefined {
  return runs.get(runId);
}

/** Registry lookup with file fallback — completed runs survive server restarts. */
export async function loadRun(runId: string): Promise<RunEntry | undefined> {
  const inMemory = runs.get(runId);
  if (inMemory) return inMemory;
  if (!/^run-[a-z0-9-]+$/i.test(runId)) return undefined;
  try {
    const raw = JSON.parse(await readFile(runFile(runId), "utf8")) as {
      status: RunEntry["status"];
      result?: RecommendationSet;
      events?: ProgressEvent[];
      audit?: AuditEntry[];
      request?: ResearchRequest;
    };
    const entry: RunEntry = {
      id: runId,
      status: raw.status,
      result: raw.result,
      events: raw.events ?? [],
      audit: raw.audit ?? [],
      request: raw.request,
      listeners: new Set(),
    };
    runs.set(runId, entry);
    return entry;
  } catch {
    return undefined;
  }
}

export function subscribe(runId: string, cb: (e: ProgressEvent) => void): (() => void) | undefined {
  const run = runs.get(runId);
  if (!run) return undefined;
  for (const e of run.events) cb(e); // replay history first
  run.listeners.add(cb);
  return () => run.listeners.delete(cb);
}

function emitTo(run: RunEntry): Emit {
  return (partial) => {
    const event = { ...partial, runId: run.id, at: new Date().toISOString() } as ProgressEvent;
    run.events.push(event);
    for (const cb of run.listeners) cb(event);
  };
}

export async function persist(run: RunEntry): Promise<void> {
  try {
    await mkdir(path.dirname(runFile(run.id)), { recursive: true });
    await writeFile(
      runFile(run.id),
      JSON.stringify({ status: run.status, result: run.result, events: run.events, audit: run.audit, request: run.request }, null, 1),
    );
  } catch {
    // persistence is best-effort
  }
}

export function startRun(request: ResearchRequest): string {
  const id = `run-${randomUUID().slice(0, 8)}`;
  const run: RunEntry = { id, status: "running", events: [], listeners: new Set(), audit: [], request };
  runs.set(id, run);
  void auditStorage
    .run(run.audit, () => (request.mode === "fixture" ? executeFixture(run) : executeLive(run, request)))
    .catch(async (err) => {
      run.status = "failed";
      emitTo(run)({ type: "run_failed", detail: String(err), label: "Research failed" });
      await persist(run);
    });
  return id;
}

/**
 * On-demand deepening: the user opened a product's detail view — verify that
 * merchant's policies now. Re-assesses and persists the updated result; new
 * events append to the run's history (and stream to any open subscribers).
 */
export async function deepenOnDemand(runId: string, offerId: string): Promise<RecommendationSet | { error: string }> {
  const run = await loadRun(runId);
  if (!run?.result) return { error: "unknown or unfinished run" };
  if (run.request?.mode !== "live") return { error: "on-demand deepening works on live runs only" };
  if (!run.result.offers[offerId]) return { error: `unknown offer ${offerId}` };

  const emit = emitTo(run);
  const state = hydrateState(run.id, run.request, run.result);
  await auditStorage.run(run.audit, () => deepenMerchant(state, offerId, emit));

  const bracket = run.result.priceBracket;
  const assessments = assess(state, bracket);
  const recommendations = recommend(state, assessments, bracket);
  run.result = {
    ...toRecommendationSet(state, {
      assessments,
      recommendations,
      roundsCompleted: run.result.roundsCompleted + 1,
    }),
    priceBracket: bracket,
  };
  await persist(run);
  return run.result;
}

async function executeFixture(run: RunEntry): Promise<void> {
  const emit = emitTo(run);
  for (const event of makeFixtureEvents(run.id)) {
    await new Promise((r) => setTimeout(r, 400 + Math.random() * 500));
    if (event.type === "run_completed") {
      run.result = { ...FIXTURE_RESULT, runId: run.id };
      run.status = "completed";
      emit({ ...event, result: run.result });
      await persist(run);
    } else {
      emit(event);
    }
  }
}

async function executeLive(run: RunEntry, request: ResearchRequest): Promise<void> {
  const emit = emitTo(run);
  const state = newRunState(run.id, request);
  const maxRounds = request.limits?.maxRounds ?? 2;
  const deepDiveCount = request.limits?.deepDiveCount ?? LIMITS.deepDives();

  emit({ type: "run_started", mode: "live", label: `Researching: ${request.brief.request}` });

  // warranted price bracket runs CONCURRENTLY with discovery and comes from
  // an independent channel (hosted web search), so the scrape pool can't
  // skew what counts as cheap or expensive
  const bracketPromise: Promise<typeof request.priceBracket> = request.priceBracket
    ? Promise.resolve(request.priceBracket)
    : llmEnabled()
      ? import("../agents/price-bracket").then(({ researchPriceBracket }) => researchPriceBracket(request.brief)).catch((err) => {
          emit({ type: "warning", detail: String(err), label: "Market price research unavailable — ranking on discovered prices only" });
          return undefined;
        })
      : Promise.resolve(undefined);

  emit({ type: "phase_started", phase: "discovery", round: 1, label: "Searching Google Shopping, the open web and store catalogs…" });
  await discover(state, emit);

  emit({ type: "phase_started", phase: "standardize", round: 1, label: "Reading product pages and normalizing offers…" });
  await standardize(state, emit);
  await resolveIdentity(state, emit);

  if (llmEnabled() && state.offers.size) {
    emit({ type: "phase_started", phase: "rank", round: 1, label: "Judging how well each offer fits your criteria…" });
    try {
      const { judgeFit } = await import("../agents/fit-judge");
      await judgeFit(state);
    } catch (err) {
      emit({ type: "warning", detail: String(err), label: "Fit judging unavailable — using keyword matching" });
    }
  }

  const bracket = await bracketPromise;
  if (bracket) {
    const budgetNote =
      bracket.budgetAssessment === "below_market"
        ? " — your budget is below the realistic market floor"
        : bracket.budgetAssessment === "tight"
          ? " — your budget is tight for this category"
          : "";
    emit({
      type: "price_bracket",
      bracket,
      label: `Market check (independent of these offers): typical ${bracket.typical[0]}–${bracket.typical[1]} ${bracket.currency}, premium above ${bracket.premium}${budgetNote}`,
    });
  }

  let assessments = assess(state, bracket);
  const eligibleCount = Object.values(assessments).filter((a) => a.eligible).length;
  emit({ type: "offers_ranked", eligibleCount, round: 1, label: `${state.offers.size} offers found, ${eligibleCount} within constraints` });

  if (maxRounds > 1 && eligibleCount > 0) {
    const targets = pickDeepDives(state, assessments, deepDiveCount);
    if (targets.length) {
      emit({ type: "phase_started", phase: "deepen", round: 2, label: `Verifying shipping, returns and payments at ${targets.length} stores in parallel…` });
      await Promise.all(targets.map((offerId) => deepenMerchant(state, offerId, emit)));
      assessments = assess(state, bracket);
      emit({ type: "offers_ranked", eligibleCount: Object.values(assessments).filter((a) => a.eligible).length, round: 2, label: "Re-ranked with verified policies" });
    }
  }

  const recommendations = recommend(state, assessments, bracket);
  if (llmEnabled() && recommendations.length) {
    try {
      const { polishRecommendations } = await import("../agents/writer");
      await polishRecommendations(state, recommendations);
    } catch (err) {
      emit({ type: "warning", detail: String(err), label: "Prose writer unavailable — using generated headlines" });
    }
  }
  run.result = { ...toRecommendationSet(state, { assessments, recommendations, roundsCompleted: maxRounds }), priceBracket: bracket };
  run.status = "completed";
  emit({ type: "run_completed", result: run.result, label: `Research complete: ${recommendations.length} recommendations from ${state.offers.size} offers` });
  await persist(run);
}
