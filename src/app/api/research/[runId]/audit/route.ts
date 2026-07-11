import { NextResponse } from "next/server";
import { loadRun } from "../../../../../server/pipeline/run";

export const dynamic = "force-dynamic";

/** Per-run audit: every external call (source, key, duration, cache hit, outcome). */
export async function GET(_req: Request, ctx: { params: Promise<{ runId: string }> }): Promise<NextResponse> {
  const { runId } = await ctx.params;
  const run = await loadRun(runId);
  if (!run) return NextResponse.json({ error: "unknown run" }, { status: 404 });
  return NextResponse.json({ runId, status: run.status, calls: run.audit, events: run.events });
}
