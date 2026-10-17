import { describe, expect, it } from "vitest";
import { previewReorganization } from "./reorganize";
import type { PlanningBlock } from "./types";

const block = (id: string, date: string, minutes = 120, status: PlanningBlock["status"] = "planejado", pinned = false): PlanningBlock => ({
  id, topicId: "topic", subject: "Português", topic: "Interpretação", plannedDate: date,
  plannedMinutes: minutes, plannedStartTime: null, status, pinned, sortOrder: 0,
});

describe("previewReorganization", () => {
  it("includes weekends and rolls past a full next day without exceeding the daily cap", () => {
    const backlog = [block("a", "2026-10-17"), block("b", "2026-10-17"), block("c", "2026-10-17")];
    const result = previewReorganization(backlog, [...backlog, block("full", "2026-10-18", 240)], "2026-10-18", 240);
    expect(result.map(({ to }) => to)).toEqual(["2026-10-19", "2026-10-19", "2026-10-20"]);
  });

  it("preserves pinned and completed blocks", () => {
    const candidates = [block("pinned", "2026-10-17", 60, "planejado", true), block("done", "2026-10-17", 60, "concluido")];
    expect(previewReorganization(candidates, candidates, "2026-10-18", 240)).toEqual([]);
  });

  it("returns no changes when there is no daily capacity", () => {
    expect(previewReorganization([block("a", "2026-10-17")], [], "2026-10-18", 0)).toEqual([]);
  });
});
