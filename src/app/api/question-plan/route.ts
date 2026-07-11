import { getQuestionPlanProvider, questionPlanRequestSchema } from "@/lib/question-plan";

export async function POST(request: Request) {
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
    return Response.json(result);
  } catch (error) {
    console.error("Question-plan provider failed", error);
    return Response.json(
      { error: "The category research run failed. Your request was not changed." },
      { status: 502 },
    );
  }
}
