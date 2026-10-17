const STUDY_DAY_FORMAT = new Intl.DateTimeFormat("en-CA", {
  timeZone: "UTC",
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
});

export function getStudyDay(timeZone: string, now = new Date()): string {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(now);
  const values = Object.fromEntries(parts.map(({ type, value }) => [type, value]));

  return `${values.year}-${values.month}-${values.day}`;
}

export function addStudyDays(studyDay: string, days: number): string {
  const [year, month, day] = studyDay.split("-").map(Number);
  const date = new Date(Date.UTC(year, month - 1, day + days));
  return STUDY_DAY_FORMAT.format(date);
}

export function formatStudyDate(studyDay: string, style: "long" | "short") {
  const [year, month, day] = studyDay.split("-").map(Number);
  const date = new Date(Date.UTC(year, month - 1, day, 12));
  const formatter = new Intl.DateTimeFormat("pt-BR", {
    timeZone: "UTC",
    ...(style === "long"
      ? { weekday: "long", day: "numeric", month: "long", year: "numeric" }
      : { day: "numeric", month: "long" }),
  });
  const value = formatter.format(date);
  return value.charAt(0).toLocaleUpperCase("pt-BR") + value.slice(1);
}
