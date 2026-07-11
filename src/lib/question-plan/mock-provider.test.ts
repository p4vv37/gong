import { describe, expect, it } from "vitest";
import { MockQuestionPlanProvider } from "./mock-provider";
import { questionPlanSchema } from "./schema";

describe("mock question-plan provider", () => {
  it("honors depth and returns contract-valid review-aware questions", async () => {
    const result = await new MockQuestionPlanProvider().createPlan({
      request: "A winter jacket under 900 PLN",
      warrantedDepth: 55,
    });

    expect(() => questionPlanSchema.parse(result.plan)).not.toThrow();
    expect(result.plan.questions).toHaveLength(5);
    expect(result.plan.questions.map((question) => question.id)).toEqual(
      expect.arrayContaining(["product-reviews", "merchant-risk"]),
    );
    expect(result.provider).toBe("mock");
  });
});
