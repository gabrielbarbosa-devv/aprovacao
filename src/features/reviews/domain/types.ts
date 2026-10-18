export type ReviewOutcome = {
  reviewedOn: string;
  difficulty: number | null;
  questionCount: number | null;
  correctCount: number | null;
  notes: string | null;
};

export type ReviewTask = {
  id: string;
  sessionId: string;
  subject: string;
  topic: string;
  topicNotes: string | null;
  sourceUrl: string | null;
  studiedOn: string;
  studyDurationMinutes: number;
  studyQuestionCount: number;
  studyCorrectCount: number;
  studyNotes: string | null;
  kind: "standard" | "reinforcement";
  intervalDays: number;
  dueOn: string;
  initialDueOn: string;
  status: "pending" | "completed";
  completedAt: string | null;
  outcome: ReviewOutcome | null;
};

export type ReviewBoardData = {
  email: string;
  studyDay: string;
  timeZone: string;
  due: ReviewTask[];
  upcoming: ReviewTask[];
  completed: ReviewTask[];
};

export type ReviewSummary = {
  total: number;
  items: ReviewTask[];
};
