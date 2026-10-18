import type { Subject } from "@/features/subjects/domain/types";

export function getActiveSubjectFocusGroups(subjects: Subject[]) {
  const activeSubjects = subjects.filter((subject) => subject.archivedAt === null);

  return {
    focusSubjects: activeSubjects.filter((subject) => subject.isFocus),
    otherSubjects: activeSubjects.filter((subject) => !subject.isFocus),
  };
}
