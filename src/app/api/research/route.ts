import { NextResponse } from "next/server";
import type { ResearchRequest, StartResearchResponse } from "../../../contract";
import { startRun } from "../../../server/pipeline/run";

export const dynamic = "force-dynamic";

export async function POST(req: Request): Promise<NextResponse> {
  let body: ResearchRequest;
  try {
    body = (await req.json()) as ResearchRequest;
  } catch {
    return NextResponse.json({ error: "invalid JSON body" }, { status: 400 });
  }
  if (!body?.brief?.request || typeof body.brief.request !== "string") {
    return NextResponse.json({ error: "brief.request is required" }, { status: 400 });
  }
  if (body.mode !== "fixture" && body.mode !== "live") {
    return NextResponse.json({ error: 'mode must be "fixture" or "live"' }, { status: 400 });
  }
  const runId = startRun(body);
  const res: StartResearchResponse = { runId };
  return NextResponse.json(res, { status: 202 });
}
