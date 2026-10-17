export type TodayStudyBlock = {
  id: string;
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
  reviewCount: 0;
};
