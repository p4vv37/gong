import type { QuestionPlan, QuestionPlanRequest } from "./schema";

export type QuestionPlanResult = {
  plan: QuestionPlan;
  provider: "mock" | "openai";
};

export interface QuestionPlanProvider {
  createPlan(input: QuestionPlanRequest): Promise<QuestionPlanResult>;
}
