import { NextResponse } from "next/server";
import type { PurchaseBrief } from "../../../contract";
import { llmEnabled } from "../../../server/agents/client";
import { researchPriceBracket } from "../../../server/agents/price-bracket";

export const dynamic = "force-dynamic";

/**
 * Elicitation-time market-price verification, independent of offer searches.
 * The conversation can call this as soon as category + key requirements are
 * known, to inform the budget question ("realistic bracket is 150–600 zł").
 * Cached per (request, requirements, market) — repeats are free.
 */
export async function POST(req: Request): Promise<NextResponse> {
  let brief: PurchaseBrief;
  try {
    brief = (await req.json()) as PurchaseBrief;
  } catch {
    return NextResponse.json({ error: "invalid JSON body" }, { status: 400 });
  }
  if (!brief?.request || !brief.market?.currency) {
    return NextResponse.json({ error: "brief with request and market is required" }, { status: 400 });
  }
  if (!llmEnabled()) {
    return NextResponse.json({ error: "price bracket research needs OPENAI_API_KEY" }, { status: 503 });
  }
  try {
    const bracket = await researchPriceBracket(brief);
    if (!bracket) return NextResponse.json({ error: "could not establish a bracket" }, { status: 502 });
    return NextResponse.json(bracket);
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 502 });
  }
}
