import { z } from "zod";
import { isStudyDate } from "./dates";

const dateSchema = z.string().refine(isStudyDate, "Informe uma data válida.");
const uuidSchema = z.string().uuid();

export const studyBlockInputSchema = z.object({
  id: uuidSchema,
  topicId: uuidSchema,
  plannedDate: dateSchema,
  plannedMinutes: z.coerce.number().int().min(15).max(480),
  plannedStartTime: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/).nullable(),
  status: z.enum(["planejado", "em_andamento", "concluido", "ignorado"]),
});

export const createStudyBlockSchema = studyBlockInputSchema.omit({ status: true });

export const reorganizeSchema = z.object({
  expected: z.array(z.object({
    id: uuidSchema,
    planned_date: dateSchema,
    status: z.enum(["planejado", "em_andamento", "concluido", "ignorado"]),
    pinned: z.boolean(),
  })).min(1).max(100),
  changes: z.array(z.object({ id: uuidSchema, planned_date: dateSchema })).min(1).max(100),
}).superRefine((value, context) => {
  if (value.expected.length !== value.changes.length) {
    context.addIssue({ code: "custom", message: "A prévia está desatualizada." });
  }
});

export type StudyBlockInput = z.infer<typeof studyBlockInputSchema>;
