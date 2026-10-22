import { describe, expect, it } from "vitest";
import { todoTaskBundleSchema } from "./schemas";

const validTask = {
  listId: "11111111-1111-4111-8111-111111111111",
  workspaceId: null,
  title: "Organizar documentos",
  description: null,
  priority: "medium" as const,
  startsOn: "2026-10-22",
  dueOn: "2026-10-23",
  dueAt: "2026-10-23T16:30:00.000Z",
  labelIds: [],
  newLabels: ["Pessoal"],
  subtasks: [{ title: "Separar comprovantes", isCompleted: false }],
};

describe("todo task form validation", () => {
  it("accepts a task with dates, optional associations and subtasks", () => {
    expect(todoTaskBundleSchema.safeParse(validTask).success).toBe(true);
  });

  it("requires a title and an owned-list identifier", () => {
    expect(todoTaskBundleSchema.safeParse({ ...validTask, title: "   " }).success).toBe(false);
    expect(todoTaskBundleSchema.safeParse({ ...validTask, listId: "" }).success).toBe(false);
  });

  it("rejects due dates before start and times without a due date", () => {
    const earlierDue = todoTaskBundleSchema.safeParse({ ...validTask, dueOn: "2026-10-21" });
    const timeWithoutDate = todoTaskBundleSchema.safeParse({ ...validTask, dueOn: null });
    expect(earlierDue.success).toBe(false);
    expect(timeWithoutDate.success).toBe(false);
  });

  it("enforces relation limits and field lengths", () => {
    expect(todoTaskBundleSchema.safeParse({ ...validTask, title: "x".repeat(241) }).success).toBe(false);
    expect(todoTaskBundleSchema.safeParse({ ...validTask, subtasks: Array.from({ length: 51 }, () => ({ title: "Etapa", isCompleted: false })) }).success).toBe(false);
  });
});
