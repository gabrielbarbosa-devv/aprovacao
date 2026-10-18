import { z } from "zod";

export const subjectNameSchema = z.string()
  .trim()
  .min(1, "Informe o nome da matéria.")
  .max(80, "Use no máximo 80 caracteres.")
  .transform((name) => name.replace(/\s+/g, " "));

export const subjectColorSchema = z.enum(["blue", "green", "violet", "orange", "rose"]).nullable();

export const createSubjectSchema = z.object({
  name: subjectNameSchema,
  colorToken: subjectColorSchema,
});

export const updateSubjectSchema = createSubjectSchema.extend({
  id: z.string().uuid("Matéria inválida."),
});

export const subjectIdSchema = z.string().uuid("Matéria inválida.");

export const archiveSubjectSchema = z.object({
  id: z.string().uuid("Matéria inválida."),
  expectedFutureBlocks: z.number().int().nonnegative(),
});

export const reorderSubjectsSchema = z.array(z.string().uuid("Matéria inválida."))
  .min(1, "Não há matérias para reordenar.")
  .max(500, "O limite de matérias para reordenar foi excedido.")
  .superRefine((ids, context) => {
    if (new Set(ids).size !== ids.length) context.addIssue({ code: "custom", message: "A lista contém matérias repetidas." });
  });

export type SubjectInput = z.infer<typeof createSubjectSchema>;
