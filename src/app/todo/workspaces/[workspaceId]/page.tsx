import { TodoWorkspaceDetailPage } from "@/features/todo/components/todo-workspace-detail-page";

export default async function TodoWorkspaceDetailRoute({ params }: { params: Promise<{ workspaceId: string }> }) {
  const { workspaceId } = await params;
  return <TodoWorkspaceDetailPage workspaceId={workspaceId} />;
}
