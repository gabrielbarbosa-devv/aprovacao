import type { TodoTask } from "./types";
import { taskDueDateKey, weekEndKey } from "./dashboard";

export type TodoTaskStatusFilter = "all" | "pending" | "completed";
export type TodoTaskDueFilter = "all" | "overdue" | "this_week" | "upcoming" | "no_date";
export type TodoTaskSort = "date" | "priority" | "created";

export type TodoTaskListFilters = {
  query: string;
  status: TodoTaskStatusFilter;
  listId: string;
  priority: "all" | TodoTask["priority"];
  due: TodoTaskDueFilter;
  dueDate: string;
  sort: TodoTaskSort;
};

export type TodoTaskListGroups = {
  overdue: TodoTask[];
  thisWeek: TodoTask[];
  upcoming: TodoTask[];
  noDate: TodoTask[];
  completed: TodoTask[];
};

function priorityWeight(priority: TodoTask["priority"]): number {
  return priority === "high" ? 0 : priority === "medium" ? 1 : 2;
}

function compareTasks(left: TodoTask, right: TodoTask, sort: TodoTaskSort): number {
  if (sort === "priority") return priorityWeight(left.priority) - priorityWeight(right.priority)
    || (taskDueDateKey(left) ?? "9999-12-31").localeCompare(taskDueDateKey(right) ?? "9999-12-31")
    || left.position - right.position;
  if (sort === "created") return right.created_at.localeCompare(left.created_at) || left.id.localeCompare(right.id);
  return (taskDueDateKey(left) ?? "9999-12-31").localeCompare(taskDueDateKey(right) ?? "9999-12-31")
    || (left.due_at ?? "").localeCompare(right.due_at ?? "")
    || left.position - right.position
    || left.created_at.localeCompare(right.created_at);
}

export function filterTodoTasks(tasks: TodoTask[], filters: TodoTaskListFilters, today: string): TodoTask[] {
  const endOfWeek = weekEndKey(today);
  const query = filters.query.trim().toLocaleLowerCase("pt-BR");
  const filtered = tasks.filter((task) => {
    if (filters.status === "pending" && task.status === "done") return false;
    if (filters.status === "completed" && task.status !== "done") return false;
    if (filters.listId !== "all" && task.list_id !== filters.listId) return false;
    if (filters.priority !== "all" && task.priority !== filters.priority) return false;

    const dueDate = taskDueDateKey(task);
    if (filters.dueDate && dueDate !== filters.dueDate) return false;
    if (filters.due === "overdue" && (task.status === "done" || dueDate === null || dueDate >= today)) return false;
    if (filters.due === "this_week" && (task.status === "done" || dueDate === null || dueDate < today || dueDate > endOfWeek)) return false;
    if (filters.due === "upcoming" && (task.status === "done" || dueDate === null || dueDate <= endOfWeek)) return false;
    if (filters.due === "no_date" && dueDate !== null) return false;
    if (query && !task.title.toLocaleLowerCase("pt-BR").includes(query)
      && !(task.description ?? "").toLocaleLowerCase("pt-BR").includes(query)) return false;
    return true;
  });
  return filtered.sort((left, right) => compareTasks(left, right, filters.sort));
}

export function groupTodoTasks(tasks: TodoTask[], today: string, sort: TodoTaskSort): TodoTaskListGroups {
  const endOfWeek = weekEndKey(today);
  const groups: TodoTaskListGroups = { overdue: [], thisWeek: [], upcoming: [], noDate: [], completed: [] };

  for (const task of tasks) {
    if (task.status === "done") {
      groups.completed.push(task);
      continue;
    }
    const dueDate = taskDueDateKey(task);
    if (dueDate === null) groups.noDate.push(task);
    else if (dueDate < today) groups.overdue.push(task);
    else if (dueDate <= endOfWeek) groups.thisWeek.push(task);
    else groups.upcoming.push(task);
  }

  for (const group of Object.values(groups)) group.sort((left, right) => compareTasks(left, right, sort));
  return groups;
}

export function hasTodoTaskListFilters(filters: TodoTaskListFilters): boolean {
  return Boolean(filters.query.trim()) || filters.status !== "all" || filters.listId !== "all"
    || filters.priority !== "all" || filters.due !== "all" || Boolean(filters.dueDate) || filters.sort !== "date";
}
