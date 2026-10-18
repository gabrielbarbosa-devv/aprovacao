import { AppShell } from "@/components/app-shell";
import { getQuestionLogsPageData } from "@/features/question-logs/data/get-question-logs";
import { QuestionLogsPage } from "@/features/question-logs/components/question-logs-page";

export default async function Page({ searchParams }: { searchParams: Promise<{ sessionId?: string | string[] }> }) {
  const [data, query] = await Promise.all([getQuestionLogsPageData(), searchParams]);
  const requestedSessionId = typeof query.sessionId === "string" ? query.sessionId : null;
  const initialSessionId = data.studySessions.some((session) => session.id === requestedSessionId && session.deletedAt === null)
    ? requestedSessionId
    : null;

  return <AppShell email={data.email} activeItem="registros"><QuestionLogsPage data={data} initialSessionId={initialSessionId} /></AppShell>;
}
