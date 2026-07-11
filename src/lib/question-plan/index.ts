import { MockQuestionPlanProvider } from "./mock-provider";
import { OpenAIQuestionPlanProvider } from "./openai-provider";
import type { QuestionPlanProvider, QuestionPlanResult } from "./provider";
import type { QuestionPlanRequest } from "./schema";

const DEFAULT_TIMEOUT_MS = 20_000;

/**
 * Live research must never leave the user staring at a spinner: the OpenAI
 * edge intermittently kills long runs (empty HTTP 520), so the live provider
 * gets a hard deadline and any failure degrades to the instant mock plan
 * (provider: "mock" tells the UI the questions are generic).
 */
class ResilientQuestionPlanProvider implements QuestionPlanProvider {
  private live = new OpenAIQuestionPlanProvider();
  private fallback = new MockQuestionPlanProvider();

  async createPlan(input: QuestionPlanRequest): Promise<QuestionPlanResult> {
    const timeoutMs = Number(process.env.QUESTION_PLAN_TIMEOUT_MS) || DEFAULT_TIMEOUT_MS;
    let timer: ReturnType<typeof setTimeout> | undefined;
    try {
      return await Promise.race([
        this.live.createPlan(input),
        new Promise<never>((_, reject) => {
          timer = setTimeout(() => reject(new Error(`question plan exceeded ${timeoutMs}ms`)), timeoutMs);
        }),
      ]);
    } catch (error) {
      console.warn(`question-plan: live provider failed, serving mock plan — ${String(error)}`);
      return this.fallback.createPlan(input);
    } finally {
      clearTimeout(timer);
    }
  }
}

export function getQuestionPlanProvider(): QuestionPlanProvider {
  if (process.env.OPENAI_API_KEY) return new ResilientQuestionPlanProvider();
  return new MockQuestionPlanProvider();
}

export * from "./schema";
