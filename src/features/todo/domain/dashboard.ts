import type { TodoTask } from "@/features/todo/domain/types";

export type TodoTaskDate = Pick<TodoTask, "starts_on" | "due_on" | "due_at" | "status" | "completed_at" | "created_at">;

export type TodoDashboardMetrics = {
  total: number;
  today: number;
  completed: number;
  weekTotal: number;
  weekCompleted: number;
  weekPercent: number;
};

export function localDateKey(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

export function localDateFromKey(key: string): Date {
  const [year, month, day] = key.split("-").map(Number);
  return new Date(year ?? 2000, (month ?? 1) - 1, day ?? 1, 12);
}

export function weekStartKey(dateKey: string): string {
  const date = localDateFromKey(dateKey);
  const daysFromMonday = (date.getDay() + 6) % 7;
  date.setDate(date.getDate() - daysFromMonday);
  return localDateKey(date);
}

export function weekEndKey(dateKey: string): string {
  const date = localDateFromKey(weekStartKey(dateKey));
  date.setDate(date.getDate() + 6);
  return localDateKey(date);
}

export function taskDueDateKey(task: TodoTaskDate): string | null {
  if (task.due_on) return task.due_on;
  if (task.due_at) return localDateKey(new Date(task.due_at));
  return null;
}

export function isTaskActiveOn(task: TodoTaskDate, dateKey: string): boolean {
  if (task.status === "done") return false;
  const dueAtKey = task.due_at ? localDateKey(new Date(task.due_at)) : null;
  if (dueAtKey === dateKey || task.due_on === dateKey) return true;
  if (task.due_on) return task.starts_on <= dateKey && task.due_on >= dateKey;
  return task.starts_on === dateKey;
}

export function isTaskScheduledOn(task: TodoTaskDate, dateKey: string): boolean {
  const dueAtKey = task.due_at ? localDateKey(new Date(task.due_at)) : null;
  return task.starts_on === dateKey || task.due_on === dateKey || dueAtKey === dateKey;
}

export function calculateTodoDashboardMetrics(tasks: TodoTask[], today: string): TodoDashboardMetrics {
  const start = weekStartKey(today);
  const end = weekEndKey(today);
  const weeklyTasks = tasks.filter((task) =>
    (task.starts_on >= start && task.starts_on <= end)
    || (task.due_on !== null && task.due_on >= start && task.due_on <= end)
    || (task.completed_at !== null && localDateKey(new Date(task.completed_at)) >= start && localDateKey(new Date(task.completed_at)) <= end),
  );
  const weekCompleted = weeklyTasks.filter((task) => {
    if (task.status !== "done" || !task.completed_at) return false;
    const completedDate = localDateKey(new Date(task.completed_at));
    return completedDate >= start && completedDate <= end;
  }).length;

  return {
    total: tasks.length,
    today: tasks.filter((task) => isTaskActiveOn(task, today)).length,
    completed: tasks.filter((task) => task.status === "done").length,
    weekTotal: weeklyTasks.length,
    weekCompleted,
    weekPercent: weeklyTasks.length ? Math.round((weekCompleted / weeklyTasks.length) * 100) : 0,
  };
}
