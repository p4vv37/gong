const baseUrl = process.env.GONG_URL ?? "http://127.0.0.1:3000";

async function json<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(`${baseUrl}${path}`, {
    ...init,
    headers: { "Content-Type": "application/json", ...init?.headers },
  });
  const payload = await response.json();
  if (!response.ok) throw new Error(`${path} returned ${response.status}: ${JSON.stringify(payload)}`);
  return payload as T;
}

const brief = {
  request: "Warm waterproof jacket under 900 PLN",
  category: "Outerwear",
  market: { country: "Poland", currency: "PLN", language: "English / Polish" },
  budget: { max: 900, currency: "PLN" },
  warrantedDepth: 50,
  criteria: [
    { id: "budget", label: "Maximum budget", value: "900 PLN", kind: "must", source: "request" },
  ],
  answeredQuestionIds: [],
  readyForSearch: true,
};

async function main() {
const started = await json<{ runId: string }>("/api/research", {
  method: "POST",
  body: JSON.stringify({ brief, mode: "fixture" }),
});
console.log(`[smoke] research started: ${started.runId}`);

let result: { runId: string } | undefined;
for (let attempt = 0; attempt < 40; attempt += 1) {
  const response = await fetch(`${baseUrl}/api/research/${started.runId}/result`, { cache: "no-store" });
  if (response.ok) {
    result = await response.json();
    break;
  }
  await new Promise((resolve) => setTimeout(resolve, 500));
}
if (!result) throw new Error("fixture research did not complete");
console.log("[smoke] fixture recommendation set ready");

const proposal = await json<{
  id: string;
  orchestrator?: { purchaseId: string; approvalId?: string; status: string };
}>("/api/checkout/proposals", {
  method: "POST",
  body: JSON.stringify({ runId: started.runId, offerId: "off-1" }),
});
if (proposal.orchestrator?.status !== "AWAITING_APPROVAL") {
  throw new Error(`unexpected proposal status: ${JSON.stringify(proposal.orchestrator)}`);
}
console.log(`[smoke] Purchase Orchestrator awaiting approval: ${proposal.orchestrator.purchaseId}`);

const decided = await json<{
  status: string;
  order?: { orderId: string };
  orchestrator?: { status: string };
}>(`/api/checkout/proposals/${proposal.id}/decision`, {
  method: "POST",
  body: JSON.stringify({ proposalId: proposal.id, approve: true }),
});
if (decided.status !== "approved" || decided.orchestrator?.status !== "PURCHASED" || !decided.order) {
  throw new Error(`pipeline did not finish: ${JSON.stringify(decided)}`);
}
console.log(`[smoke] full pipeline completed with dummy purchase: ${decided.order.orderId}`);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
