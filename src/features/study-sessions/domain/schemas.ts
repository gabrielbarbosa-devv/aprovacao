import { z } from "zod";

export const studySessionSchema = z.object({
  sessionId: z.uuid().nullable(),
  operationKey: z.uuid(),
  blockId: z.uuid().nullable(),
  topicId: z.uuid(),
  studiedOn: z.iso.date("Escolha uma data válida."),
  durationMinutes: z.number().int("Informe minutos inteiros.").positive("O tempo deve ser maior que zero.").max(1440),
  questionCount: z.number().int("Informe um número inteiro.").min(0, "Não use valores negativos.").max(10000),
  correctCount: z.number().int("Informe um número inteiro.").min(0, "Não use valores negativos.").max(10000),
  notes: z.string().max(2000, "A observação deve ter até 2.000 caracteres."),
}).refine((value) => value.correctCount <= value.questionCount, {
  message: "Os acertos não podem ser maiores que as questões resolvidas.",
  path: ["correctCount"],
});

export const deleteStudySessionSchema = z.object({ sessionId: z.uuid() });

export type StudySessionInput = z.infer<typeof studySessionSchema>;

export function getAccuracy(questionCount: number, correctCount: number): number | null {
  if (!Number.isFinite(questionCount) || !Number.isFinite(correctCount) || questionCount <= 0) return null;
  return Math.round((correctCount / questionCount) * 100);
}

export function getMistakeCount(questionCount: number, correctCount: number): number {
  if (!Number.isFinite(questionCount) || !Number.isFinite(correctCount)) return 0;
  return Math.max(0, questionCount - correctCount);
}
