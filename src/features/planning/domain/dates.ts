import { addStudyDays } from "../../../lib/date/study-day";

export function getWeekStart(date: string): string {
  const [year, month, day] = date.split("-").map(Number);
  const value = new Date(Date.UTC(year, month - 1, day, 12));
  return addStudyDays(date, -value.getUTCDay());
}

export function isStudyDate(value: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const [year, month, day] = value.split("-").map(Number);
  const date = new Date(Date.UTC(year, month - 1, day));
  return date.getUTCFullYear() === year && date.getUTCMonth() === month - 1 && date.getUTCDate() === day;
}

export function formatWeekRange(start: string, end: string): string {
  const [startYear, startMonth, startDay] = start.split("-").map(Number);
  const [endYear, endMonth, endDay] = end.split("-").map(Number);
  const a = new Date(Date.UTC(startYear, startMonth - 1, startDay, 12));
  const b = new Date(Date.UTC(endYear, endMonth - 1, endDay, 12));
  const left = new Intl.DateTimeFormat("pt-BR", { day: "numeric", month: "long" }).format(a);
  const right = new Intl.DateTimeFormat("pt-BR", { day: "numeric", month: "long", year: "numeric" }).format(b);
  const title = `${left}–${right}`;
  return title.charAt(0).toLocaleUpperCase("pt-BR") + title.slice(1);
}

export function formatWeekday(date: string): string {
  const [year, month, day] = date.split("-").map(Number);
  return new Intl.DateTimeFormat("pt-BR", { weekday: "short", timeZone: "UTC" })
    .format(new Date(Date.UTC(year, month - 1, day, 12))).replace(".", "");
}

export function formatShortDate(date: string): string {
  const [year, month, day] = date.split("-").map(Number);
  return new Intl.DateTimeFormat("pt-BR", { day: "numeric", month: "short", timeZone: "UTC" })
    .format(new Date(Date.UTC(year, month - 1, day, 12))).replace(".", "");
}
