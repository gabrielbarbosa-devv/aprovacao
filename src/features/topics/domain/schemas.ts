import { z } from "zod";

export const topicIdSchema = z.string().uuid("Tópico inválido.");
export const topicStatusSchema = z.enum(["nao_iniciado", "em_andamento", "revisando", "dominado", "concluido"]);
export const topicPrioritySchema = z.enum(["baixa", "media", "alta"]);
const topicTitleSchema = z.string().trim().min(1, "Informe o nome do tópico.").max(140, "Use no máximo 140 caracteres.")
  .transform((title) => title.replace(/\s+/g, " "));
const topicUrlSchema = z.string().trim().max(2048, "O link deve ter no máximo 2048 caracteres.")
  .transform((url) => url === "" ? null : url)
  .pipe(z.string().url("Informe um link válido começando com http:// ou https://.")
    .refine((url) => url.startsWith("https://") || url.startsWith("http://"), "Use um link http:// ou https://.").nullable());
const topicNotesSchema = z.string().trim().max(3000, "As notas devem ter no máximo 3000 caracteres.")
  .transform((notes) => notes === "" ? null : notes);
const estimatedMinutesSchema = z.number().int("Informe minutos inteiros.").min(1, "Use pelo menos 1 minuto.").max(480, "Use no máximo 480 minutos.").nullable();

export const topicFieldsSchema = z.object({
  title: topicTitleSchema,
  status: topicStatusSchema,
  priority: topicPrioritySchema,
  estimatedMinutes: estimatedMinutesSchema,
  sourceUrl: topicUrlSchema,
  notes: topicNotesSchema,
});

export const createTopicSchema = topicFieldsSchema.extend({ subjectId: z.string().uuid("Matéria inválida.") });
export const updateTopicSchema = topicFieldsSchema.extend({ id: topicIdSchema, subjectId: z.string().uuid("Matéria inválida.") });
export const changeTopicStatusSchema = z.object({ id: topicIdSchema, subjectId: z.string().uuid(), status: topicStatusSchema });
export const changeTopicPrioritySchema = z.object({ id: topicIdSchema, subjectId: z.string().uuid(), priority: topicPrioritySchema });
export const archiveTopicSchema = z.object({ id: topicIdSchema, subjectId: z.string().uuid() });
export const restoreTopicSchema = archiveTopicSchema;
export const reorderTopicsSchema = z.object({ subjectId: z.string().uuid(), topicIds: z.array(topicIdSchema).min(1).max(1000) })
  .superRefine(({ topicIds }, context) => {
    if (new Set(topicIds).size !== topicIds.length) context.addIssue({ code: "custom", message: "A lista de tópicos contém itens repetidos." });
  });

export type TopicFields = z.infer<typeof topicFieldsSchema>;
