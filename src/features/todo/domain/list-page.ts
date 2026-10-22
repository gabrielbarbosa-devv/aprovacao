import type { TodoTask } from "@/features/todo/domain/types";

export function splitListTasks(tasks: TodoTask[], today: string) {
  const pending = tasks.filter((task) => task.status !== "done");
  const completed = tasks.filter((task) => task.status === "done");
  return {
    pending,
    completed,
    upcoming: pending.filter((task) => task.due_on !== null && task.due_on > today),
  };
}

export function countLabelUsage(taskIds: string[], links: { task_id: string; label_id: string }[]) {
  const allowed = new Set(taskIds);
  const counts = new Map<string, number>();
  for (const link of links) {
    if (allowed.has(link.task_id)) counts.set(link.label_id, (counts.get(link.label_id) ?? 0) + 1);
  }
  return counts;
}
