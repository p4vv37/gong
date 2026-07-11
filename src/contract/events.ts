import type { RecommendationSet } from "./research";

/**
 * Progress events streamed over SSE while a research run executes.
 * Every event has a human-readable `label` so the UI can render a progress
 * feed without knowing pipeline internals ("checked return policy at x-kom.pl").
 */

export type ResearchPhase =
  | "discovery"
  | "standardize"
  | "rank"
  | "deepen"
  | "done";

type Base = {
  runId: string;
  at: string; // ISO timestamp
  label: string; // user-facing, one line
};

export type ProgressEvent =
  | (Base & { type: "run_started"; mode: "fixture" | "live" })
  | (Base & { type: "phase_started"; phase: ResearchPhase; round: number })
  | (Base & { type: "source_searched"; channel: "serpapi" | "firecrawl" | "shopify_probe" })
  | (Base & { type: "candidate_found"; url: string; merchantDomain: string })
  | (Base & { type: "offer_normalized"; offerId: string; extractionSource: string })
  | (Base & { type: "offers_ranked"; eligibleCount: number; round: number })
  | (Base & { type: "deep_dive_started"; merchantDomain: string; offerId: string })
  | (Base & { type: "deep_dive_completed"; merchantDomain: string; offerId: string; learned: string[] })
  | (Base & { type: "warning"; detail: string }) // per-site failure etc.; run continues
  | (Base & { type: "run_failed"; detail: string })
  | (Base & { type: "run_completed"; result: RecommendationSet });

export type ProgressEventType = ProgressEvent["type"];
