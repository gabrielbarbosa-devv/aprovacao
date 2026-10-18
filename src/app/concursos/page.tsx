import { AppShell } from "@/components/app-shell";
import { ExamsPage } from "@/features/exams/components/exams-page";
import { getExamTargetsPageData } from "@/features/exams/data/get-exam-targets";

export default async function ExamsRoute() {
  const data = await getExamTargetsPageData();
  return <AppShell email={data.email} activeItem="concursos"><ExamsPage data={data} /></AppShell>;
}
