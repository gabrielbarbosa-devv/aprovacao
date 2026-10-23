import { describe, expect, it } from "vitest";
import {
  DEFAULT_TODO_SIDEBAR_PREFERENCES,
  parseTodoSidebarPreferences,
  todoSidebarStorageKey,
} from "./sidebar-preferences";

describe("To-Do sidebar preferences", () => {
  it("scopes storage to the To-Do module and user", () => {
    expect(todoSidebarStorageKey("user-123")).toBe("todo:sidebar:v1:user-123");
  });

  it("uses safe defaults for absent or invalid preferences", () => {
    expect(parseTodoSidebarPreferences(null)).toEqual(DEFAULT_TODO_SIDEBAR_PREFERENCES);
    expect(parseTodoSidebarPreferences("invalid")).toEqual(DEFAULT_TODO_SIDEBAR_PREFERENCES);
  });

  it("restores each independently collapsed group and compact mode", () => {
    expect(parseTodoSidebarPreferences(JSON.stringify({
      compact: true,
      groups: { main: false, lists: true, workspaces: false },
    }))).toEqual({
      compact: true,
      groups: { main: false, lists: true, workspaces: false },
    });
  });

  it("repairs partially saved preferences without losing valid settings", () => {
    expect(parseTodoSidebarPreferences(JSON.stringify({ compact: true, groups: { lists: false } }))).toEqual({
      compact: true,
      groups: { main: true, lists: false, workspaces: true },
    });
  });
});
