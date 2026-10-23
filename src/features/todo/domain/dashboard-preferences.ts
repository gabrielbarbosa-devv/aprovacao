const STORAGE_PREFIX = "todo:overview:expanded:v1";

export function dashboardPreferencesKey(userId: string): string {
  return `${STORAGE_PREFIX}:${userId}`;
}

export function parseExpandedDashboardSections(value: string | null): string[] {
  if (!value) return [];

  try {
    const parsed: unknown = JSON.parse(value);
    if (!Array.isArray(parsed)) return [];
    return [...new Set(parsed.filter((item): item is string => typeof item === "string" && item.length <= 200))];
  } catch {
    return [];
  }
}

export function serializeExpandedDashboardSections(value: string[]): string {
  return JSON.stringify([...new Set(value.filter((item) => item.length <= 200))]);
}
