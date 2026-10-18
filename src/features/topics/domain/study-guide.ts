import { z } from "zod";
import type { StudyGuide } from "@/features/topics/domain/types";

const stringValue = z.string().trim().min(1).catch("");
const stringList = z.array(z.string()).catch([]).transform((items) => items.map((item) => item.trim()).filter(Boolean));
const contentSchema = z.object({
  objective: stringValue.optional(),
  study_points: stringList.optional(),
  exam_style: z.object({
    board: stringValue.optional(),
    description: stringValue.optional(),
    evidence_type: stringValue.optional(),
  }).nullable().optional().catch(null),
  pitfalls: z.array(z.object({ description: stringValue.optional() }).passthrough()).catch([]),
  examples: z.array(z.object({
    statement: stringValue.optional(),
    answer: stringValue.optional(),
    explanation: stringValue.optional(),
    original: z.boolean().nullable().optional(),
  }).passthrough()).catch([]),
  practice: z.object({
    first_questions: z.number().int().nonnegative().nullable().optional(),
    platform: stringValue.nullable().optional(),
    filters: stringList.optional(),
    video_search: stringValue.nullable().optional(),
    active_recall: stringValue.nullable().optional(),
  }).nullable().optional().catch(null),
  incidence: z.object({
    status: stringValue.nullable().optional(),
    measured_percent: z.number().min(0).max(100).nullable().optional(),
    measured_sample: z.number().int().nonnegative().nullable().optional(),
  }).nullable().optional().catch(null),
}).passthrough();

const evidenceSchema = z.object({
  coverage_note: stringValue.nullable().optional(),
  official_sources: z.array(z.object({
    exam: stringValue,
    reference: stringValue.nullable().optional(),
    url: z.string().url(),
  }).passthrough()).catch([]),
}).passthrough();

export function parseStudyGuide(content: unknown, evidence: unknown, legacyNotes: string | null): StudyGuide | null {
  const parsedContent = contentSchema.safeParse(content);
  if (!parsedContent.success) return null;
  const parsedEvidence = evidenceSchema.safeParse(evidence);
  const guide = parsedContent.data;
  const source = parsedEvidence.success ? parsedEvidence.data : null;
  return {
    objective: guide.objective || null,
    studyPoints: guide.study_points ?? [],
    examStyle: guide.exam_style ? {
      board: guide.exam_style.board || null,
      description: guide.exam_style.description || null,
      evidenceType: guide.exam_style.evidence_type || null,
    } : null,
    pitfalls: guide.pitfalls.map((item) => item.description ?? "").filter(Boolean),
    examples: guide.examples.filter((item) => Boolean(item.statement)).map((item) => ({
      statement: item.statement ?? "",
      answer: item.answer ?? "",
      explanation: item.explanation ?? "",
      original: item.original ?? null,
    })),
    practice: guide.practice ? {
      firstQuestions: guide.practice.first_questions ?? null,
      platform: guide.practice.platform || null,
      filters: guide.practice.filters ?? [],
      videoSearch: guide.practice.video_search || null,
      activeRecall: guide.practice.active_recall || null,
    } : null,
    incidence: guide.incidence ? {
      status: guide.incidence.status || null,
      measuredPercent: guide.incidence.measured_percent ?? null,
      measuredSample: guide.incidence.measured_sample ?? null,
    } : null,
    officialSources: (source?.official_sources ?? []).map(({ exam, reference, url }) => ({ exam, reference: reference ?? null, url })),
    coverageNote: source?.coverage_note || null,
    legacyNotes,
  };
}
