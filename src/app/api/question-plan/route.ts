import { getQuestionPlanProvider, questionPlanRequestSchema } from "@/lib/question-plan";

export async function POST(request: Request) {
  const startedAt = Date.now();
  console.log("[question-plan] request started");
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "Request body must be valid JSON" }, { status: 400 });
  }

  const parsed = questionPlanRequestSchema.safeParse(body);

  if (!parsed.success) {
    return Response.json(
      { error: "Invalid purchase request", issues: parsed.error.issues },
      { status: 400 },
    );
  }

  try {
    const result = await getQuestionPlanProvider().createPlan(parsed.data);
    console.log("[question-plan] request completed", {
      provider: result.provider,
      elapsedMs: Date.now() - startedAt,
      questions: result.plan.questions.length,
    });
    return Response.json(result);
  } catch (error) {
    const timedOut = error instanceof Error && (error.name === "AbortError" || /timed out|abort/i.test(error.message));
    console.error("[question-plan] provider failed", {
      elapsedMs: Date.now() - startedAt,
      error: error instanceof Error ? error.message : String(error),
    });
    return Response.json(
      {
        error: timedOut
          ? "Category research timed out. Retry or set QUESTION_PLAN_PROVIDER=mock for a keyless local run."
          : "The category research run failed. Your request was not changed.",
      },
      { status: timedOut ? 504 : 502 },
    );
  }
}
