import { z } from "zod";

export const mistakeReasons = ["conteudo", "interpretacao", "desatencao", "tempo", "confusao_regra", "outro"] as const;
export const mistakeStatuses = ["needs_review", "in_review", "understood"] as const;

const optionalReferenceSchema = z.string().trim().max(500, "A referência deve ter até 500 caracteres.").superRefine((value, context) => {
  if (!value) return;
  try {
    const url = new URL(value);
    if (url.protocol !== "https:" || !url.hostname || url.username || url.password) {
      context.addIssue({ code: "custom", message: "Use um link HTTPS público, sem usuário ou senha, ou informe apenas o identificador externo." });
    }
  } catch {
    if (!/^[\p{L}\p{N}][\p{L}\p{N} ._/#?&=%+()\-]*$/u.test(value)) {
      context.addIssue({ code: "custom", message: "Informe um identificador externo simples ou um link HTTPS válido." });
    }
  }
});

export const mistakeEntrySchema = z.object({
  id: z.uuid().nullable(),
  operationKey: z.uuid(),
  subjectId: z.uuid("Selecione uma matéria."),
  topicId: z.uuid().nullable(),
  questionBatchId: z.uuid().nullable(),
  reason: z.enum(mistakeReasons),
  thought: z.string().trim().min(1, "Descreva brevemente o que pensou.").max(3000, "Use até 3.000 caracteres."),
  correctRule: z.string().trim().min(1, "Registre a regra correta que precisa lembrar.").max(3000, "Use até 3.000 caracteres."),
  nextStep: z.string().trim().max(1000, "Use até 1.000 caracteres."),
  externalReference: optionalReferenceSchema,
  status: z.enum(mistakeStatuses),
}).superRefine((value, context) => {
  if (value.externalReference && /^[\p{L}][\p{L}\p{N}+.-]*:/u.test(value.externalReference) && !/^https:\/\//i.test(value.externalReference)) {
    context.addIssue({ code: "custom", path: ["externalReference"], message: "Links devem usar HTTPS." });
  }
});

export const deleteMistakeEntrySchema = z.object({ id: z.uuid() });
export type MistakeEntryInput = z.infer<typeof mistakeEntrySchema>;
