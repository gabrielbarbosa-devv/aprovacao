import { notFound } from "next/navigation";
import { AppShell } from "@/components/app-shell";
import { SubjectTopicsPage } from "@/features/topics/components/subject-topics-page";
import { getSubjectTopicsPageData } from "@/features/topics/data/get-subject-topics";

export default async function SubjectTopicsRoute({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(id)) notFound();
  const data = await getSubjectTopicsPageData(id);
  return <AppShell email={data.email} activeItem="materias"><SubjectTopicsPage data={data} /></AppShell>;
}
