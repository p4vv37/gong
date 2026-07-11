import { z } from "zod";

export const criterionKindSchema = z.enum(["must", "prefer", "avoid", "indifferent", "delegate"]);

export const questionChoiceSchema = z.object({
  id: z.string().min(1),
  label: z.string().min(1),
  consequence: z.string().min(1),
  criterion: z.object({
    label: z.string().min(1),
    value: z.string().min(1),
    kind: criterionKindSchema,
  }),
});

export const decisionQuestionSchema = z.object({
  id: z.string().min(1),
  eyebrow: z.string().min(1),
  title: z.string().min(1),
  why: z.string().min(1),
  choices: z.array(questionChoiceSchema).min(2).max(5),
});

export const questionPlanSchema = z.object({
  category: z.string().min(1),
  summary: z.string().min(1),
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
