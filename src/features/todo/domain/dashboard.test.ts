import { describe, expect, it } from "vitest";
import type { TodoTask } from "./types";
import { calculateTodoDashboardMetrics, getTasksForDay, groupTodoTasksForDay, isTaskActiveOn, localDateFromKey, localDateKey, weekStartKey } from "./dashboard";

function task(overrides: Partial<TodoTask> = {}): TodoTask {
  return {
    id: "task-1", user_id: "user-1", list_id: "list-1", workspace_id: null,
    title: "Task", description: null, status: "todo", priority: "medium",
    starts_on: "2026-10-22", due_on: null, due_at: null, completed_at: null,
    position: 0, created_at: "2026-10-22T12:00:00.000Z", updated_at: "2026-10-22T12:00:00.000Z", deleted_at: null,
    ...overrides,
  };
}

describe("todo dashboard calculations", () => {
  it("uses local calendar fields to avoid UTC date drift", () => {
    const date = localDateFromKey("2026-10-22");
    expect(localDateKey(date)).toBe("2026-10-22");
    expect(weekStartKey("2026-10-22")).toBe("2026-10-19");
  });

  it("calculates today's count from real open tasks scheduled for the day", () => {
    expect(isTaskActiveOn(task({ starts_on: "2026-10-20", due_on: "2026-10-23" }), "2026-10-22")).toBe(true);
    expect(isTaskActiveOn(task({ starts_on: "2026-10-20", due_on: "2026-10-21" }), "2026-10-22")).toBe(false);
    expect(isTaskActiveOn(task({ status: "done" }), "2026-10-22")).toBe(false);
  });

  it("returns zero progress when the user has no weekly tasks", () => {
    expect(calculateTodoDashboardMetrics([], "2026-10-22")).toEqual({
      total: 0, today: 0, completed: 0, weekTotal: 0, weekCompleted: 0, weekPercent: 0,
    });
  });

  it("calculates weekly completion from task records rather than fixed values", () => {
    const tasks = [
      task({ id: "one", status: "done", completed_at: "2026-10-22T14:00:00.000Z" }),
      task({ id: "two" }),
      task({ id: "three", starts_on: "2026-10-11" }),
    ];
    expect(calculateTodoDashboardMetrics(tasks, "2026-10-22")).toEqual({
      total: 3, today: 1, completed: 1, weekTotal: 2, weekCompleted: 1, weekPercent: 50,
    });
  });

  it("includes tasks due today and excludes tasks scheduled for tomorrow", () => {
    const dueToday = task({ id: "today", starts_on: "2026-10-20", due_on: "2026-10-22" });
    const dueTomorrow = task({ id: "tomorrow", starts_on: "2026-10-23", due_on: "2026-10-23" });
    expect(getTasksForDay([dueToday, dueTomorrow], "2026-10-22").map(({ id }) => id)).toEqual(["today"]);
  });

  it("keeps overdue incomplete tasks visible and groups completed work separately", () => {
    const overdue = task({ id: "overdue", starts_on: "2026-10-20", due_on: "2026-10-21" });
    const completeToday = task({ id: "complete", status: "done", due_on: "2026-10-21", completed_at: "2026-10-22T16:00:00.000Z" });
    const groups = groupTodoTasksForDay([overdue, completeToday], "2026-10-22");
    expect(groups.overdue.map(({ id }) => id)).toEqual(["overdue"]);
    expect(groups.completed.map(({ id }) => id)).toEqual(["complete"]);
    expect(groups.highPriority).toEqual([]);
    expect(groups.other).toEqual([]);
  });

  it("moves reopened tasks back to their scheduled group without duplication", () => {
    const reopened = task({ id: "reopened", priority: "high", status: "todo", due_on: "2026-10-22" });
    const groups = groupTodoTasksForDay([reopened], "2026-10-22");
    expect(groups.highPriority.map(({ id }) => id)).toEqual(["reopened"]);
    expect(groups.other).toEqual([]);
    expect(groups.completed).toEqual([]);
  });
});
