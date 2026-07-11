import { NextResponse } from "next/server";
import type { CheckoutDecision } from "../../../../../../contract";
import { decideProposal, getProposal } from "../../../../../../server/checkout";
import { decideOrchestratorPurchase } from "../../../../../../server/purchase-orchestrator";

export const dynamic = "force-dynamic";

export async function POST(req: Request, ctx: { params: Promise<{ proposalId: string }> }): Promise<NextResponse> {
  const { proposalId } = await ctx.params;
  let body: Partial<CheckoutDecision>;
  try {
    body = (await req.json()) as Partial<CheckoutDecision>;
  } catch {
    return NextResponse.json({ error: "invalid JSON body" }, { status: 400 });
  }
  if (typeof body.approve !== "boolean") {
    return NextResponse.json({ error: "approve: boolean is required" }, { status: 400 });
  }
  const pending = getProposal(proposalId);
  if (!pending) return NextResponse.json({ error: "unknown proposal" }, { status: 404 });
  if (pending.status !== "proposed") return NextResponse.json({ error: `proposal is ${pending.status}` }, { status: 400 });
  try {
    const purchase = await decideOrchestratorPurchase(pending, body.approve);
    const result = decideProposal({ proposalId, approve: body.approve, rejectionReason: body.rejectionReason });
    if ("error" in result) return NextResponse.json(result, { status: 400 });
    result.orchestrator = { ...pending.orchestrator!, status: purchase.status };
    if (body.approve && purchase.status === "PURCHASED") {
      result.order = { orderId: purchase.purchase_id, placedAt: purchase.created_at };
    }
    return NextResponse.json(result);
  } catch (err) {
    return NextResponse.json({ error: `Purchase Orchestrator decision failed: ${String(err)}` }, { status: 502 });
  }
}
