import { NextResponse } from "next/server";
import type { ProposeCheckoutRequest } from "../../../../contract";
import { createProposal } from "../../../../server/checkout";
import { getRun } from "../../../../server/pipeline/run";

export const dynamic = "force-dynamic";

export async function POST(req: Request): Promise<NextResponse> {
  let body: ProposeCheckoutRequest;
  try {
    body = (await req.json()) as ProposeCheckoutRequest;
  } catch {
    return NextResponse.json({ error: "invalid JSON body" }, { status: 400 });
  }
  const run = getRun(body.runId ?? "");
  if (!run?.result) return NextResponse.json({ error: "unknown or unfinished run" }, { status: 404 });

  const proposal = createProposal(run.result, body.offerId ?? "");
  if ("error" in proposal) return NextResponse.json(proposal, { status: 400 });
  return NextResponse.json(proposal, { status: 201 });
}
