import { z } from "zod";

const optionalText = (max: number) => z.string().trim().max(max).transform((value) => value || null);
const isoDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Informe uma data válida.").refine((value) => {
  const date = new Date(`${value}T00:00:00.000Z`);
  return !Number.isNaN(date.getTime()) && date.toISOString().slice(0, 10) === value;
}, "Informe uma data válida.").nullable();

export const examJurisdictions = ["Federal", "AC", "AL", "AP", "AM", "BA", "CE", "DF", "ES", "GO", "MA", "MT", "MS", "MG", "PA", "PB", "PR", "PE", "PI", "RJ", "RN", "RS", "RO", "RR", "SC", "SP", "SE", "TO"] as const;
export const examStages = ["em_preparacao", "edital_publicado", "inscricao_aberta", "prova_realizada"] as const;
export const examPriorities = ["alta", "media", "baixa"] as const;

export const examTargetSchema = z.object({
  id: z.string().uuid().nullable(),
  examName: z.string().trim().min(1, "Informe o nome do concurso.").max(120).transform((value) => value.replace(/\s+/g, " ")),
  institution: z.string().trim().min(1, "Informe o órgão.").max(120).transform((value) => value.replace(/\s+/g, " ")),
  roleTitle: z.string().trim().min(1, "Informe o cargo pretendido.").max(120).transform((value) => value.replace(/\s+/g, " ")),
  jurisdiction: z.enum(examJurisdictions),
  currentStage: z.enum(examStages),
  priority: z.enum(examPriorities),
  examDate: isoDate,
  applicationDeadline: isoDate,
  officialUrl: optionalText(2000).refine((value) => value === null || isHttpUrl(value), "Use um link oficial iniciado por http:// ou https://."),
  notes: optionalText(4000),
  subjectIds: z.array(z.string().uuid()).max(500),
  topicIds: z.array(z.string().uuid()).max(2000),
}).superRefine((value, context) => {
  if (value.applicationDeadline && value.examDate && value.applicationDeadline > value.examDate) {
    context.addIssue({ code: "custom", path: ["applicationDeadline"], message: "O prazo de inscrição não pode ser depois da prova." });
  }
  if (new Set(value.subjectIds).size !== value.subjectIds.length) context.addIssue({ code: "custom", path: ["subjectIds"], message: "A seleção contém matéria duplicada." });
  if (new Set(value.topicIds).size !== value.topicIds.length) context.addIssue({ code: "custom", path: ["topicIds"], message: "A seleção contém tópico duplicado." });
});

export const archiveExamTargetSchema = z.object({ id: z.string().uuid(), archived: z.boolean() });
export type ExamTargetInput = z.infer<typeof examTargetSchema>;

export function isHttpUrl(value: string): boolean {
  try {
    const url = new URL(value);
    return (url.protocol === "https:" || url.protocol === "http:") && Boolean(url.hostname);
  } catch {
    return false;
  }
}
