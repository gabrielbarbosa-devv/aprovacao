import { describe, expect, it } from "vitest";
import { notificationMutationSchema, notificationPreferencesSchema } from "./schemas";

describe("notification preferences", () => {
  const valid = {
    studyEnabled: true,
    reviewsEnabled: false,
    pendingEnabled: false,
    dailyReminderTime: "06:00",
    reminderLeadMinutes: 30,
    quietHoursStart: null,
    quietHoursEnd: null,
    browserPushEnabled: false,
  };

  it("accepts valid saved choices and the suggested time", () => {
    expect(notificationPreferencesSchema.safeParse(valid).success).toBe(true);
  });

  it("rejects invalid reminder times and mismatched quiet-hour pairs", () => {
    expect(notificationPreferencesSchema.safeParse({ ...valid, dailyReminderTime: "25:90" }).success).toBe(false);
    expect(notificationPreferencesSchema.safeParse({ ...valid, quietHoursStart: "22:00" }).success).toBe(false);
    expect(notificationPreferencesSchema.safeParse({ ...valid, reminderLeadMinutes: 1441 }).success).toBe(false);
  });
});

describe("notification mutations", () => {
  it("accepts only supported operations and UUID references", () => {
    expect(notificationMutationSchema.safeParse({ action: "read-all" }).success).toBe(true);
    expect(notificationMutationSchema.safeParse({ action: "dismiss", id: "not-a-uuid" }).success).toBe(false);
    expect(notificationMutationSchema.safeParse({ action: "complete-study", id: "00000000-0000-4000-8000-000000000001" }).success).toBe(false);
  });
});
