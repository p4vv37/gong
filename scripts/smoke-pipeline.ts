import type { ResearchRequest } from "../src/contract";
import { startRun, subscribe, getRun } from "../src/server/pipeline/run";

/** Full live pipeline run. . ../../.envrc && npx tsx scripts/smoke-pipeline.ts */

const request: ResearchRequest = {
  mode: "live",
  brief: {
    request: "kurtka przeciwdeszczowa męska do miasta, do 400 zł",
    category: "Outerwear",
    market: { country: "Poland", currency: "PLN", language: "Polish" },
    budget: { max: 400, currency: "PLN" },
    warrantedDepth: 60,
    criteria: [
      { id: "request-budget", label: "Maximum budget", value: "400 PLN", kind: "must", source: "request" },
      { id: "q-style-custom", label: "Style", value: "miejska, nie outdoorowa", kind: "prefer", source: "answer" },
      { id: "q-hood-1", label: "Kaptur", value: "z kapturem", kind: "prefer", source: "answer" },
    ],
    answeredQuestionIds: [],
    readyForSearch: true,
  },
  limits: { maxCandidates: 8, deepDiveCount: 3, maxRounds: 2 },
};

const runId = startRun(request);
console.log("runId:", runId);

subscribe(runId, (e) => {
  console.log(`[${e.type}] ${e.label}`);
  if (e.type === "run_completed" || e.type === "run_failed") {
    const result = getRun(runId)?.result;
    if (result) {
      console.log("\n===== offers:", Object.keys(result.offers).length, "merchants:", Object.keys(result.merchants).length);
      for (const rec of result.recommendations) {
        const a = result.assessments[rec.offerId];
        console.log(`\n[${rec.role}] ${rec.headline}`);
        console.log(`  score=${a.score.total} fit=${a.score.preferenceFit} value=${a.score.value} trust=${a.score.trust} unc=${a.score.uncertaintyPenalty}`);
        console.log(`  compromises: ${rec.compromises.join("; ") || "—"}`);
        console.log(`  unknowns: ${rec.unknowns.join(", ") || "—"}`);
        const offer = result.offers[rec.offerId];
        const policy = result.policies[offer.merchantId];
        console.log(`  url: ${offer.url}`);
        if (policy?.returns.value) console.log(`  returns: ${JSON.stringify(policy.returns.value)} (${policy.returns.source})`);
        if (policy?.shipping.value) console.log(`  shipping: ${JSON.stringify(policy.shipping.value)} (${policy.shipping.source})`);
        if (policy?.payment.value) console.log(`  payment: ${policy.payment.value.join(", ")} (${policy.payment.source})`);
      }
    }
    process.exit(e.type === "run_completed" ? 0 : 1);
  }
});
