import { addStudyDays } from "../../../lib/date/study-day";
import type { PlanningBlock } from "./types";

export type ReorganizationChange = { id: string; from: string; to: string };

export function previewReorganization(
  candidates: PlanningBlock[],
  allBlocks: PlanningBlock[],
  firstAvailableDate: string,
  dailyGoalMinutes: number,
): ReorganizationChange[] {
  if (dailyGoalMinutes <= 0) return [];
  const movable = candidates.filter((block) => !block.pinned && block.status === "planejado");
  const candidateIds = new Set(movable.map(({ id }) => id));
  const allocations = new Map<string, number>();
  for (const block of allBlocks) {
    if (candidateIds.has(block.id) || block.status === "ignorado") continue;
    allocations.set(block.plannedDate, (allocations.get(block.plannedDate) ?? 0) + block.plannedMinutes);
  }

  const changes: ReorganizationChange[] = [];
  let date = firstAvailableDate;
  for (const block of movable) {
    let searchedDays = 0;
    while ((allocations.get(date) ?? 0) + block.plannedMinutes > dailyGoalMinutes && searchedDays < 3650) {
      date = addStudyDays(date, 1);
      searchedDays += 1;
    }
    if (searchedDays === 3650) continue;
    changes.push({ id: block.id, from: block.plannedDate, to: date });
    allocations.set(date, (allocations.get(date) ?? 0) + block.plannedMinutes);
  }
  return changes;
}
