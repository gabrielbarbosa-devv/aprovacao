export type TodoSidebarGroup = "main" | "lists" | "workspaces";

export type TodoSidebarPreferences = {
  compact: boolean;
  groups: Record<TodoSidebarGroup, boolean>;
};

export const DEFAULT_TODO_SIDEBAR_PREFERENCES: TodoSidebarPreferences = {
  compact: false,
  groups: { main: true, lists: true, workspaces: true },
};

export function todoSidebarStorageKey(userId: string): string {
  return `todo:sidebar:v1:${userId}`;
}

export function parseTodoSidebarPreferences(raw: string | null): TodoSidebarPreferences {
  if (!raw) return DEFAULT_TODO_SIDEBAR_PREFERENCES;

  try {
    const value: unknown = JSON.parse(raw);
    if (!value || typeof value !== "object") return DEFAULT_TODO_SIDEBAR_PREFERENCES;
    const stored = value as Partial<TodoSidebarPreferences>;
    const groups: Partial<Record<TodoSidebarGroup, boolean>> = stored.groups && typeof stored.groups === "object"
      ? stored.groups
      : {};
    return {
      compact: typeof stored.compact === "boolean" ? stored.compact : false,
      groups: {
        main: typeof groups.main === "boolean" ? groups.main : true,
        lists: typeof groups.lists === "boolean" ? groups.lists : true,
        workspaces: typeof groups.workspaces === "boolean" ? groups.workspaces : true,
      },
    };
  } catch {
    return DEFAULT_TODO_SIDEBAR_PREFERENCES;
  }
}
