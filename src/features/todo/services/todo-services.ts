import "server-only";
import { requireUser } from "@/lib/auth/require-user";
import type { TablesUpdate } from "@/lib/supabase/database.types";
import type { Tables } from "@/lib/supabase/database.types";
import type { TodoRecurrenceConfig } from "@/features/todo/domain/recurrence";
import type {
  TodoLabelInput, TodoLabelUpdate, TodoListInput, TodoListUpdate,
  TodoSubtaskInput, TodoSubtaskUpdate, TodoTaskInput, TodoTaskLabelInput,
  TodoTaskUpdate, TodoTaskBundle, TodoTaskDetails, TodoWorkspaceInput, TodoWorkspaceUpdate,
} from "@/features/todo/domain/schemas";

async function context() {
  return requireUser();
}

function recurrenceConfigFromRule(rule: Tables<"todo_recurrence_rules">): TodoRecurrenceConfig {
  return {
    frequency: rule.frequency as TodoRecurrenceConfig["frequency"], interval: rule.interval_count, weekdays: rule.weekdays,
    monthlyMode: rule.monthly_mode as TodoRecurrenceConfig["monthlyMode"], monthDay: rule.month_day,
    monthWeek: rule.month_week as TodoRecurrenceConfig["monthWeek"], monthWeekday: rule.month_weekday,
    annualMonth: rule.annual_month, annualDay: rule.annual_day, customUnit: rule.custom_unit as TodoRecurrenceConfig["customUnit"],
    startsOn: rule.starts_on, timeOfDay: rule.time_of_day?.slice(0, 5) ?? null, endsOn: rule.ends_on,
    maxOccurrences: rule.max_occurrences, timezone: rule.timezone, scheduleBasis: rule.schedule_basis as TodoRecurrenceConfig["scheduleBasis"],
  };
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
  async deleteWithTransfer(id: string, targetListId: string | null) {
    const { data, error } = await (await context()).supabase.rpc("delete_todo_list_with_transfer", { p_list_id: id, p_target_list_id: targetListId });
    throwOnError(error);
    return data;
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
  async deleteWithTaskPolicy(id: string, taskPolicy: "keep_tasks" | "soft_delete_tasks") {
    const { data, error } = await (await context()).supabase.rpc("delete_todo_workspace_with_task_policy", {
      p_workspace_id: id,
      p_task_policy: taskPolicy,
    });
    throwOnError(error);
    return data ?? 0;
  },
};

export const todoTasksService = {
  async getDetails(taskId: string) {
    const { user, supabase } = await context();
    const { data: task, error } = await supabase.from("todo_tasks").select("*").eq("id", taskId).eq("user_id", user.id).maybeSingle();
    throwOnError(error);
    if (!task) return null;
    const [subtasks, taskLabels, labels, activity, list, workspace, recurrenceResult] = await Promise.all([
      supabase.from("todo_subtasks").select("*").eq("user_id", user.id).eq("task_id", taskId).order("position"),
      supabase.from("todo_task_labels").select("*").eq("user_id", user.id).eq("task_id", taskId),
      supabase.from("todo_labels").select("*").eq("user_id", user.id).order("name"),
      supabase.from("todo_activity_logs").select("*").eq("user_id", user.id).eq("task_id", taskId).order("created_at", { ascending: false }).limit(100),
      supabase.from("todo_lists").select("*").eq("id", task.list_id).eq("user_id", user.id).maybeSingle(),
      task.workspace_id ? supabase.from("todo_workspaces").select("*").eq("id", task.workspace_id).eq("user_id", user.id).maybeSingle() : Promise.resolve({ data: null, error: null }),
      task.recurrence_rule_id ? supabase.from("todo_recurrence_rules").select("*").eq("id", task.recurrence_rule_id).eq("user_id", user.id).maybeSingle() : Promise.resolve({ data: null, error: null }),
    ]);
    for (const result of [subtasks, taskLabels, labels, activity, list, workspace, recurrenceResult]) throwOnError(result.error);
    return { task, subtasks: subtasks.data ?? [], taskLabels: taskLabels.data ?? [], labels: labels.data ?? [], activity: activity.data ?? [], list: list.data, workspace: workspace.data, recurrence: recurrenceResult.data ? { rule: recurrenceResult.data, config: recurrenceConfigFromRule(recurrenceResult.data) } : null };
  },
  async saveBundle(input: TodoTaskBundle) {
    const args = {
      p_task_id: input.id ?? null,
      p_list_id: input.listId,
      p_workspace_id: input.workspaceId ?? null,
      p_title: input.title,
      p_description: input.description ?? null,
      p_priority: input.priority,
      p_starts_on: input.startsOn,
      p_due_on: input.dueOn,
      p_due_at: input.dueAt,
      p_label_ids: input.labelIds,
      p_new_labels: input.newLabels,
      p_subtasks: input.subtasks.map((subtask) => ({ id: subtask.id, title: subtask.title, is_completed: subtask.isCompleted })),
    };
    const supabase = (await context()).supabase;
    const result = input.recurrence
      ? await supabase.rpc("save_todo_task_with_recurrence", { ...args, p_recurrence: input.recurrence as unknown as import("@/lib/supabase/database.types").Json })
      : await supabase.rpc("save_todo_task_bundle", args);
    const { data, error } = result;
    throwOnError(error);
    return data;
  },
  async saveDetails(input: TodoTaskDetails) {
    const args = {
      p_task_id: input.id,
      p_list_id: input.listId,
      p_workspace_id: input.workspaceId ?? null,
      p_title: input.title,
      p_description: input.description ?? null,
      p_priority: input.priority,
      p_starts_on: input.startsOn,
      p_due_on: input.dueOn,
      p_due_at: input.dueAt,
      p_label_ids: input.labelIds,
      p_new_labels: input.newLabels,
      p_subtasks: input.subtasks.map((subtask) => ({ id: subtask.id, title: subtask.title, is_completed: subtask.isCompleted })),
      p_status: input.status,
      p_expected_updated_at: input.expectedUpdatedAt,
    };
    const supabase = (await context()).supabase;
    const result = input.recurrence !== undefined
      ? await supabase.rpc("save_todo_task_details_with_recurrence_if_unchanged", { ...args, p_recurrence: input.recurrence as unknown as import("@/lib/supabase/database.types").Json | null, p_recurrence_scope: input.recurrenceScope })
      : await supabase.rpc("save_todo_task_details_if_unchanged", args);
    const { data, error } = result;
    throwOnError(error);
    return data;
  },
  async list(options?: { listId?: string; workspaceId?: string; status?: TodoTaskInput["status"]; includeDeleted?: boolean; lifecycle?: "active" | "archived" | "trash" | "any" }) {
    const { user, supabase } = await context();
    const lifecycle = options?.lifecycle ?? (options?.includeDeleted ? "any" : "active");
    if (lifecycle === "active") {
      const { error: recurrenceError } = await supabase.rpc("ensure_todo_recurrence_occurrences", { p_days_ahead: 45 });
      throwOnError(recurrenceError);
    }
    const pageSize = 500;
    const allRows: Tables<"todo_tasks">[] = [];
    let offset = 0;
    while (true) {
      let query = supabase.from("todo_tasks").select("*").eq("user_id", user.id).order("position").order("created_at").order("id").range(offset, offset + pageSize - 1);
      if (lifecycle === "active") query = query.is("deleted_at", null).is("archived_at", null);
      if (lifecycle === "archived") query = query.is("deleted_at", null).not("archived_at", "is", null);
      if (lifecycle === "trash") query = query.not("deleted_at", "is", null);
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
    const { data, error } = await supabase.from("todo_tasks").update(update).eq("id", id).eq("user_id", user.id).is("deleted_at", null).is("archived_at", null).select("*").single();
    throwOnError(error);
    return data;
  },
  async reorder(input: { listId: string; lane: "pending" | "done"; taskIds: string[] }) {
    const { data, error } = await (await context()).supabase.rpc("reorder_todo_task_positions", {
      p_list_id: input.listId,
      p_lane: input.lane,
      p_task_ids: input.taskIds,
    });
    throwOnError(error);
    return data ?? [];
  },
  async archive(id: string) {
    const { user, supabase } = await context();
    const { data, error } = await supabase.from("todo_tasks").update({ archived_at: new Date().toISOString() }).eq("id", id).eq("user_id", user.id).is("deleted_at", null).is("archived_at", null).select("id").maybeSingle();
    throwOnError(error);
    if (!data) throw new Error("Task not available to archive");
  },
  async moveToTrash(id: string) {
    const { user, supabase } = await context();
    const { data, error } = await supabase.from("todo_tasks").update({ deleted_at: new Date().toISOString() }).eq("id", id).eq("user_id", user.id).is("deleted_at", null).select("id").maybeSingle();
    throwOnError(error);
    if (!data) throw new Error("Task not available to move to trash");
  },
  async restore(id: string) {
    const { user, supabase } = await context();
    const { data, error } = await supabase.from("todo_tasks").update({ deleted_at: null, archived_at: null }).eq("id", id).eq("user_id", user.id).or("deleted_at.not.is.null,archived_at.not.is.null").select("*").single();
    throwOnError(error);
    return data;
  },
  async deletePermanently(id: string) {
    const { user, supabase } = await context();
    const { data, error } = await supabase.from("todo_tasks").delete().eq("id", id).eq("user_id", user.id).not("deleted_at", "is", null).select("id").maybeSingle();
    throwOnError(error);
    if (!data) throw new Error("Task is not in this user's trash");
  },
};

export type TodoRecurrenceSummary = {
  rule: Tables<"todo_recurrence_rules">;
  config: TodoRecurrenceConfig;
  templateTask: Tables<"todo_tasks"> | null;
  nextTask: Tables<"todo_tasks"> | null;
  listName: string;
};

export const todoRecurrencesService = {
  async list() {
    const { user, supabase } = await context();
    const { error: generationError } = await supabase.rpc("ensure_todo_recurrence_occurrences", { p_days_ahead: 45 });
    throwOnError(generationError);
    const [rulesResult, listsResult, tasksResult] = await Promise.all([
      supabase.from("todo_recurrence_rules").select("*").eq("user_id", user.id).order("created_at", { ascending: false }),
      supabase.from("todo_lists").select("id,name").eq("user_id", user.id),
      supabase.from("todo_tasks").select("*").eq("user_id", user.id).not("recurrence_rule_id", "is", null).order("recurrence_on"),
    ]);
    for (const result of [rulesResult, listsResult, tasksResult]) throwOnError(result.error);
    const rules = rulesResult.data ?? [];
    const lists = listsResult.data ?? [];
    const tasks = tasksResult.data ?? [];
    return rules.map((rule): TodoRecurrenceSummary => {
      const config = recurrenceConfigFromRule(rule);
      const ruleTasks = tasks.filter((task) => task.recurrence_rule_id === rule.id);
      const templateTask = tasks.find((task) => task.id === rule.template_task_id) ?? ruleTasks[0] ?? null;
      const nextTask = ruleTasks.find((task) => task.status !== "done" && task.deleted_at === null && task.archived_at === null) ?? null;
      return { rule, config, templateTask, nextTask, listName: lists.find((list) => list.id === (rule.template as Record<string, unknown>).listId)?.name ?? "Lista removida" };
    });
  },
  async setState(id: string, status: "active" | "paused" | "ended") {
    const { error } = await (await context()).supabase.rpc("set_todo_recurrence_state", { p_rule_id: id, p_status: status });
    throwOnError(error);
  },
  async setException(id: string, occurrenceOn: string, action: "skipped" | "rescheduled", overrideOn: string | null = null) {
    const { error } = await (await context()).supabase.rpc("set_todo_recurrence_exception", { p_rule_id: id, p_occurrence_on: occurrenceOn, p_action: action, p_override_on: overrideOn });
    throwOnError(error);
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
  async listForTasks(taskIds: string[]) {
    if (taskIds.length === 0) return [];
    const { user, supabase } = await context();
    const { data, error } = await supabase.from("todo_task_labels").select("*").eq("user_id", user.id).in("task_id", taskIds);
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
  async listRecent() {
    const { user, supabase } = await context();
    const { data, error } = await supabase.from("todo_activity_logs").select("*").eq("user_id", user.id).order("created_at", { ascending: false }).limit(100);
    throwOnError(error);
    return data ?? [];
  },
};

export type TodoWeeklyPriorityInput = {
  taskId: string;
  position: number;
  whyImportant: string;
  plannedOn: string | null;
  plannedTime: string | null;
};

export const todoWeeklyReviewService = {
  async load(weekStart: string) {
    const { user, supabase } = await context();
    const { data: review, error: reviewError } = await supabase.from("todo_weekly_reviews").select("*").eq("user_id", user.id).eq("week_start", weekStart).maybeSingle();
    throwOnError(reviewError);
    if (!review) return { review: null, captures: [], priorities: [], reservations: [] };
    const [capturesResult, prioritiesResult, reservationsResult] = await Promise.all([
      supabase.from("todo_weekly_review_captures").select("*").eq("user_id", user.id).eq("review_id", review.id).order("created_at", { ascending: false }),
      supabase.from("todo_weekly_review_priorities").select("*").eq("user_id", user.id).eq("review_id", review.id).order("position"),
      supabase.from("todo_weekly_review_reservations").select("*").eq("user_id", user.id).eq("review_id", review.id).order("planned_on"),
    ]);
    throwOnError(capturesResult.error);
    throwOnError(prioritiesResult.error);
    throwOnError(reservationsResult.error);
    return { review, captures: capturesResult.data ?? [], priorities: prioritiesResult.data ?? [], reservations: reservationsResult.data ?? [] };
  },
  async createCapture(weekStart: string, title: string, notes: string) {
    const { data, error } = await (await context()).supabase.rpc("create_todo_weekly_capture", { p_week_start: weekStart, p_title: title, p_notes: notes });
    throwOnError(error);
    return data;
  },
  async saveCaptureDraft(weekStart: string, title: string, notes: string) {
    const { data, error } = await (await context()).supabase.rpc("save_todo_weekly_capture_draft", { p_week_start: weekStart, p_title: title, p_notes: notes });
    throwOnError(error);
    return data;
  },
  async updateCapturePlan(id: string, listId: string | null, scheduledOn: string | null) {
    const { user, supabase } = await context();
    const { data, error } = await supabase.from("todo_weekly_review_captures").update({ list_id: listId, scheduled_on: scheduledOn, updated_at: new Date().toISOString() }).eq("id", id).eq("user_id", user.id).eq("state", "captured").select("id").maybeSingle();
    throwOnError(error);
    if (!data) throw new Error("Captura não está mais disponível.");
  },
  async updateCapture(id: string, state: "archived" | "discarded") {
    const { user, supabase } = await context();
    const { data, error } = await supabase.from("todo_weekly_review_captures").update({ state, updated_at: new Date().toISOString() }).eq("id", id).eq("user_id", user.id).eq("state", "captured").select("id").maybeSingle();
    throwOnError(error);
    if (!data) throw new Error("Captura não está mais disponível.");
  },
  async convertCapture(id: string, listId: string, scheduledOn: string | null) {
    const { data, error } = await (await context()).supabase.rpc("convert_todo_weekly_capture_to_task", { p_capture_id: id, p_list_id: listId, p_scheduled_on: scheduledOn });
    throwOnError(error);
    return data;
  },
  async save(input: { weekStart: string; step: number; notes: string; priorities: TodoWeeklyPriorityInput[] }) {
    const { data, error } = await (await context()).supabase.rpc("save_todo_weekly_review", {
      p_week_start: input.weekStart,
      p_current_step: input.step,
      p_notes: input.notes,
      p_priorities: input.priorities.map((item) => ({
        taskId: item.taskId, position: item.position, whyImportant: item.whyImportant,
        plannedOn: item.plannedOn, plannedTime: item.plannedTime,
      })),
    });
    throwOnError(error);
    return data;
  },
  async setReservedDay(weekStart: string, plannedOn: string, reserved: boolean) {
    const { data, error } = await (await context()).supabase.rpc("set_todo_weekly_review_reservation", { p_week_start: weekStart, p_planned_on: plannedOn, p_reserved: reserved });
    throwOnError(error);
    return data;
  },
};
