import { Agent, Runner } from "@openai/agents";
import type { QuestionPlanProvider } from "./provider";
import { questionPlanSchema, type QuestionPlanRequest } from "./schema";

const instructions = `
You are the category-research specialist inside a consumer purchasing agent.

Your job is to turn an initial purchasing request into the smallest high-value set of decisions that should be resolved before searching for products. Do not recommend products or stores yet.

Rules:
- Assume a normal consumer purchase unless the request explicitly indicates B2B, wholesale, sourcing, or supplier evaluation.
- Identify product-specific aspects; never produce a generic shopping questionnaire.
- Treat warrantedDepth as a question-cost budget. 0-25 means about 3 high-impact decisions, 26-65 about 5, and 66-100 up to 7-10 when dependencies justify it.
- Each question must offer 2-5 materially different choices, including "no preference" or "decide for me" where appropriate.
- Each choice explains its consequence and maps to must, prefer, avoid, indifferent, or delegate.
- Separate product-review evidence from store/seller-review evidence.
- Product review priorities should cover category-specific real-world failures, long-term use, fit or compatibility, and manipulation/selection bias where relevant.
- Seller risk includes fulfilment, authenticity, returns, buyer protection, marketplace seller identity, payment protection, recency, review volume, and suspicious review patterns.
- Questions should resolve trade-offs, not merely collect specifications.
- Use stable lowercase kebab-case IDs.
- State important assumptions instead of silently treating them as facts.
`.trim();

export class OpenAIQuestionPlanProvider implements QuestionPlanProvider {
  async createPlan(input: QuestionPlanRequest) {
    const agent = new Agent({
      name: "Purchase category researcher",
      instructions,
      model: process.env.OPENAI_MODEL ?? "gpt-5.6",
      outputType: questionPlanSchema,
    });

    const runner = new Runner({
      workflowName: "purchase-question-plan",
      traceIncludeSensitiveData: false,
    });
    const result = await runner.run(
      agent,
      `Create the decision plan for this request:\n${JSON.stringify(input, null, 2)}`,
      { maxTurns: 4 },
    );

    if (!result.finalOutput) {
      throw new Error("The category researcher returned no structured plan.");
    }

    return {
      plan: questionPlanSchema.parse(result.finalOutput),
      provider: "openai" as const,
    };
  }
}
