import { NextResponse } from "next/server";
import { deepenOnDemand } from "../../../../../server/pipeline/run";

export const dynamic = "force-dynamic";

/** On-demand merchant verification for one offer; returns the updated RecommendationSet. */
export async function POST(req: Request, ctx: { params: Promise<{ runId: string }> }): Promise<NextResponse> {
  const { runId } = await ctx.params;
  let body: { offerId?: string };
  try {
    body = (await req.json()) as { offerId?: string };
  } catch {
    return NextResponse.json({ error: "invalid JSON body" }, { status: 400 });
  }
  if (!body.offerId) return NextResponse.json({ error: "offerId is required" }, { status: 400 });

  const result = await deepenOnDemand(runId, body.offerId);
  if ("error" in result) return NextResponse.json(result, { status: 400 });
  return NextResponse.json(result);
}
