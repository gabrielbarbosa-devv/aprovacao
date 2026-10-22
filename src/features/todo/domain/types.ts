import type { Tables } from "@/lib/supabase/database.types";

export type TodoList = Tables<"todo_lists">;
export type TodoWorkspace = Tables<"todo_workspaces">;
export type TodoTask = Tables<"todo_tasks">;
export type TodoSubtask = Tables<"todo_subtasks">;
export type TodoLabel = Tables<"todo_labels">;
export type TodoTaskLabel = Tables<"todo_task_labels">;
export type TodoActivityLog = Tables<"todo_activity_logs">;
