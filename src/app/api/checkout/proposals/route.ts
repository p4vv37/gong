import { NextResponse } from "next/server";
import type { ProposeCheckoutRequest } from "../../../../contract";
import { createProposal } from "../../../../server/checkout";
import { loadRun } from "../../../../server/pipeline/run";
import { submitToPurchaseOrchestrator } from "../../../../server/purchase-orchestrator";

export const dynamic = "force-dynamic";

export async function POST(req: Request): Promise<NextResponse> {
  let body: ProposeCheckoutRequest;
  try {
    body = (await req.json()) as ProposeCheckoutRequest;
  } catch {
    return NextResponse.json({ error: "invalid JSON body" }, { status: 400 });
  }
  const run = await loadRun(body.runId ?? "");
  if (!run?.result) return NextResponse.json({ error: "unknown or unfinished run" }, { status: 404 });

  const proposal = createProposal(run.result, body.offerId ?? "");
  if ("error" in proposal) return NextResponse.json(proposal, { status: 400 });

  try {
    const purchase = await submitToPurchaseOrchestrator(proposal);
    proposal.orchestrator = {
      purchaseId: purchase.purchase_id,
      approvalId: purchase.approval_id ?? undefined,
      status: purchase.status,
    };
  } catch (error) {
    return NextResponse.json({ error: `purchase orchestration failed: ${String(error)}` }, { status: 502 });
  }
  return NextResponse.json(proposal, { status: 201 });
}
