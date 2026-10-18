import { describe, expect, it } from "vitest";
import { orderDailyBlocks } from "./order-daily-blocks";

const block = (id: string, plannedDate: string, sortOrder: number, status: "planejado" | "em_andamento" = "planejado") => ({ id, plannedDate, sortOrder, status });

describe("orderDailyBlocks", () => {
  it("continues an active block before recovering the oldest missed block", () => {
    const result = orderDailyBlocks([
      block("today", "2026-10-18", 1),
      block("oldest", "2026-10-16", 3),
      block("active", "2026-10-17", 2, "em_andamento"),
      block("newer", "2026-10-17", 1),
      block("future", "2026-10-19", 1),
    ], "2026-10-18");
    expect(result.map(({ id }) => id)).toEqual(["active", "oldest"]);
  });

  it("preserves today's planned order when there is no overdue work", () => {
    const result = orderDailyBlocks([block("second", "2026-10-18", 2), block("first", "2026-10-18", 1)], "2026-10-18");
    expect(result.map(({ id }) => id)).toEqual(["first", "second"]);
  });

  it("does not invent work when every block is in the future", () => {
    expect(orderDailyBlocks([block("future", "2026-10-19", 1)], "2026-10-18")).toEqual([]);
  });
});
