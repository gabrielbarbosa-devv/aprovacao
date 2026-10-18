export type NotificationCategory = "study" | "review" | "pending";

export type NotificationItem = {
  id: string;
  category: NotificationCategory;
  title: string;
  body: string;
  target_url: string;
  scheduled_for: string;
  created_at: string;
  read_at: string | null;
};

export const NOTIFICATION_CATEGORY_LABELS: Record<NotificationCategory, string> = {
  study: "Estudo",
  review: "Revisão",
  pending: "Pendência",
};
