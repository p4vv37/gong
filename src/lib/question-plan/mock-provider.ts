import { questionsForDepth } from "@/domain/clothing-questions";
import { createPurchaseBrief } from "@/domain/purchase-brief";
import type { QuestionPlanProvider } from "./provider";
import { questionPlanSchema } from "./schema";

export class MockQuestionPlanProvider implements QuestionPlanProvider {
  async createPlan(input: { request: string; warrantedDepth: number }) {
    const brief = createPurchaseBrief(input.request, input.warrantedDepth);
    const plan = questionPlanSchema.parse({
      category: brief.category,
      summary: "Local clothing fixture used while live agent research is unavailable.",
      taxonomySummary: "Static clothing taxonomy with use, fit, care, review evidence, seller risk, style and trade-off aspects.",
      sources: [],
      resolvedConstraints: [],
      questions: questionsForDepth(input.warrantedDepth).map((question) => ({
        ...question,
        aspectId: question.id,
        answerFormat: {
          type: "single_select" as const,
          unit: null,
          min: null,
          max: null,
          step: null,
          placeholder: null,
        },
        choices: question.choices.map((choice) => ({ ...choice, machineValue: choice.criterion.value })),
      })),
      assumptions: ["Consumer purchase", "Delivery market is Poland"],
      reviewResearchPriorities: [
        "Sizing consistency and return-causing fit issues",
        "Material durability after washing and wear",
        "Store fulfilment, returns and seller-identity complaints",
      ],
    });

    return { plan, provider: "mock" as const };
  }
}
