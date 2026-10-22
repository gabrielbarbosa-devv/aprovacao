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

export function splitWorkListTasks(tasks: TodoTask[], today: string) {
  const completed = tasks.filter((task) => task.status === "done");
  const pending = tasks.filter((task) => task.status !== "done");
  const overdue = pending.filter((task) => task.due_on !== null && task.due_on < today);
  const highPriority = pending.filter((task) => task.status === "todo" && task.priority === "high");
  const inProgress = pending.filter((task) => task.status === "in_progress");
  const other = pending.filter((task) => task.status === "todo" && task.priority !== "high");
  const upcoming = pending
    .filter((task) => task.due_on !== null && task.due_on >= today)
    .toSorted((a, b) => (taskDueDateKey(a) ?? "").localeCompare(taskDueDateKey(b) ?? ""));

  return { pending, completed, overdue, highPriority, inProgress, other, upcoming };
}

function taskDueDateKey(task: TodoTask) {
  if (!task.due_on) return null;
  return `${task.due_on}T${task.due_at ?? "23:59:59"}`;
}

export function countLabelUsage(taskIds: string[], links: { task_id: string; label_id: string }[]) {
  const allowed = new Set(taskIds);
  const counts = new Map<string, number>();
  for (const link of links) {
    if (allowed.has(link.task_id)) counts.set(link.label_id, (counts.get(link.label_id) ?? 0) + 1);
  }
  return counts;
}
