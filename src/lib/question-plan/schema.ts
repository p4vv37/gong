import { z } from "zod";

export const criterionKindSchema = z.enum(["must", "prefer", "avoid", "indifferent", "delegate"]);

export const questionChoiceSchema = z.object({
  id: z.string().min(1),
  label: z.string().min(1),
  consequence: z.string().min(1),
  machineValue: z.union([z.string(), z.number(), z.boolean()]),
  criterion: z.object({
    label: z.string().min(1),
    value: z.string().min(1),
    kind: criterionKindSchema,
  }),
});

export const decisionQuestionSchema = z.object({
  id: z.string().min(1),
  aspectId: z.string().min(1),
  eyebrow: z.string().min(1),
  title: z.string().min(1),
  why: z.string().min(1),
  answerFormat: z.object({
    type: z.enum(["single_select", "multi_select", "number", "range", "boolean", "text"]),
    unit: z.string().nullable(),
    min: z.number().nullable(),
    max: z.number().nullable(),
    step: z.number().nullable(),
    placeholder: z.string().nullable(),
  }),
  choices: z.array(questionChoiceSchema).max(8),
});

export const questionPlanSchema = z.object({
  category: z.string().min(1),
  summary: z.string().min(1),
  taxonomySummary: z.string().min(1),
  sources: z.array(z.object({ title: z.string().min(1), url: z.string().min(1) })).max(8),
  resolvedConstraints: z.array(z.object({
    aspectId: z.string().min(1),
    label: z.string().min(1),
    value: z.string().min(1),
    kind: z.enum(["must", "prefer"]),
    reason: z.string().min(1),
    sourceUrl: z.string().min(1).nullable(),
  })).max(8),
  questions: z.array(decisionQuestionSchema).min(1).max(10),
  assumptions: z.array(z.string()),
  reviewResearchPriorities: z.array(z.string()),
});

export const questionPlanRequestSchema = z.object({
  request: z.string().trim().min(3).max(2000),
  warrantedDepth: z.number().int().min(0).max(100),
});

export type QuestionPlan = z.infer<typeof questionPlanSchema>;
export type QuestionPlanRequest = z.infer<typeof questionPlanRequestSchema>;
