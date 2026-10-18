export type DailyBlockCandidate = {
  id: string;
  plannedDate: string;
  sortOrder: number;
  status: "planejado" | "em_andamento";
};

/** Keeps existing dates intact while surfacing work that can be continued today. */
export function orderDailyBlocks<T extends DailyBlockCandidate>(blocks: T[], studyDay: string, limit = 2): T[] {
  return [...blocks]
    .filter((block) => block.plannedDate <= studyDay)
    .sort((left, right) => {
      const leftRank = left.status === "em_andamento" ? 0 : left.plannedDate < studyDay ? 1 : 2;
      const rightRank = right.status === "em_andamento" ? 0 : right.plannedDate < studyDay ? 1 : 2;
      return leftRank - rightRank
        || left.plannedDate.localeCompare(right.plannedDate)
        || left.sortOrder - right.sortOrder
        || left.id.localeCompare(right.id);
    })
    .slice(0, Math.max(0, limit));
}
