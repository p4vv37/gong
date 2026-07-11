import { MockQuestionPlanProvider } from "./mock-provider";
import { OpenAIQuestionPlanProvider } from "./openai-provider";
import type { QuestionPlanProvider } from "./provider";

class AutoQuestionPlanProvider implements QuestionPlanProvider {
  private readonly openai = new OpenAIQuestionPlanProvider();
  private readonly mock = new MockQuestionPlanProvider();

  async createPlan(input: Parameters<QuestionPlanProvider["createPlan"]>[0]) {
    try {
      return await this.openai.createPlan(input);
    } catch (error) {
      console.warn("[question-plan] OpenAI unavailable; falling back to deterministic provider", {
        error: error instanceof Error ? error.message : String(error),
      });
      return this.mock.createPlan(input);
    }
  }
}

export function getQuestionPlanProvider(): QuestionPlanProvider {
  const explicitProvider = process.env.QUESTION_PLAN_PROVIDER?.trim();
  const configured = (
    explicitProvider
    || (process.env.OPENAI_API_KEY ? "openai" : "mock")
  ).toLowerCase();
  if (configured === "mock") return new MockQuestionPlanProvider();
  if (configured === "openai") {
    if (!process.env.OPENAI_API_KEY) throw new Error("QUESTION_PLAN_PROVIDER=openai requires OPENAI_API_KEY");
    return new OpenAIQuestionPlanProvider();
  }
  if (configured !== "auto") throw new Error("QUESTION_PLAN_PROVIDER must be auto, mock, or openai");
  if (process.env.OPENAI_API_KEY) return new AutoQuestionPlanProvider();
  return new MockQuestionPlanProvider();
}

export * from "./schema";
