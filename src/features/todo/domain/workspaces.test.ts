import { describe, expect, it } from "vitest";
import { activityLabel, filterWorkspacesBySearch, summarizeWorkspaceTasks } from "./workspaces";
import type { TodoTask } from "./types";

function task(id: string, status: string): TodoTask {
  return { id, user_id: "user", list_id: "list", workspace_id: "workspace", title: id, description: null, status, priority: "medium", starts_on: "2026-10-01", due_on: null, due_at: null, completed_at: status === "done" ? "2026-10-01T12:00:00Z" : null, position: 0, created_at: "2026-10-01T12:00:00Z", updated_at: "2026-10-01T12:00:00Z", deleted_at: null };
}

describe("workspace derived data", () => {
  it("calculates completion from persisted workspace tasks", () => {
    expect(summarizeWorkspaceTasks([task("one", "done"), task("two", "todo"), task("three", "in_progress")])).toMatchObject({ total: 3, completed: 1, pending: 2, progress: 33, filterStatus: "in_progress" });
    expect(summarizeWorkspaceTasks([task("one", "done")]).filterStatus).toBe("completed");
    expect(summarizeWorkspaceTasks([])).toMatchObject({ total: 0, progress: 0, filterStatus: "empty" });
  });

  it("searches real workspace names and descriptions case-insensitively", () => {
    const rows = [{ name: "App Mobile", description: "iOS" }, { name: "Clientes", description: null }];
    expect(filterWorkspacesBySearch(rows, " IOS ")).toEqual([rows[0]]);
    expect(filterWorkspacesBySearch(rows, "")).toEqual(rows);
  });

  it("uses activity labels without fabricating event data", () => {
    expect(activityLabel("completed")).toBe("Tarefa concluída");
    expect(activityLabel("priority_changed")).toBe("Tarefa atualizada");
  });
});
