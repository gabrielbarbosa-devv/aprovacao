import { z } from "zod";

export const questionSourceTypes = ["plataforma", "prova_oficial", "pdf", "outro"] as const;

export const questionBatchSchema = z.object({
  id: z.uuid().nullable(),
  operationKey: z.uuid(),
  studiedOn: z.iso.date("Informe uma data válida."),
  subjectId: z.uuid("Selecione uma matéria."),
  topicId: z.uuid().nullable(),
  sourceType: z.enum(questionSourceTypes),
  sourceLabel: z.string().trim().min(1, "Informe a origem das questões.").max(120, "A origem deve ter até 120 caracteres."),
  examTargetId: z.uuid().nullable(),
  studySessionId: z.uuid().nullable(),
  questionCount: z.number().int("Informe um número inteiro.").min(1, "Registre ao menos uma questão.").max(100000),
  correctCount: z.number().int("Informe um número inteiro.").min(0).max(100000),
  durationMinutes: z.number().int("Informe minutos inteiros.").min(1).max(1440).nullable(),
  notes: z.string().max(2000, "A observação deve ter até 2.000 caracteres."),
  replacesSessionTotals: z.boolean(),
}).superRefine((value, context) => {
  if (value.correctCount > value.questionCount) context.addIssue({ code: "custom", path: ["correctCount"], message: "Os acertos não podem superar as questões resolvidas." });
  if (value.replacesSessionTotals && value.studySessionId === null) context.addIssue({ code: "custom", path: ["studySessionId"], message: "Escolha um estudo existente para substituir os totais anteriores." });
});

export const deleteQuestionBatchSchema = z.object({ id: z.uuid() });
export type QuestionBatchInput = z.infer<typeof questionBatchSchema>;
