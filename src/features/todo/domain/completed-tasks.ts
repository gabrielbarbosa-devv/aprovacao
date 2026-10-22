import type { TodoList, TodoTask } from "./types";
import { localDateFromKey, localDateKey, weekStartKey } from "./dashboard";

export type TodoCompletedPeriod = "week" | "month" | "all";
export type TodoCompletedRange = { from: string; to: string };
export type TodoCompletedGroup = { date: string; tasks: TodoTask[] };
export type TodoCompletedDay = { date: string; label: string; completed: number; planned: number };
export type TodoCompletedListSummary = { id: string; name: string; count: number };
export type TodoCompletedMetrics = {
  completed: number;
  denominator: number;
  completionRate: number | null;
  daily: TodoCompletedDay[];
  byList: TodoCompletedListSummary[];
};

export function getTodoCompletedRange(tasks: TodoTask[], today: string, period: TodoCompletedPeriod): TodoCompletedRange {
  if (period === "week") return { from: weekStartKey(today), to: today };
  if (period === "month") return { from: `${today.slice(0, 7)}-01`, to: today };

  const dates = tasks.flatMap((task) => [task.starts_on, task.due_on, task.due_at ? localDateKey(new Date(task.due_at)) : null, task.completed_at ? localDateKey(new Date(task.completed_at)) : null])
    .filter((date): date is string => date !== null && date <= today)
    .sort();
  return { from: dates[0] ?? today, to: today };
}

export function filterCompletedTasks(
  tasks: TodoTask[],
  range: TodoCompletedRange,
  filters: { listId: string; workspaceId: string },
): TodoTask[] {
  return tasks.filter((task) => {
    if (task.status !== "done" || task.completed_at === null) return false;
    const completedDate = localDateKey(new Date(task.completed_at));
    if (completedDate < range.from || completedDate > range.to) return false;
    if (filters.listId !== "all" && task.list_id !== filters.listId) return false;
    if (filters.workspaceId !== "all" && task.workspace_id !== filters.workspaceId) return false;
    return true;
  }).sort((left, right) => right.completed_at!.localeCompare(left.completed_at!) || left.id.localeCompare(right.id));
}

export function groupCompletedTasks(tasks: TodoTask[]): TodoCompletedGroup[] {
  const groups = new Map<string, TodoTask[]>();
  for (const task of tasks) {
    if (!task.completed_at) continue;
    const date = localDateKey(new Date(task.completed_at));
    const group = groups.get(date) ?? [];
    group.push(task);
    groups.set(date, group);
  }
  return [...groups.entries()]
    .sort(([left], [right]) => right.localeCompare(left))
    .map(([date, dateTasks]) => ({ date, tasks: dateTasks }));
}

function dateKeys(from: string, to: string): string[] {
  const current = localDateFromKey(from);
  const end = localDateFromKey(to);
  const dates: string[] = [];
  while (current <= end) {
    dates.push(localDateKey(current));
    current.setDate(current.getDate() + 1);
  }
  return dates;
}

export function calculateTodoCompletedMetrics(
  tasks: TodoTask[],
  completedTasks: TodoTask[],
  range: TodoCompletedRange,
  lists: TodoList[],
  allTime = false,
): TodoCompletedMetrics {
  const plannedIds = new Set(tasks.filter((task) =>
    task.starts_on >= range.from && task.starts_on <= range.to
    || (task.due_on !== null && task.due_on >= range.from && task.due_on <= range.to)
    || (task.due_at !== null && localDateKey(new Date(task.due_at)) >= range.from && localDateKey(new Date(task.due_at)) <= range.to),
  ).map(({ id }) => id));
  const denominatorIds = new Set([...plannedIds, ...completedTasks.map(({ id }) => id)]);
  const lastChartDate = localDateFromKey(range.to);
  lastChartDate.setDate(lastChartDate.getDate() - 29);
  const chartFrom = allTime && dateKeys(range.from, range.to).length > 30 ? localDateKey(lastChartDate) : range.from;
  const daily = dateKeys(chartFrom, range.to).map((date): TodoCompletedDay => {
    const planned = new Set(tasks.filter((task) => task.starts_on === date || task.due_on === date || (task.due_at !== null && localDateKey(new Date(task.due_at)) === date)).map(({ id }) => id));
    return {
      date,
      label: new Intl.DateTimeFormat("pt-BR", { day: "2-digit", month: "short" }).format(localDateFromKey(date)).replace(" de ", " "),
      completed: completedTasks.filter((task) => task.completed_at !== null && localDateKey(new Date(task.completed_at)) === date).length,
      planned: planned.size,
    };
  });

  const countsByList = new Map<string, number>();
  for (const task of completedTasks) countsByList.set(task.list_id, (countsByList.get(task.list_id) ?? 0) + 1);
  const listNames = new Map(lists.map((list) => [list.id, list.name]));
  const byList = [...countsByList.entries()]
    .map(([id, count]) => ({ id, name: listNames.get(id) ?? "Lista removida", count }))
    .sort((left, right) => right.count - left.count || left.name.localeCompare(right.name, "pt-BR"));

  // The rate denominator is unique tasks planned by start/deadline in this range,
  // plus tasks actually completed in the range (including unscheduled tasks).
  // This keeps the numerator within the denominator and avoids double counting.
  return {
    completed: completedTasks.length,
    denominator: denominatorIds.size,
    completionRate: denominatorIds.size ? Math.round((completedTasks.length / denominatorIds.size) * 100) : null,
    daily,
    byList,
  };
}

export function formatCompletedGroupLabel(date: string, today: string): string {
  if (date === today) return `Hoje — ${new Intl.DateTimeFormat("pt-BR", { day: "numeric", month: "long" }).format(localDateFromKey(date))}`;
  const yesterday = localDateFromKey(today);
  yesterday.setDate(yesterday.getDate() - 1);
  if (date === localDateKey(yesterday)) return `Ontem — ${new Intl.DateTimeFormat("pt-BR", { day: "numeric", month: "long" }).format(localDateFromKey(date))}`;
  return new Intl.DateTimeFormat("pt-BR", { weekday: "long", day: "numeric", month: "long" }).format(localDateFromKey(date));
}
