import type { StudySessionRecord } from "@/features/study-sessions/domain/types";

export type PlanningStatus = "planejado" | "em_andamento" | "concluido" | "ignorado";

export type PlanningBlock = {
  id: string;
  topicId: string;
  subject: string;
  topic: string;
  plannedDate: string;
  plannedMinutes: number;
  plannedStartTime: string | null;
  status: PlanningStatus;
  pinned: boolean;
  sortOrder: number;
  updatedAt: string;
  studySession: StudySessionRecord | null;
};

export type PlanningTopicOption = { id: string; subjectId: string; subject: string; topic: string };

export type PlanningData = {
  email: string;
  today: string;
  timeZone: string;
  dailyGoalMinutes: number;
  weekStart: string;
  blocks: PlanningBlock[];
  topics: PlanningTopicOption[];
};
