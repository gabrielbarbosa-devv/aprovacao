"use client";

import { useCallback } from "react";
import {
  loadTodoActivityAction, loadTodoLabelsAction, loadTodoListsAction, loadTodoRecentActivityAction, loadTodoSubtasksAction, loadTodoTaskLabelsForTasksAction,
  loadTodoTaskLabelsAction, loadTodoTasksAction, loadTodoWorkspacesAction,
} from "@/features/todo/actions";
import { useTodoResource } from "@/features/todo/hooks/use-todo-resource";

export function useTodoLists() {
  // initialize_todo_lists is an idempotent database operation; simultaneous entry is safe.
  return useTodoResource(loadTodoListsAction);
}

export function useTodoWorkspaces() {
  return useTodoResource(loadTodoWorkspacesAction);
}

export function useTodoTasks(filters: { listId?: string; workspaceId?: string; status?: "todo" | "in_progress" | "done"; includeDeleted?: boolean } = {}) {
  const { listId, workspaceId, status, includeDeleted } = filters;
  const loader = useCallback(() => loadTodoTasksAction({ listId, workspaceId, status, includeDeleted }), [listId, workspaceId, status, includeDeleted]);
  return useTodoResource(loader);
}

export function useTodoSubtasks(taskId: string) {
  const loader = useCallback(() => loadTodoSubtasksAction({ taskId }), [taskId]);
  return useTodoResource(loader);
}

export function useTodoLabels() {
  return useTodoResource(loadTodoLabelsAction);
}

export function useTodoTaskLabels(taskId: string) {
  const loader = useCallback(() => loadTodoTaskLabelsAction({ taskId }), [taskId]);
  return useTodoResource(loader);
}

export function useTodoLabelsForTasks(taskIds: string[]) {
  const key = taskIds.join(",");
  const loader = useCallback(() => loadTodoTaskLabelsForTasksAction({ taskIds: key ? key.split(",") : [] }), [key]);
  return useTodoResource(loader);
}

export function useTodoActivity(taskId: string) {
  const loader = useCallback(() => loadTodoActivityAction({ taskId }), [taskId]);
  return useTodoResource(loader);
}

export function useTodoRecentActivity() {
  return useTodoResource(loadTodoRecentActivityAction);
}
