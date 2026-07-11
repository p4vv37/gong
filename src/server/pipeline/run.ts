import { randomUUID } from "node:crypto";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import type { ProgressEvent, RecommendationSet, ResearchRequest } from "../../contract";
import { FIXTURE_RESULT, makeFixtureEvents } from "../../contract";
import { deepenMerchant } from "./deepen";
import { discover } from "./discover";
import { assess, pickDeepDives, recommend } from "./rank";
import type { Emit } from "./run-helpers";
import { newRunState, toRecommendationSet } from "./state";
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
};

const globalStore = globalThis as unknown as { __researchRuns?: Map<string, RunEntry> };
const runs: Map<string, RunEntry> = (globalStore.__researchRuns ??= new Map());

export function getRun(runId: string): RunEntry | undefined {
  return runs.get(runId);
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

async function persist(run: RunEntry): Promise<void> {
  try {
    const dir = path.join(process.cwd(), "data", "runs");
    await mkdir(dir, { recursive: true });
    await writeFile(path.join(dir, `${run.id}.json`), JSON.stringify({ status: run.status, result: run.result }, null, 1));
  } catch {
    // persistence is best-effort
  }
}

export function startRun(request: ResearchRequest): string {
  const id = `run-${randomUUID().slice(0, 8)}`;
  const run: RunEntry = { id, status: "running", events: [], listeners: new Set() };
  runs.set(id, run);
  void (request.mode === "fixture" ? executeFixture(run) : executeLive(run, request)).catch((err) => {
    run.status = "failed";
    emitTo(run)({ type: "run_failed", detail: String(err), label: "Research failed" });
  });
  return id;
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
  const deepDiveCount = request.limits?.deepDiveCount ?? 4;

  emit({ type: "run_started", mode: "live", label: `Researching: ${request.brief.request}` });

  emit({ type: "phase_started", phase: "discovery", round: 1, label: "Searching Google Shopping, the open web and store catalogs…" });
  await discover(state, emit);

  emit({ type: "phase_started", phase: "standardize", round: 1, label: "Reading product pages and normalizing offers…" });
  await standardize(state, emit);

  let assessments = assess(state);
  const eligibleCount = Object.values(assessments).filter((a) => a.eligible).length;
  emit({ type: "offers_ranked", eligibleCount, round: 1, label: `${state.offers.size} offers found, ${eligibleCount} within constraints` });

  if (maxRounds > 1 && eligibleCount > 0) {
    const targets = pickDeepDives(state, assessments, deepDiveCount);
    if (targets.length) {
      emit({ type: "phase_started", phase: "deepen", round: 2, label: `Verifying shipping, returns and payments at ${targets.length} stores in parallel…` });
      await Promise.all(targets.map((offerId) => deepenMerchant(state, offerId, emit)));
      assessments = assess(state);
      emit({ type: "offers_ranked", eligibleCount: Object.values(assessments).filter((a) => a.eligible).length, round: 2, label: "Re-ranked with verified policies" });
    }
  }

  const recommendations = recommend(state, assessments);
  run.result = toRecommendationSet(state, { assessments, recommendations, roundsCompleted: maxRounds });
  run.status = "completed";
  emit({ type: "run_completed", result: run.result, label: `Research complete: ${recommendations.length} recommendations from ${state.offers.size} offers` });
  await persist(run);
}
