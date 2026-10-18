import { describe, expect, it } from "vitest";
import { getTopicCoverage } from "./types";

describe("exam topic coverage", () => {
  it("does not calculate a percentage before the user links topics", () => {
    expect(getTopicCoverage([])).toEqual({ configured: false });
  });

  it("counts only linked topics explicitly marked as mastered", () => {
    expect(getTopicCoverage([
      { id: "1", title: "Um", status: "dominado", subjectId: "s1", archivedAt: null },
      { id: "2", title: "Dois", status: "em_andamento", subjectId: "s1", archivedAt: null },
    ])).toEqual({ configured: true, mastered: 1, total: 2 });
  });
});
