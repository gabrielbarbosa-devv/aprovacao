import { describe, expect, it } from "vitest";
import { moveItem, reorderById } from "./manual-order";

describe("manual task ordering", () => {
  const tasks = ["A", "B", "C", "D", "E"].map((id) => ({ id }));

  it("moves the last task to the beginning", () => {
    expect(reorderById(tasks, "E", "A").map((task) => task.id)).toEqual(["E", "A", "B", "C", "D"]);
  });

  it("moves a task one position down", () => {
    const firstMove = reorderById(tasks, "E", "A");
    expect(reorderById(firstMove, "A", "B").map((task) => task.id)).toEqual(["E", "B", "A", "C", "D"]);
  });

  it("moves to either edge and leaves invalid moves unchanged", () => {
    expect(moveItem(tasks, 3, 0).map((task) => task.id)).toEqual(["D", "A", "B", "C", "E"]);
    expect(moveItem(tasks, 1, 4).map((task) => task.id)).toEqual(["A", "C", "D", "E", "B"]);
    expect(moveItem(tasks, -1, 2)).toEqual(tasks);
  });
});
