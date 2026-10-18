import { addStudyDays } from "../../../lib/date/study-day";
import type { AnalyticsFilters, AnalyticsPeriod, AnalyticsSort } from "./types";

type SearchValue = string | string[] | undefined;
export type AnalyticsSearchParams = Record<string, SearchValue>;
export type ResolvedAnalyticsFilters = { filters: AnalyticsFilters; invalidCustomRange: boolean };

export function resolveAnalyticsFilters(
  search: AnalyticsSearchParams,
  today: string,
  availableSubjectIds: ReadonlySet<string>,
): ResolvedAnalyticsFilters {
  const requestedPeriod = firstValue(search.period);
  const period: AnalyticsPeriod = requestedPeriod === "7" || requestedPeriod === "90" || requestedPeriod === "custom"
    ? requestedPeriod
    : "30";
  const sort = firstValue(search.sort);
  const sortBy: AnalyticsSort = sort === "correct" || sort === "accuracy" ? sort : "questions";
  const requestedSubject = firstValue(search.subject);
  const subjectId = requestedSubject && availableSubjectIds.has(requestedSubject) ? requestedSubject : null;

  if (period === "custom") {
    const from = firstValue(search.from);
    const to = firstValue(search.to);
    if (isCalendarDate(from) && isCalendarDate(to) && from <= to) {
      return { filters: { period, from, to, subjectId, sortBy }, invalidCustomRange: false };
    }
    return { filters: { period, from: addStudyDays(today, -29), to: today, subjectId, sortBy }, invalidCustomRange: true };
  }

  const days = Number(period);
  return { filters: { period, from: addStudyDays(today, 1 - days), to: today, subjectId, sortBy }, invalidCustomRange: false };
}

export function isCalendarDate(value: string | undefined): value is string {
  if (!value || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const [year, month, day] = value.split("-").map(Number);
  const date = new Date(Date.UTC(year, month - 1, day));
  return date.getUTCFullYear() === year && date.getUTCMonth() === month - 1 && date.getUTCDate() === day;
}

function firstValue(value: SearchValue): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}
