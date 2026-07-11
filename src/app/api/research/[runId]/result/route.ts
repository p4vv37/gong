import { NextResponse } from "next/server";
import { loadRun } from "../../../../../server/pipeline/run";

export const dynamic = "force-dynamic";

export async function GET(_req: Request, ctx: { params: Promise<{ runId: string }> }): Promise<NextResponse> {
  const { runId } = await ctx.params;
  const run = await loadRun(runId);
  if (!run) return NextResponse.json({ error: "unknown run" }, { status: 404 });
  if (run.status === "running" || !run.result) {
    return NextResponse.json({ error: `run is ${run.status}` }, { status: run.status === "failed" ? 500 : 404 });
  }
  return NextResponse.json(run.result);
}
