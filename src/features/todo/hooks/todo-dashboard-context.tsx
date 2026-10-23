"use client";

import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from "react";
import { useTodoLists, useTodoTasks, useTodoWorkspaces } from "@/features/todo/hooks/use-todo-data";
import type { TodoList, TodoTask, TodoWorkspace } from "@/features/todo/domain/types";

export type TodoDashboardView = "overview" | "today" | "all" | "completed" | "recurring" | "weekly-review" | "lists" | "workspaces" | "list" | "workspace";

type TodoDashboardContextValue = {
  lists: TodoList[];
  tasks: TodoTask[];
  workspaces: TodoWorkspace[];
  loading: boolean;
  refreshing: boolean;
  error: string | null;
  refreshAll: () => Promise<void>;
  view: TodoDashboardView;
  setView: (view: TodoDashboardView) => void;
  selectedListId: string | null;
  setSelectedListId: (id: string | null) => void;
  selectedWorkspaceId: string | null;
  setSelectedWorkspaceId: (id: string | null) => void;
  selectedDate: string | null;
  setSelectedDate: (date: string | null) => void;
};

const TodoDashboardContext = createContext<TodoDashboardContextValue | null>(null);

export function TodoDashboardProvider({ children }: { children: ReactNode }) {
  const [view, setView] = useState<TodoDashboardView>("overview");
  const [selectedListId, setSelectedListId] = useState<string | null>(null);
  const [selectedWorkspaceId, setSelectedWorkspaceId] = useState<string | null>(null);
  const [selectedDate, setSelectedDate] = useState<string | null>(null);
  const listsResource = useTodoLists();
  const tasksResource = useTodoTasks();
  const workspacesResource = useTodoWorkspaces();
  const refreshLists = listsResource.refresh;
  const refreshTasks = tasksResource.refresh;
  const refreshWorkspaces = workspacesResource.refresh;

  const refreshAll = useCallback(async () => {
    await Promise.all([refreshLists(), refreshTasks(), refreshWorkspaces()]);
  }, [refreshLists, refreshTasks, refreshWorkspaces]);

  const value = useMemo<TodoDashboardContextValue>(() => ({
    lists: listsResource.data ?? [],
    tasks: tasksResource.data ?? [],
    workspaces: workspacesResource.data ?? [],
    loading: listsResource.data === null || tasksResource.data === null || workspacesResource.data === null,
    refreshing: listsResource.loading || tasksResource.loading || workspacesResource.loading,
    error: listsResource.error ?? tasksResource.error ?? workspacesResource.error,
    refreshAll,
    view,
    setView,
    selectedListId,
    setSelectedListId,
    selectedWorkspaceId,
    setSelectedWorkspaceId,
    selectedDate,
    setSelectedDate,
  }), [listsResource.data, listsResource.loading, listsResource.error, tasksResource.data, tasksResource.loading, tasksResource.error, workspacesResource.data, workspacesResource.loading, workspacesResource.error, refreshAll, view, selectedListId, selectedWorkspaceId, selectedDate]);

  return <TodoDashboardContext.Provider value={value}>{children}</TodoDashboardContext.Provider>;
}

export function useTodoDashboardData(): TodoDashboardContextValue {
  const context = useContext(TodoDashboardContext);
  if (!context) throw new Error("useTodoDashboardData precisa estar dentro de TodoDashboardProvider.");
  return context;
}
