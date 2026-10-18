import { z } from "zod";

export const notificationPreferencesSchema = z.object({
  studyEnabled: z.boolean(),
  reviewsEnabled: z.boolean(),
  pendingEnabled: z.boolean(),
  dailyReminderTime: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/, "Informe um horário válido."),
  reminderLeadMinutes: z.number().int().min(0).max(1440),
  quietHoursStart: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/).nullable(),
  quietHoursEnd: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/).nullable(),
  browserPushEnabled: z.boolean(),
}).superRefine((value, context) => {
  if ((value.quietHoursStart === null) !== (value.quietHoursEnd === null)) {
    context.addIssue({ code: "custom", message: "Informe o início e o fim do horário de silêncio.", path: ["quietHoursEnd"] });
  }
});

export const notificationMutationSchema = z.discriminatedUnion("action", [
  z.object({ action: z.literal("read"), id: z.string().uuid() }),
  z.object({ action: z.literal("dismiss"), id: z.string().uuid() }),
  z.object({ action: z.literal("read-all") }),
]);

export type NotificationPreferencesInput = z.infer<typeof notificationPreferencesSchema>;
export type NotificationMutation = z.infer<typeof notificationMutationSchema>;
