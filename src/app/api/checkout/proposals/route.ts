import { NextResponse } from "next/server";
import type { ProposeCheckoutRequest } from "../../../../contract";
import { startPurchaseGate } from "../../../../server/agents/purchase-gate";
import { createProposal } from "../../../../server/checkout";
import { loadRun } from "../../../../server/pipeline/run";

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

  // Arm the Agents-SDK consent gate: the purchase run pauses on needsApproval
  // and its RunState is parked until the user's decision.
  try {
    await startPurchaseGate(proposal);
  } catch {
    // gate failures must never place orders; the keyless path still enforces consent
  }
  return NextResponse.json(proposal, { status: 201 });
}
