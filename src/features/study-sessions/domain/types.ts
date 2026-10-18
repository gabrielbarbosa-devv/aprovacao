import type { StudySessionInput } from "@/features/study-sessions/domain/schemas";

export type StudySessionRecord = {
  id: string;
  blockId: string | null;
  topicId: string;
  subject: string;
  topic: string;
  studiedOn: string;
  durationMinutes: number;
  questionCount: number;
  correctCount: number;
  notes: string | null;
  reviewDates: string[];
};

export type StudyTopicOption = { id: string; subject: string; topic: string };

export type SaveStudySessionResult =
  | { ok: true; status: "created" | "updated" | "exists"; sessionId: string; reviewDates: string[] }
  | { ok: false; message: string };

export type StudySessionFormValue = StudySessionInput;
