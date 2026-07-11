import type { CheckoutDecision, CheckoutProposal } from "./checkout";
import type { RecommendationSet, ResearchRequest } from "./research";

/**
 * HTTP seam between the UI and the research service. Route handlers live in
 * src/app/api (research workstream); the UI calls them with these shapes.
 *
 *  POST /api/research                          ResearchRequest → StartResearchResponse
 *  GET  /api/research/[runId]/events           SSE stream of ProgressEvent (see events.ts);
 *                                              each SSE `data:` line is one JSON ProgressEvent,
 *                                              terminated by run_completed | run_failed
 *  GET  /api/research/[runId]/result           → RecommendationSet (404 until completed)
 *  POST /api/checkout/proposals                ProposeCheckoutRequest → CheckoutProposal
 *  POST /api/checkout/proposals/[id]/decision  CheckoutDecision → CheckoutProposal (updated)
 */

export type StartResearchResponse = {
  runId: string;
};

export type ProposeCheckoutRequest = {
  runId: string;
  offerId: string;
};

export type ApiError = {
  error: string;
};

export const API = {
  startResearch: "/api/research",
  researchEvents: (runId: string) => `/api/research/${runId}/events`,
  researchResult: (runId: string) => `/api/research/${runId}/result`,
  proposeCheckout: "/api/checkout/proposals",
  decideCheckout: (proposalId: string) => `/api/checkout/proposals/${proposalId}/decision`,
} as const;

export type { CheckoutDecision, CheckoutProposal, RecommendationSet, ResearchRequest };
