import { describe, expect, it } from "vitest";
import type { TodoTask } from "@/features/todo/domain/types";
import { filterTodoTasks, groupTodoTasks, hasTodoTaskListFilters, type TodoTaskListFilters } from "./task-list";

const today = "2026-10-22";
const baseFilters: TodoTaskListFilters = { query: "", status: "all", listId: "all", priority: "all", due: "all", dueDate: "", sort: "date" };

function task(id: string, overrides: Partial<TodoTask> = {}): TodoTask {
  return {
    id, user_id: "user-1", list_id: "list-personal", workspace_id: null,
    title: id, description: null, status: "todo", priority: "medium",
    starts_on: today, due_on: null, due_at: null, completed_at: null,
    position: 0, created_at: `${today}T12:00:00.000Z`, updated_at: `${today}T12:00:00.000Z`, deleted_at: null,
    ...overrides,
  };
}

const tasks = [
  task("atrasada", { starts_on: "2026-10-20", due_on: "2026-10-21", priority: "high" }),
  task("hoje", { due_on: today, description: "Pagar conta de energia", list_id: "list-work", priority: "high" }),
  task("semana", { due_on: "2026-10-25" }),
  task("proxima", { due_on: "2026-10-26" }),
  task("sem-data"),
  task("concluida", { status: "done", completed_at: `${today}T14:00:00.000Z`, due_on: "2026-10-20" }),
];

describe("todo task list filters and grouping", () => {
  it("combines text, list, priority, status, and specific due date filters", () => {
    const result = filterTodoTasks(tasks, {
      ...baseFilters,
      query: "energia",
      status: "pending",
      listId: "list-work",
      priority: "high",
      dueDate: today,
    }, today);
    expect(result.map(({ id }) => id)).toEqual(["hoje"]);
  });

  it("separates overdue, this-week, upcoming, no-date, and completed tasks once", () => {
    const groups = groupTodoTasks(tasks, today, "date");
    expect(groups.overdue.map(({ id }) => id)).toEqual(["atrasada"]);
    expect(groups.thisWeek.map(({ id }) => id)).toEqual(["hoje", "semana"]);
    expect(groups.upcoming.map(({ id }) => id)).toEqual(["proxima"]);
    expect(groups.noDate.map(({ id }) => id)).toEqual(["sem-data"]);
    expect(groups.completed.map(({ id }) => id)).toEqual(["concluida"]);
    const ids = Object.values(groups).flat().map(({ id }) => id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it("filters task buckets without mixing completed records into pending results", () => {
    expect(filterTodoTasks(tasks, { ...baseFilters, due: "overdue" }, today).map(({ id }) => id)).toEqual(["atrasada"]);
    expect(filterTodoTasks(tasks, { ...baseFilters, due: "this_week" }, today).map(({ id }) => id)).toEqual(["hoje", "semana"]);
    expect(filterTodoTasks(tasks, { ...baseFilters, due: "upcoming" }, today).map(({ id }) => id)).toEqual(["proxima"]);
    expect(filterTodoTasks(tasks, { ...baseFilters, due: "no_date" }, today).map(({ id }) => id)).toEqual(["sem-data"]);
  });

  it("sorts by priority and detects when filters need clearing", () => {
    const result = filterTodoTasks(tasks, { ...baseFilters, sort: "priority", status: "pending" }, today);
    expect(result.slice(0, 2).map(({ id }) => id)).toEqual(["atrasada", "hoje"]);
    expect(hasTodoTaskListFilters(baseFilters)).toBe(false);
    expect(hasTodoTaskListFilters({ ...baseFilters, query: "energia" })).toBe(true);
  });
});
