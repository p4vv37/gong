import { describe, expect, it } from "vitest";
import { clothingQuestions, questionsForDepth } from "./clothing-questions";
import { applyQuestionAnswer, createPurchaseBrief } from "./purchase-brief";

describe("purchase brief", () => {
  it("extracts an explicit PLN budget and clothing category", () => {
    const brief = createPurchaseBrief("Warm winter jacket under 900 PLN", 50);

    expect(brief.category).toBe("Outerwear");
    expect(brief.budget).toEqual({ max: 900, currency: "PLN" });
    expect(brief.criteria[0]).toMatchObject({ kind: "must", value: "900 PLN" });
  });

  it("turns a choice into an explicit preference", () => {
    const brief = createPurchaseBrief("Everyday jacket", 50);
    const question = clothingQuestions[0];
    const updated = applyQuestionAnswer(brief, question, question.choices[0], 5);

    expect(updated.criteria).toContainEqual(expect.objectContaining({ label: "Use", value: "Everyday versatility" }));
    expect(updated.answeredQuestionIds).toEqual(["use"]);
    expect(updated.readyForSearch).toBe(false);
  });

  it("accepts free text without pretending it is a hard requirement", () => {
    const brief = createPurchaseBrief("A coat", 50);
    const question = clothingQuestions[1];
    const updated = applyQuestionAnswer(brief, question, "Room for a thick sweater", 5);

    expect(updated.criteria[0]).toMatchObject({ value: "Room for a thick sweater", kind: "prefer", source: "answer" });
  });

  it("uses warranted depth to control question cost", () => {
    expect(questionsForDepth(10)).toHaveLength(3);
    expect(questionsForDepth(50)).toHaveLength(5);
    expect(questionsForDepth(90)).toHaveLength(7);
  });

  it("includes product and seller review decisions at balanced depth", () => {
    const ids = questionsForDepth(50).map((question) => question.id);

    expect(ids).toContain("product-reviews");
    expect(ids).toContain("merchant-risk");
  });
});
