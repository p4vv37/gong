import { NextResponse } from "next/server";
import type { CheckoutDecision } from "../../../../../../contract";
import { decideProposal } from "../../../../../../server/checkout";

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
  const result = decideProposal({ proposalId, approve: body.approve, rejectionReason: body.rejectionReason });
  if ("error" in result) return NextResponse.json(result, { status: 400 });

  // Resolve the parked Agents-SDK interruption; approval executes the order tool.
  try {
    const { resolvePurchaseGate } = await import("../../../../../../server/agents/purchase-gate");
    const order = await resolvePurchaseGate(result, body.approve);
    if (order) result.order = { orderId: order.orderId, placedAt: order.placedAt };
  } catch (err) {
    return NextResponse.json({ error: `decision recorded but order placement failed: ${String(err)}` }, { status: 500 });
  }
  return NextResponse.json(result);
}
