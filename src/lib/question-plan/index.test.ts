import { afterEach, describe, expect, it } from "vitest";
import { getQuestionPlanProvider } from "./index";
import { MockQuestionPlanProvider } from "./mock-provider";
import { OpenAIQuestionPlanProvider } from "./openai-provider";

const originalProvider = process.env.QUESTION_PLAN_PROVIDER;
const originalKey = process.env.OPENAI_API_KEY;

afterEach(() => {
  if (originalProvider === undefined) delete process.env.QUESTION_PLAN_PROVIDER;
  else process.env.QUESTION_PLAN_PROVIDER = originalProvider;
  if (originalKey === undefined) delete process.env.OPENAI_API_KEY;
  else process.env.OPENAI_API_KEY = originalKey;
});

describe("question-plan provider selection", () => {
  it("uses OpenAI by default when an API key is configured", () => {
    process.env.QUESTION_PLAN_PROVIDER = "";
    process.env.OPENAI_API_KEY = "test-key";
    expect(getQuestionPlanProvider()).toBeInstanceOf(OpenAIQuestionPlanProvider);
  });

  it("uses the fixture only when keyless or explicitly requested", () => {
    delete process.env.QUESTION_PLAN_PROVIDER;
    delete process.env.OPENAI_API_KEY;
    expect(getQuestionPlanProvider()).toBeInstanceOf(MockQuestionPlanProvider);

    process.env.OPENAI_API_KEY = "test-key";
    process.env.QUESTION_PLAN_PROVIDER = "mock";
    expect(getQuestionPlanProvider()).toBeInstanceOf(MockQuestionPlanProvider);
  });
});
