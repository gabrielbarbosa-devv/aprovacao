import "server-only";
import { requireUser } from "@/lib/auth/require-user";
import type { TablesUpdate } from "@/lib/supabase/database.types";
import type { Tables } from "@/lib/supabase/database.types";
import type {
  TodoLabelInput, TodoLabelUpdate, TodoListInput, TodoListUpdate,
  TodoSubtaskInput, TodoSubtaskUpdate, TodoTaskInput, TodoTaskLabelInput,
  TodoTaskUpdate, TodoWorkspaceInput, TodoWorkspaceUpdate,
} from "@/features/todo/domain/schemas";

async function context() {
  return requireUser();
}

function throwOnError(error: { message: string } | null): void {
  if (error) throw new Error(error.message);
}

export const todoListsService = {
  async list() {
    const { user, supabase } = await context();
    const { data, error } = await supabase.from("todo_lists").select("*").eq("user_id", user.id).order("position").order("name");
    throwOnError(error);
    return data ?? [];
  },
  async initialize() {
    const { data, error } = await (await context()).supabase.rpc("initialize_todo_lists");
    throwOnError(error);
    return data ?? [];
  },
  async create(input: TodoListInput) {
    const { user, supabase } = await context();
    const { data, error } = await supabase.from("todo_lists").insert({ ...input, user_id: user.id }).select("*").single();
    throwOnError(error);
    return data;
  },
  async update(input: TodoListUpdate) {
    const { user, supabase } = await context();
    const { id, ...fields } = input;
    const { data, error } = await supabase.from("todo_lists").update(fields).eq("id", id).eq("user_id", user.id).select("*").single();
    throwOnError(error);
    return data;
  },
  async delete(id: string) {
    const { user, supabase } = await context();
    const { error } = await supabase.from("todo_lists").delete().eq("id", id).eq("user_id", user.id);
    throwOnError(error);
  },
};

export const todoWorkspacesService = {
  async list() {
    const { user, supabase } = await context();
    const { data, error } = await supabase.from("todo_workspaces").select("*").eq("user_id", user.id).order("created_at", { ascending: true });
    throwOnError(error);
    return data ?? [];
  },
  async create(input: TodoWorkspaceInput) {
    const { user, supabase } = await context();
    const { data, error } = await supabase.from("todo_workspaces").insert({ ...input, user_id: user.id }).select("*").single();
    throwOnError(error);
    return data;
  },
  async update(input: TodoWorkspaceUpdate) {
    const { user, supabase } = await context();
    const { id, ...fields } = input;
    const { data, error } = await supabase.from("todo_workspaces").update(fields).eq("id", id).eq("user_id", user.id).select("*").single();
    throwOnError(error);
    return data;
  },
  async delete(id: string) {
    const { user, supabase } = await context();
    const { error } = await supabase.from("todo_workspaces").delete().eq("id", id).eq("user_id", user.id);
    throwOnError(error);
  },
};

export const todoTasksService = {
  async list(options?: { listId?: string; workspaceId?: string; status?: TodoTaskInput["status"]; includeDeleted?: boolean }) {
    const { user, supabase } = await context();
    const pageSize = 500;
    const allRows: Tables<"todo_tasks">[] = [];
    let offset = 0;
    while (true) {
      let query = supabase.from("todo_tasks").select("*").eq("user_id", user.id).order("position").order("created_at").order("id").range(offset, offset + pageSize - 1);
      if (!options?.includeDeleted) query = query.is("deleted_at", null);
      if (options?.listId) query = query.eq("list_id", options.listId);
      if (options?.workspaceId) query = query.eq("workspace_id", options.workspaceId);
      if (options?.status) query = query.eq("status", options.status);
      const { data, error } = await query;
      throwOnError(error);
      const page = data ?? [];
      allRows.push(...page);
      if (page.length < pageSize) return allRows;
      offset += pageSize;
    }
  },
  async create(input: TodoTaskInput) {
    const { user, supabase } = await context();
    const status = input.status ?? "todo";
    const { data, error } = await supabase.from("todo_tasks").insert({
      user_id: user.id,
      list_id: input.listId,
      workspace_id: input.workspaceId ?? null,
      title: input.title,
      description: input.description ?? null,
      status,
      priority: input.priority ?? "medium",
      starts_on: input.startsOn,
      due_on: input.dueOn ?? null,
      due_at: input.dueAt ?? null,
      completed_at: status === "done" ? new Date().toISOString() : null,
      position: input.position ?? 0,
    }).select("*").single();
    throwOnError(error);
    return data;
  },
  async update(input: TodoTaskUpdate) {
    const { user, supabase } = await context();
    const { id, ...fields } = input;
    const update: TablesUpdate<"todo_tasks"> = {};
    if (fields.listId !== undefined) update.list_id = fields.listId;
    if (fields.workspaceId !== undefined) update.workspace_id = fields.workspaceId;
    if (fields.title !== undefined) update.title = fields.title;
    if (fields.description !== undefined) update.description = fields.description;
    if (fields.status !== undefined) {
      update.status = fields.status;
      update.completed_at = fields.status === "done" ? new Date().toISOString() : null;
    }
    if (fields.priority !== undefined) update.priority = fields.priority;
    if (fields.startsOn !== undefined) update.starts_on = fields.startsOn;
    if (fields.dueOn !== undefined) update.due_on = fields.dueOn;
    if (fields.dueAt !== undefined) update.due_at = fields.dueAt;
    if (fields.position !== undefined) update.position = fields.position;
    const { data, error } = await supabase.from("todo_tasks").update(update).eq("id", id).eq("user_id", user.id).is("deleted_at", null).select("*").single();
    throwOnError(error);
    return data;
  },
  async softDelete(id: string) {
    const { user, supabase } = await context();
    const { error } = await supabase.from("todo_tasks").update({ deleted_at: new Date().toISOString() }).eq("id", id).eq("user_id", user.id).is("deleted_at", null);
    throwOnError(error);
  },
  async restore(id: string) {
    const { user, supabase } = await context();
    const { data, error } = await supabase.from("todo_tasks").update({ deleted_at: null }).eq("id", id).eq("user_id", user.id).not("deleted_at", "is", null).select("*").single();
    throwOnError(error);
    return data;
  },
};

export const todoSubtasksService = {
  async list(taskId: string) {
    const { user, supabase } = await context();
    const { data, error } = await supabase.from("todo_subtasks").select("*").eq("user_id", user.id).eq("task_id", taskId).order("position");
    throwOnError(error);
    return data ?? [];
  },
  async create(input: TodoSubtaskInput) {
    const { user, supabase } = await context();
    const { data, error } = await supabase.from("todo_subtasks").insert({ user_id: user.id, task_id: input.taskId, title: input.title, position: input.position ?? 0 }).select("*").single();
    throwOnError(error);
    return data;
  },
  async update(input: TodoSubtaskUpdate) {
    const { user, supabase } = await context();
    const { id, isCompleted, ...fields } = input;
    const update = { ...fields, ...(isCompleted === undefined ? {} : { is_completed: isCompleted }) };
    const { data, error } = await supabase.from("todo_subtasks").update(update).eq("id", id).eq("user_id", user.id).select("*").single();
    throwOnError(error);
    return data;
  },
  async delete(id: string) {
    const { user, supabase } = await context();
    const { error } = await supabase.from("todo_subtasks").delete().eq("id", id).eq("user_id", user.id);
    throwOnError(error);
  },
};

export const todoLabelsService = {
  async list() {
    const { user, supabase } = await context();
    const { data, error } = await supabase.from("todo_labels").select("*").eq("user_id", user.id).order("name");
    throwOnError(error);
    return data ?? [];
  },
  async create(input: TodoLabelInput) {
    const { user, supabase } = await context();
    const { data, error } = await supabase.from("todo_labels").insert({ ...input, user_id: user.id }).select("*").single();
    throwOnError(error);
    return data;
  },
  async update(input: TodoLabelUpdate) {
    const { user, supabase } = await context();
    const { id, ...fields } = input;
    const { data, error } = await supabase.from("todo_labels").update(fields).eq("id", id).eq("user_id", user.id).select("*").single();
    throwOnError(error);
    return data;
  },
  async delete(id: string) {
    const { user, supabase } = await context();
    const { error } = await supabase.from("todo_labels").delete().eq("id", id).eq("user_id", user.id);
    throwOnError(error);
  },
};

export const todoTaskLabelsService = {
  async list(taskId: string) {
    const { user, supabase } = await context();
    const { data, error } = await supabase.from("todo_task_labels").select("*").eq("user_id", user.id).eq("task_id", taskId);
    throwOnError(error);
    return data ?? [];
  },
  async attach(input: TodoTaskLabelInput) {
    const { user, supabase } = await context();
    const { data, error } = await supabase.from("todo_task_labels").upsert({ user_id: user.id, task_id: input.taskId, label_id: input.labelId }, { onConflict: "user_id,task_id,label_id", ignoreDuplicates: true }).select("*").maybeSingle();
    throwOnError(error);
    return data;
  },
  async detach(input: TodoTaskLabelInput) {
    const { user, supabase } = await context();
    const { error } = await supabase.from("todo_task_labels").delete().eq("user_id", user.id).eq("task_id", input.taskId).eq("label_id", input.labelId);
    throwOnError(error);
  },
};

export const todoActivityService = {
  async list(taskId: string) {
    const { user, supabase } = await context();
    const { data, error } = await supabase.from("todo_activity_logs").select("*").eq("user_id", user.id).eq("task_id", taskId).order("created_at", { ascending: false });
    throwOnError(error);
    return data ?? [];
  },
};
