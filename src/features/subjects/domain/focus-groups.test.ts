import { describe, expect, it } from "vitest";
import { getActiveSubjectFocusGroups } from "./focus-groups";
import type { Subject } from "./types";

function subject(id: string, sortOrder: number, isFocus: boolean, archivedAt: string | null = null): Subject {
  return {
    id,
    name: `Matéria ${id}`,
    colorToken: "blue",
    sortOrder,
    isFocus,
    archivedAt,
    topics: [],
    futureBlockCount: 0,
  };
}

describe("subject focus groups", () => {
  it("groups by the saved focus preference and preserves database order", () => {
    const subjects = [
      subject("português", 1, true),
      subject("raciocínio", 2, true),
      subject("trânsito", 3, false),
      subject("matemática", 4, true),
    ];

    const groups = getActiveSubjectFocusGroups(subjects);

    expect(groups.focusSubjects.map(({ id }) => id)).toEqual(["português", "raciocínio", "matemática"]);
    expect(groups.otherSubjects.map(({ id }) => id)).toEqual(["trânsito"]);
  });

  it("has no fixed focus limit and excludes archived subjects from active groups", () => {
    const subjects = Array.from({ length: 15 }, (_, index) => subject(`subject-${index}`, index + 1, index < 12, index === 12 ? "2026-10-18T00:00:00Z" : null));

    const groups = getActiveSubjectFocusGroups(subjects);

    expect(groups.focusSubjects).toHaveLength(12);
    expect(groups.otherSubjects).toHaveLength(2);
    expect([...groups.focusSubjects, ...groups.otherSubjects]).toHaveLength(14);
  });
});
