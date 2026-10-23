import type { ReactNode } from "react";
import { TodoLayout } from "@/features/todo/components/todo-layout";
import { requireUser } from "@/lib/auth/require-user";

export default async function TodoSegmentLayout({ children }: { children: ReactNode }) {
  const { user } = await requireUser();
  return <TodoLayout email={user.email ?? ""} userId={user.id}>{children}</TodoLayout>;
}
