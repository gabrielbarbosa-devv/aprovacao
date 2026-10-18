import { z } from "zod";
import type { Json } from "@/lib/supabase/database.types";

export const WEEKDAY_OPTIONS = [
  { value: 1, label: "Seg", fullLabel: "Segunda-feira" },
  { value: 2, label: "Ter", fullLabel: "Terça-feira" },
  { value: 3, label: "Qua", fullLabel: "Quarta-feira" },
  { value: 4, label: "Qui", fullLabel: "Quinta-feira" },
  { value: 5, label: "Sex", fullLabel: "Sexta-feira" },
  { value: 6, label: "Sáb", fullLabel: "Sábado" },
  { value: 0, label: "Dom", fullLabel: "Domingo" },
] as const;

export const settingsSchema = z.object({
  dailyGoalMinutes: z.number().int().min(15, "A meta mínima é de 15 minutos.").max(960, "A meta máxima é de 16 horas.").multipleOf(15, "Use intervalos de 15 minutos."),
  timezone: z.string().trim().min(1, "Informe um fuso horário.").max(100, "Fuso horário inválido."),
  weekdays: z.array(z.number().int().min(0).max(6)).min(1, "Escolha pelo menos um dia da semana.").max(7),
}).superRefine(({ weekdays }, context) => {
  if (new Set(weekdays).size !== weekdays.length) context.addIssue({ code: "custom", path: ["weekdays"], message: "Há dias repetidos." });
});

export type StudyPreferences = z.infer<typeof settingsSchema>;

export function parseWeekdays(value: Json): number[] {
  if (typeof value === "object" && value !== null && !Array.isArray(value) && "days" in value) {
    const days = value.days;
    if (Array.isArray(days)) {
      const valid = days.filter((day): day is number => typeof day === "number" && Number.isInteger(day) && day >= 0 && day <= 6);
      if (valid.length > 0) return [...new Set(valid)];
    }
  }
  // An unset weekly preference means all days are available, matching the default routine.
  return WEEKDAY_OPTIONS.map(({ value: day }) => day);
}

export function serializeWeekdays(days: number[]): Json {
  return { days: [...new Set(days)].sort((a, b) => a - b) };
}

export function isValidTimezone(value: string): boolean {
  try {
    new Intl.DateTimeFormat("en-US", { timeZone: value }).format(new Date(0));
    return true;
  } catch {
    return false;
  }
}

export function protectCsvFormula(value: string): string {
  return /^[=+\-@\t\r]/.test(value) ? `'${value}` : value;
}

export function encodeCsvCell(value: string | number | boolean | null): string {
  if (value === null) return "";
  if (typeof value === "number" || typeof value === "boolean") return String(value);
  const safe = protectCsvFormula(value);
  return `"${safe.replaceAll('"', '""')}"`;
}

export function encodeCsv(rows: Array<Array<string | number | boolean | null>>): string {
  return `\uFEFF${rows.map((row) => row.map(encodeCsvCell).join(",")).join("\r\n")}`;
}
