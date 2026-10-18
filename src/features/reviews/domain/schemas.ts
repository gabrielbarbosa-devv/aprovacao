import { z } from "zod";

const dateSchema = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Informe uma data válida.");

export const completeReviewSchema = z.object({
  reviewId: z.string().uuid("Revisão inválida."),
  reviewedOn: dateSchema,
  difficulty: z.union([z.literal(1), z.literal(3), z.literal(5)]),
  scheduleReinforcement: z.boolean(),
  questionCount: z.number().int().min(0).max(100000).nullable(),
  correctCount: z.number().int().min(0).max(100000).nullable(),
  notes: z.string().trim().max(2000).nullable(),
}).refine((value) => (value.questionCount === null) === (value.correctCount === null), {
  message: "Informe questões e acertos juntos.",
  path: ["correctCount"],
}).refine((value) => value.questionCount === null || value.correctCount === null || value.correctCount <= value.questionCount, {
  message: "Os acertos não podem superar as questões.",
  path: ["correctCount"],
});

export const snoozeReviewSchema = z.object({
  reviewId: z.string().uuid("Revisão inválida."),
  newDueOn: dateSchema,
  reason: z.string().trim().max(500).nullable(),
});

export type CompleteReviewInput = z.infer<typeof completeReviewSchema>;
export type SnoozeReviewInput = z.infer<typeof snoozeReviewSchema>;
