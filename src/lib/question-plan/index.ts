import { MockQuestionPlanProvider } from "./mock-provider";
import { OpenAIQuestionPlanProvider } from "./openai-provider";
import type { QuestionPlanProvider } from "./provider";

export function getQuestionPlanProvider(): QuestionPlanProvider {
  if (process.env.OPENAI_API_KEY) return new OpenAIQuestionPlanProvider();
  return new MockQuestionPlanProvider();
}

export * from "./schema";
