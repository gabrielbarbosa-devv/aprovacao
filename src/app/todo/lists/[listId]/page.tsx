import { TodoListPage } from "@/features/todo/components/todo-list-page";

export default async function TodoListRoute({ params }: { params: Promise<{ listId: string }> }) {
  const { listId } = await params;
  return <TodoListPage listId={listId} />;
}
