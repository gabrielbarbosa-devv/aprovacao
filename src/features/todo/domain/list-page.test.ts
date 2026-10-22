import { describe, expect, it } from "vitest";
import { countLabelUsage, splitListTasks } from "./list-page";
import type { TodoTask } from "./types";

function task(id: string, status: string, due_on: string | null): TodoTask {
  return { id, user_id: "user", list_id: "list", workspace_id: null, title: id, description: null, status, priority: "medium", starts_on: "2026-10-01", due_on, due_at: null, completed_at: status === "done" ? "2026-10-01T12:00:00Z" : null, position: 0, created_at: "2026-10-01T12:00:00Z", updated_at: "2026-10-01T12:00:00Z", deleted_at: null };
}

describe("list page derived data", () => {
  it("counts pending, completed and upcoming from persisted task fields", () => {
    const result = splitListTasks([task("today", "todo", "2026-10-22"), task("later", "in_progress", "2026-10-23"), task("done", "done", "2026-10-25")], "2026-10-22");
    expect(result.pending.map(({ id }) => id)).toEqual(["today", "later"]);
    expect(result.completed.map(({ id }) => id)).toEqual(["done"]);
    expect(result.upcoming.map(({ id }) => id)).toEqual(["later"]);
  });

  it("counts only real task-label links for the open list", () => {
    const counts = countLabelUsage(["a", "b"], [{ task_id: "a", label_id: "health" }, { task_id: "b", label_id: "health" }, { task_id: "outside", label_id: "health" }, { task_id: "a", label_id: "home" }]);
    expect([...counts.entries()]).toEqual([["health", 2], ["home", 1]]);
  });
});
