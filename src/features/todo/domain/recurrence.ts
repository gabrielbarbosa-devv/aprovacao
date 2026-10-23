import { addDays, addMonths, format, getDate, getDay, getDaysInMonth, getMonth, getYear, lastDayOfMonth, setDate, startOfDay } from "date-fns";
import { z } from "zod";

const date = z.iso.date();
const timezone = z.string().trim().min(1).max(80).refine((value) => {
  try { new Intl.DateTimeFormat("en", { timeZone: value }); return true; } catch { return false; }
}, "Selecione um fuso horário válido.");

export const todoRecurrenceConfigSchema = z.object({
  frequency: z.enum(["daily", "weekdays", "weekly", "monthly", "yearly", "custom"]),
  interval: z.number().int().min(1).max(366),
  weekdays: z.array(z.number().int().min(0).max(6)).max(7),
  monthlyMode: z.enum(["day", "last_day", "nth_weekday"]),
  monthDay: z.number().int().min(1).max(31),
  monthWeek: z.enum(["first", "last"]),
  monthWeekday: z.number().int().min(0).max(6),
  annualMonth: z.number().int().min(1).max(12),
  annualDay: z.number().int().min(1).max(31),
  customUnit: z.enum(["day", "week", "month", "year"]),
  startsOn: date,
  timeOfDay: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/).nullable(),
  endsOn: date.nullable(),
  maxOccurrences: z.number().int().min(1).max(10000).nullable(),
  timezone,
  scheduleBasis: z.enum(["planned", "completion"]),
}).strict().superRefine((value, context) => {
  if (value.endsOn && value.endsOn < value.startsOn) context.addIssue({ code: "custom", path: ["endsOn"], message: "A data final não pode ser anterior ao início." });
  if (new Set(value.weekdays).size !== value.weekdays.length) context.addIssue({ code: "custom", path: ["weekdays"], message: "Remova dias repetidos da regra." });
  if (value.frequency === "weekdays" && value.interval !== 1) context.addIssue({ code: "custom", path: ["interval"], message: "Dias úteis se repetem de segunda a sexta toda semana." });
  if (value.scheduleBasis === "completion" && (value.frequency === "weekdays" || value.weekdays.length > 0)) context.addIssue({ code: "custom", path: ["scheduleBasis"], message: "A base pela conclusão não combina com dias da semana selecionados." });
});

export type TodoRecurrenceConfig = z.infer<typeof todoRecurrenceConfigSchema>;

export const defaultTodoRecurrenceConfig = (startsOn: string, timezoneValue = Intl.DateTimeFormat().resolvedOptions().timeZone): TodoRecurrenceConfig => ({
  frequency: "daily", interval: 1, weekdays: [], monthlyMode: "day", monthDay: 1, monthWeek: "first", monthWeekday: 1,
  annualMonth: 1, annualDay: 1, customUnit: "week", startsOn, timeOfDay: null, endsOn: null, maxOccurrences: null,
  timezone: timezoneValue || "UTC", scheduleBasis: "planned",
});

function isoDate(dateValue: Date): string { return format(dateValue, "yyyy-MM-dd"); }
function isMonthMatch(candidate: Date, config: TodoRecurrenceConfig): boolean {
  const months = (getYear(candidate) - getYear(dateFromIso(config.startsOn))) * 12 + getMonth(candidate) - getMonth(dateFromIso(config.startsOn));
  if (months < 0 || months % config.interval !== 0) return false;
  if (config.monthlyMode === "last_day") return getDate(candidate) === getDaysInMonth(candidate);
  if (config.monthlyMode === "day") return getDate(candidate) === config.monthDay;
  if (getDay(candidate) !== config.monthWeekday) return false;
  if (config.monthWeek === "first") return getDate(candidate) <= 7;
  return getDate(candidate) + 7 > getDaysInMonth(candidate);
}
function isYearMatch(candidate: Date, config: TodoRecurrenceConfig): boolean {
  const start = dateFromIso(config.startsOn);
  return (getYear(candidate) - getYear(start)) % config.interval === 0 && getMonth(candidate) + 1 === config.annualMonth && getDate(candidate) === config.annualDay;
}
function matches(candidate: Date, config: TodoRecurrenceConfig): boolean {
  const start = dateFromIso(config.startsOn);
  const dayOffset = Math.round((startOfDay(candidate).getTime() - startOfDay(start).getTime()) / 86_400_000);
  if (dayOffset < 0) return false;
  const day = getDay(candidate);
  switch (config.frequency) {
    case "daily": return dayOffset % config.interval === 0;
    case "weekdays": return day >= 1 && day <= 5;
    case "weekly": return Math.floor(dayOffset / 7) % config.interval === 0 && (config.weekdays.length ? config.weekdays.includes(day) : day === getDay(start));
    case "monthly": return isMonthMatch(candidate, config);
    case "yearly": return isYearMatch(candidate, config);
    case "custom":
      if (config.customUnit === "day") return dayOffset % config.interval === 0;
      if (config.customUnit === "week") return Math.floor(dayOffset / 7) % config.interval === 0 && (config.weekdays.length ? config.weekdays.includes(day) : day === getDay(start));
      if (config.customUnit === "month") return isMonthMatch(candidate, config);
      return isYearMatch(candidate, config);
  }
}

function dateFromIso(value: string): Date {
  const [year, month, day] = value.split("-").map(Number);
  return new Date(year, month - 1, day);
}

export function previewTodoOccurrences(config: TodoRecurrenceConfig, count = 5): string[] {
  const parsed = todoRecurrenceConfigSchema.safeParse(config);
  if (!parsed.success || count <= 0) return [];
  const result: string[] = [];
  const starts = dateFromIso(config.startsOn);
  const maxDays = 366 * 100;
  for (let offset = 0; offset <= maxDays && result.length < count; offset += 1) {
    const candidate = addDays(starts, offset);
    const dateKey = isoDate(candidate);
    if (config.endsOn && dateKey > config.endsOn) break;
    if (config.maxOccurrences !== null && result.length >= config.maxOccurrences) break;
    if (matches(candidate, config)) result.push(dateKey);
  }
  return result;
}

export function nextCompletionBasedDate(config: TodoRecurrenceConfig, completedOn: string): string | null {
  const start = dateFromIso(completedOn);
  const unit = config.frequency === "custom" ? config.customUnit : config.frequency;
  const interval = config.interval;
  let next: Date | null = null;
  if (unit === "daily" || unit === "day") next = addDays(start, interval);
  else if (unit === "weekly" || unit === "week") next = addDays(start, interval * 7);
  else if (unit === "monthly" || unit === "month") {
    const firstTarget = new Date(getYear(start), getMonth(start), 1);
    for (let offset = interval; offset <= interval * 120; offset += interval) {
      const month = addMonths(firstTarget, offset);
      const days = getDaysInMonth(month);
      let day: number | null = null;
      if (config.monthlyMode === "last_day") day = days;
      else if (config.monthlyMode === "day") day = config.monthDay <= days ? config.monthDay : null;
      else {
        const first = new Date(getYear(month), getMonth(month), 1);
        const last = lastDayOfMonth(month);
        day = config.monthWeek === "first"
          ? 1 + ((config.monthWeekday - getDay(first) + 7) % 7)
          : days - ((getDay(last) - config.monthWeekday + 7) % 7);
      }
      if (day !== null) { next = setDate(month, day); break; }
    }
  } else if (unit === "yearly" || unit === "year") {
    for (let offset = interval; offset <= interval * 400; offset += interval) {
      const year = getYear(start) + offset;
      const month = new Date(year, config.annualMonth - 1, 1);
      if (config.annualDay <= getDaysInMonth(month)) { next = setDate(month, config.annualDay); break; }
    }
  }
  if (!next) return null;
  const nextKey = isoDate(next);
  return config.endsOn && nextKey > config.endsOn ? null : nextKey;
}
