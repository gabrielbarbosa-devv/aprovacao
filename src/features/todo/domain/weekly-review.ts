import { addDays, format, startOfWeek } from "date-fns";

export function weeklyReviewStart(date: Date): string {
  return format(startOfWeek(date, { weekStartsOn: 1 }), "yyyy-MM-dd");
}

export function plannedWeekDays(weekStart: string): { key: string; dayOffset: number }[] {
  const [year, month, day] = weekStart.split("-").map(Number);
  const monday = new Date(year, month - 1, day, 12);
  return Array.from({ length: 7 }, (_, dayOffset) => ({ key: format(addDays(monday, dayOffset + 7), "yyyy-MM-dd"), dayOffset }));
}

export function isMondayKey(value: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const [year, month, day] = value.split("-").map(Number);
  const date = new Date(year, month - 1, day, 12);
  return Number.isFinite(date.getTime()) && format(date, "yyyy-MM-dd") === value && date.getDay() === 1;
}
