import { describe, expect, it } from "vitest";
import type { TodoList, TodoTask } from "./types";
import {
  calculateTodoCompletedMetrics,
  filterCompletedTasks,
  getTodoCompletedRange,
  groupCompletedTasks,
} from "./completed-tasks";

const today = "2026-10-22";
const lists = [
  { id: "personal", user_id: "user-1", name: "Pessoal", slug: "pessoal", icon: "list", color: "blue", position: 0, created_at: `${today}T12:00:00Z`, updated_at: `${today}T12:00:00Z` },
  { id: "work", user_id: "user-1", name: "Trabalho", slug: "trabalho", icon: "list", color: "green", position: 1, created_at: `${today}T12:00:00Z`, updated_at: `${today}T12:00:00Z` },
] satisfies TodoList[];

function task(id: string, overrides: Partial<TodoTask> = {}): TodoTask {
  return {
    id, user_id: "user-1", list_id: "personal", workspace_id: null,
    title: id, description: null, status: "todo", priority: "medium",
    starts_on: today, due_on: null, due_at: null, completed_at: null,
    position: 0, recurrence_rule_id: null, recurrence_on: null, created_at: `${today}T12:00:00.000Z`, updated_at: `${today}T12:00:00.000Z`, deleted_at: null, archived_at: null,
    ...overrides,
  };
}

describe("completed task history", () => {
  const rows = [
    task("done-today", { status: "done", completed_at: "2026-10-22T15:15:00.000Z" }),
    task("done-yesterday", { status: "done", completed_at: "2026-10-21T10:00:00.000Z", list_id: "work", workspace_id: "workspace-a" }),
    task("pending", { due_on: "2026-10-22" }),
    task("reopened", { status: "todo", completed_at: null }),
    task("done-no-timestamp", { status: "done", completed_at: null }),
  ];

  it("uses local ranges for week, month, and all-time history", () => {
    expect(getTodoCompletedRange(rows, today, "week")).toEqual({ from: "2026-10-19", to: today });
    expect(getTodoCompletedRange(rows, today, "month")).toEqual({ from: "2026-10-01", to: today });
    expect(getTodoCompletedRange(rows, today, "all").to).toBe(today);
  });

  it("shows only currently completed tasks with a completion timestamp in the selected period", () => {
    const range = getTodoCompletedRange(rows, today, "week");
    expect(filterCompletedTasks(rows, range, { listId: "all", workspaceId: "all" }).map(({ id }) => id))
      .toEqual(["done-today", "done-yesterday"]);
    expect(filterCompletedTasks(rows, range, { listId: "work", workspaceId: "all" }).map(({ id }) => id))
      .toEqual(["done-yesterday"]);
    expect(filterCompletedTasks(rows, range, { listId: "all", workspaceId: "workspace-a" }).map(({ id }) => id))
      .toEqual(["done-yesterday"]);
  });

  it("groups by completion date and calculates a unique denominator and real list totals", () => {
    const range = getTodoCompletedRange(rows, today, "week");
    const done = filterCompletedTasks(rows, range, { listId: "all", workspaceId: "all" });
    const metrics = calculateTodoCompletedMetrics(rows, done, range, lists);
    expect(groupCompletedTasks(done).map(({ date, tasks: items }) => [date, items.length])).toEqual([
      [today, 1], ["2026-10-21", 1],
    ]);
    expect(metrics).toMatchObject({ completed: 2, denominator: 5, completionRate: 40 });
    expect(metrics.byList).toEqual([
      { id: "personal", name: "Pessoal", count: 1 },
      { id: "work", name: "Trabalho", count: 1 },
    ]);
  });

  it("does not report a percentage when there is no planned or completed denominator", () => {
    const range = { from: "2026-10-01", to: today };
    const metrics = calculateTodoCompletedMetrics([], [], range, []);
    expect(metrics.completionRate).toBeNull();
    expect(metrics.denominator).toBe(0);
    expect(metrics.daily.length).toBe(22);
  });
});
