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

/**
 * QUESTION_PLAN_PROVIDER selects the elicitation source:
 * - "auto" (default): live research with a hard deadline, degrading to the
 *   deterministic mock plan on timeout/failure — never hangs, never throws
 * - "openai": live only, no mock fallback (fails loudly)
 * - "mock": deterministic fixture questions, no network
 */
export function getQuestionPlanProvider(): QuestionPlanProvider {
  const configured = (process.env.QUESTION_PLAN_PROVIDER ?? "auto").toLowerCase();
  if (configured === "mock") return new MockQuestionPlanProvider();
  if (configured === "openai") {
    if (!process.env.OPENAI_API_KEY) throw new Error("QUESTION_PLAN_PROVIDER=openai requires OPENAI_API_KEY");
    return new OpenAIQuestionPlanProvider();
  }
  if (configured !== "auto") throw new Error("QUESTION_PLAN_PROVIDER must be auto, mock, or openai");
  if (process.env.OPENAI_API_KEY) return new ResilientQuestionPlanProvider();
  return new MockQuestionPlanProvider();
}

export * from "./schema";
