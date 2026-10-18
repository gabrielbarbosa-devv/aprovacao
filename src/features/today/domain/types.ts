import type { StudyTopicOption, StudySessionRecord } from "@/features/study-sessions/domain/types";
import type { ReviewTask } from "@/features/reviews/domain/types";

export type TodayStudyBlock = {
  id: string;
  topicId: string;
  subject: string;
  topic: string;
  durationMinutes: number;
  sequence: number;
  status: "planejado" | "em_andamento";
};

export type TodayDashboard = {
  studyDay: string;
  timeZone: string;
  dailyGoalMinutes: number;
  email: string;
  blocks: TodayStudyBlock[];
  hasPlan: boolean;
  reviewCount: number;
  reviewItems: ReviewTask[];
  topics: StudyTopicOption[];
  history: StudySessionRecord[];
};
