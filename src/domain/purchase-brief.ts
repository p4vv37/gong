export type CriterionKind = "must" | "prefer" | "avoid" | "indifferent" | "delegate";

export type Criterion = {
  id: string;
  label: string;
  value: string;
  kind: CriterionKind;
  source: "request" | "answer" | "inference";
};

export type PurchaseBrief = {
  request: string;
  category: string;
  market: {
    country: string;
    currency: string;
    language: string;
  };
  budget?: {
    max: number;
    currency: string;
  };
  warrantedDepth: number;
  criteria: Criterion[];
  answeredQuestionIds: string[];
  readyForSearch: boolean;
};

export type QuestionChoice = {
  id: string;
  label: string;
  consequence: string;
  machineValue?: string | number | boolean;
  criterion: Omit<Criterion, "id" | "source">;
};

export type QuestionAnswerFormat = {
  type: "single_select" | "multi_select" | "number" | "range" | "boolean" | "text";
  unit: string | null;
  min: number | null;
  max: number | null;
  step: number | null;
  placeholder: string | null;
};

export type DecisionQuestion = {
  id: string;
  aspectId?: string;
  eyebrow: string;
  title: string;
  why: string;
  answerFormat?: QuestionAnswerFormat;
  choices: QuestionChoice[];
};

const pricePattern = /(?:under|max(?:imum)?|do|poniżej)\s*(\d[\d\s.,]*)\s*(zł|pln|€|eur|\$|usd)?/i;

function inferCategory(request: string) {
  const normalized = request.toLowerCase();

  if (/jacket|coat|kurtk|płaszcz/.test(normalized)) return "Outerwear";
  if (/shoe|boot|sneaker|but|obuw/.test(normalized)) return "Footwear";
  if (/dress|sukien/.test(normalized)) return "Dresses";
  if (/shirt|koszul|bluz/.test(normalized)) return "Tops";
  return "Clothing";
}

export function createPurchaseBrief(request: string, warrantedDepth: number): PurchaseBrief {
  const priceMatch = request.match(pricePattern);
  const parsedPrice = priceMatch?.[1]
    ? Number(priceMatch[1].replace(/\s/g, "").replace(",", "."))
    : undefined;
  const currencyToken = priceMatch?.[2]?.toLowerCase();
  const currency = currencyToken === "€" || currencyToken === "eur" ? "EUR" : currencyToken === "$" || currencyToken === "usd" ? "USD" : "PLN";

  return {
    request,
    category: inferCategory(request),
    market: { country: "Poland", currency, language: "English / Polish" },
    budget: parsedPrice ? { max: parsedPrice, currency } : undefined,
    warrantedDepth,
    criteria: parsedPrice
      ? [{ id: "request-budget", label: "Maximum budget", value: `${parsedPrice} ${currency}`, kind: "must", source: "request" }]
      : [],
    answeredQuestionIds: [],
    readyForSearch: false,
  };
}

export function applyQuestionAnswer(
  brief: PurchaseBrief,
  question: DecisionQuestion,
  answer: QuestionChoice | QuestionChoice[] | string,
  totalQuestions: number,
): PurchaseBrief {
  const criterion: Criterion = typeof answer === "string"
    ? {
        id: `${question.id}-custom`,
        label: question.eyebrow,
        value: answer,
        kind: "prefer",
        source: "answer",
      }
    : Array.isArray(answer)
    ? {
        id: `${question.id}-multi`,
        label: question.eyebrow,
        value: answer.map((choice) => choice.criterion.value).join(", "),
        kind: answer.some((choice) => choice.criterion.kind === "must") ? "must" : "prefer",
        source: "answer",
      }
    : {
        ...answer.criterion,
        id: `${question.id}-${answer.id}`,
        source: "answer",
      };

  const answeredQuestionIds = [...brief.answeredQuestionIds, question.id];

  return {
    ...brief,
    criteria: [...brief.criteria.filter((item) => !item.id.startsWith(`${question.id}-`)), criterion],
    answeredQuestionIds,
    readyForSearch: answeredQuestionIds.length >= totalQuestions,
  };
}
