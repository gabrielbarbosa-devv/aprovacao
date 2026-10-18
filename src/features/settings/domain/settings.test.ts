import { describe, expect, it } from "vitest";
import { encodeCsv, isValidTimezone, parseWeekdays, protectCsvFormula, serializeWeekdays, settingsSchema } from "./settings";

describe("settings domain", () => {
  it("uses the existing weekly JSON preference and defaults an unset profile to all days", () => {
    expect(parseWeekdays({})).toEqual([1, 2, 3, 4, 5, 6, 0]);
    expect(parseWeekdays({ days: [1, 3, 3, 8, "2"] })).toEqual([1, 3]);
    expect(serializeWeekdays([1, 3])).toEqual({ days: [1, 3] });
  });

  it("validates usable minutes, unique days and IANA timezones", () => {
    expect(settingsSchema.safeParse({ dailyGoalMinutes: 180, timezone: "America/Sao_Paulo", weekdays: [1, 2, 3, 4, 5] }).success).toBe(true);
    expect(settingsSchema.safeParse({ dailyGoalMinutes: -1, timezone: "Bad/Zone", weekdays: [] }).success).toBe(false);
    expect(isValidTimezone("America/Sao_Paulo")).toBe(true);
    expect(isValidTimezone("Not/A_Timezone")).toBe(false);
  });

  it("protects formula-like CSV text and preserves Portuguese and CSV syntax", () => {
    expect(protectCsvFormula("=SOMA(A1:A2)")).toBe("'=SOMA(A1:A2)");
    expect(protectCsvFormula("+cmd")).toBe("'+cmd");
    expect(protectCsvFormula("-HYPERLINK(x)")).toBe("'-HYPERLINK(x)");
    expect(protectCsvFormula("@calc")).toBe("'@calc");
    expect(encodeCsv([["Matéria", "Observação"], ["Português", "=1+1; disse \"não\"\nreforçar"]])).toBe('\uFEFF"Matéria","Observação"\r\n"Português","\'=1+1; disse ""não""\nreforçar"');
    expect(encodeCsv([["\t=1"]])).toBe('\uFEFF"\'\t=1"');
  });
});
