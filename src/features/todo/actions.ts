"use server";

import { z } from "zod";
import { unstable_rethrow } from "next/navigation";
import {
  todoIdSchema, todoLabelInputSchema, todoLabelUpdateSchema, todoListInputSchema, todoListUpdateSchema,
  todoSubtaskInputSchema, todoSubtaskUpdateSchema, todoTaskIdSchema, todoTaskInputSchema,
  todoTaskBundleSchema, todoTaskDetailsSchema, todoTaskLabelInputSchema, todoTaskUpdateSchema, todoWorkspaceInputSchema, todoWorkspaceUpdateSchema,
} from "@/features/todo/domain/schemas";
import {
  todoActivityService, todoLabelsService, todoListsService, todoSubtasksService,
  todoTaskLabelsService, todoTasksService, todoWorkspacesService, todoRecurrencesService, todoWeeklyReviewService,
} from "@/features/todo/services/todo-services";

export type TodoActionResult<T> = { ok: true; data: T } | { ok: false; message: string };

async function run<T>(operation: () => Promise<T>): Promise<TodoActionResult<T>> {
  try {
    return { ok: true, data: await operation() };
  } catch (error) {
    unstable_rethrow(error);
    return { ok: false, message: error instanceof Error && error.message.trim() ? error.message : "Não foi possível concluir a operação. Confira os dados e tente novamente." };
  }
}

function parse<T>(schema: z.ZodType<T>, input: unknown): { ok: true; value: T } | { ok: false; result: TodoActionResult<never> } {
  const parsed = schema.safeParse(input);
  if (parsed.success) return { ok: true, value: parsed.data };
  return { ok: false, result: { ok: false, message: parsed.error.issues[0]?.message ?? "Confira os dados enviados." } };
}

export async function loadTodoListsAction(): Promise<TodoActionResult<Awaited<ReturnType<typeof todoListsService.initialize>>>> {
  return run(() => todoListsService.initialize());
}
export async function loadTodoWorkspacesAction() { return run(() => todoWorkspacesService.list()); }
export async function loadTodoTasksAction(input: unknown) {
  const schema = z.object({ listId: z.uuid().optional(), workspaceId: z.uuid().optional(), status: z.enum(["todo", "in_progress", "done"]).optional(), includeDeleted: z.boolean().optional(), lifecycle: z.enum(["active", "archived", "trash", "any"]).optional() }).strict();
  const parsed = parse(schema, input);
  if (!parsed.ok) return parsed.result;
  return run(() => todoTasksService.list(parsed.value));
}
export async function loadTodoTaskDetailsAction(input: unknown) {
  const parsed = parse(todoTaskIdSchema, input);
  if (!parsed.ok) return parsed.result;
  return run(() => todoTasksService.getDetails(parsed.value.taskId));
}
export async function loadTodoSubtasksAction(input: unknown) {
  const parsed = parse(todoTaskIdSchema, input);
  if (!parsed.ok) return parsed.result;
  const { taskId } = parsed.value;
  return run(() => todoSubtasksService.list(taskId));
}
export async function loadTodoLabelsAction() { return run(() => todoLabelsService.list()); }
export async function loadTodoTaskLabelsAction(input: unknown) {
  const parsed = parse(todoTaskIdSchema, input);
  if (!parsed.ok) return parsed.result;
  const { taskId } = parsed.value;
  return run(() => todoTaskLabelsService.list(taskId));
}
export async function loadTodoTaskLabelsForTasksAction(input: unknown) {
  const schema = z.object({ taskIds: z.array(z.uuid()).max(500) }).strict();
  const parsed = parse(schema, input);
  if (!parsed.ok) return parsed.result;
  return run(() => todoTaskLabelsService.listForTasks(parsed.value.taskIds));
}
export async function loadTodoActivityAction(input: unknown) {
  const parsed = parse(todoTaskIdSchema, input);
  if (!parsed.ok) return parsed.result;
  const { taskId } = parsed.value;
  return run(() => todoActivityService.list(taskId));
}
export async function loadTodoRecentActivityAction() { return run(() => todoActivityService.listRecent()); }
export async function loadTodoRecurrencesAction() { return run(() => todoRecurrencesService.list()); }
const weeklyWeekSchema = z.object({ weekStart: z.iso.date() }).strict();
export async function loadTodoWeeklyReviewAction(input: unknown) {
  const parsed = parse(weeklyWeekSchema, input);
  if (!parsed.ok) return parsed.result;
  return run(() => todoWeeklyReviewService.load(parsed.value.weekStart));
}
export async function createTodoWeeklyCaptureAction(input: unknown) {
  const parsed = parse(z.object({ weekStart: z.iso.date(), title: z.string().trim().min(1).max(240), notes: z.string().max(2000).default("") }).strict(), input);
  if (!parsed.ok) return parsed.result;
  return run(() => todoWeeklyReviewService.createCapture(parsed.value.weekStart, parsed.value.title, parsed.value.notes));
}
export async function saveTodoWeeklyCaptureDraftAction(input: unknown) {
  const parsed = parse(z.object({ weekStart: z.iso.date(), title: z.string().max(240), notes: z.string().max(2000) }).strict(), input);
  if (!parsed.ok) return parsed.result;
  return run(() => todoWeeklyReviewService.saveCaptureDraft(parsed.value.weekStart, parsed.value.title, parsed.value.notes));
}
export async function updateTodoWeeklyCapturePlanAction(input: unknown) {
  const parsed = parse(z.object({ id: z.uuid(), listId: z.uuid().nullable(), scheduledOn: z.iso.date().nullable() }).strict(), input);
  if (!parsed.ok) return parsed.result;
  return run(async () => { await todoWeeklyReviewService.updateCapturePlan(parsed.value.id, parsed.value.listId, parsed.value.scheduledOn); return null; });
}
export async function updateTodoWeeklyCaptureAction(input: unknown) {
  const parsed = parse(z.object({ id: z.uuid(), state: z.enum(["archived", "discarded"]) }).strict(), input);
  if (!parsed.ok) return parsed.result;
  return run(async () => { await todoWeeklyReviewService.updateCapture(parsed.value.id, parsed.value.state); return null; });
}
export async function convertTodoWeeklyCaptureAction(input: unknown) {
  const parsed = parse(z.object({ id: z.uuid(), listId: z.uuid(), scheduledOn: z.iso.date().nullable() }).strict(), input);
  if (!parsed.ok) return parsed.result;
  return run(() => todoWeeklyReviewService.convertCapture(parsed.value.id, parsed.value.listId, parsed.value.scheduledOn));
}
export async function saveTodoWeeklyReviewAction(input: unknown) {
  const schema = z.object({
    weekStart: z.iso.date(), step: z.number().int().min(0).max(4), notes: z.string().max(2000),
    priorities: z.array(z.object({ taskId: z.uuid(), position: z.number().int().min(1).max(3), whyImportant: z.string().max(500), plannedOn: z.iso.date().nullable(), plannedTime: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/).nullable() }).strict()).max(3),
  }).strict().superRefine((value, context) => {
    if (new Set(value.priorities.map((item) => item.taskId)).size !== value.priorities.length) context.addIssue({ code: "custom", path: ["priorities"], message: "Uma tarefa não pode aparecer duas vezes entre as prioridades." });
    if (new Set(value.priorities.map((item) => item.position)).size !== value.priorities.length) context.addIssue({ code: "custom", path: ["priorities"], message: "A ordem das prioridades precisa ser única." });
    if (value.priorities.some((item) => item.plannedTime && !item.plannedOn)) context.addIssue({ code: "custom", path: ["priorities"], message: "Escolha um dia antes de definir um horário." });
  });
  const parsed = parse(schema, input);
  if (!parsed.ok) return parsed.result;
  return run(() => todoWeeklyReviewService.save(parsed.value));
}
export async function setTodoWeeklyReviewReservationAction(input: unknown) {
  const parsed = parse(z.object({ weekStart: z.iso.date(), plannedOn: z.iso.date(), reserved: z.boolean() }).strict(), input);
  if (!parsed.ok) return parsed.result;
  return run(() => todoWeeklyReviewService.setReservedDay(parsed.value.weekStart, parsed.value.plannedOn, parsed.value.reserved));
}
export async function todoRecurrenceStateAction(input: unknown) {
  const schema = z.object({ id: z.uuid(), status: z.enum(["active", "paused", "ended"]) }).strict();
  const parsed = parse(schema, input);
  if (!parsed.ok) return parsed.result;
  return run(async () => { await todoRecurrencesService.setState(parsed.value.id, parsed.value.status); return null; });
}
export async function todoRecurrenceExceptionAction(input: unknown) {
  const schema = z.object({ id: z.uuid(), occurrenceOn: z.iso.date(), action: z.enum(["skipped", "rescheduled"]), overrideOn: z.iso.date().nullable().optional() }).strict();
  const parsed = parse(schema, input);
  if (!parsed.ok) return parsed.result;
  if (parsed.value.action === "rescheduled" && !parsed.value.overrideOn) return { ok: false as const, message: "Selecione a nova data da ocorrência." };
  return run(async () => { await todoRecurrencesService.setException(parsed.value.id, parsed.value.occurrenceOn, parsed.value.action, parsed.value.overrideOn ?? null); return null; });
}

const deleteSchema = todoIdSchema;
export async function todoListAction(input: unknown) {
  const schema = z.discriminatedUnion("operation", [
    todoListInputSchema.extend({ operation: z.literal("create") }),
    todoListUpdateSchema.extend({ operation: z.literal("update") }),
    deleteSchema.extend({ operation: z.literal("delete") }),
    deleteSchema.extend({ operation: z.literal("delete_with_transfer"), targetListId: z.uuid().nullable() }),
  ]);
  const parsed = parse(schema, input);
  if (!parsed.ok) return parsed.result;
  const value = parsed.value;
  if (value.operation === "create") { const { operation, ...payload } = value; void operation; return run(() => todoListsService.create(payload)); }
  if (value.operation === "update") { const { operation, ...payload } = value; void operation; return run(() => todoListsService.update(payload)); }
  if (value.operation === "delete_with_transfer") return run(() => todoListsService.deleteWithTransfer(value.id, value.targetListId));
  return run(async () => { await todoListsService.delete(value.id); return null; });
}
export async function todoWorkspaceAction(input: unknown) {
  const schema = z.discriminatedUnion("operation", [
    todoWorkspaceInputSchema.extend({ operation: z.literal("create") }),
    todoWorkspaceUpdateSchema.extend({ operation: z.literal("update") }),
    deleteSchema.extend({ operation: z.literal("delete_with_policy"), taskPolicy: z.enum(["keep_tasks", "soft_delete_tasks"]) }),
  ]);
  const parsed = parse(schema, input);
  if (!parsed.ok) return parsed.result;
  const value = parsed.value;
  if (value.operation === "create") { const { operation, ...payload } = value; void operation; return run(() => todoWorkspacesService.create(payload)); }
  if (value.operation === "update") { const { operation, ...payload } = value; void operation; return run(() => todoWorkspacesService.update(payload)); }
  return run(() => todoWorkspacesService.deleteWithTaskPolicy(value.id, value.taskPolicy));
}
export async function todoTaskAction(input: unknown) {
  const schema = z.discriminatedUnion("operation", [
    todoTaskInputSchema.extend({ operation: z.literal("create") }),
    todoTaskUpdateSchema.extend({ operation: z.literal("update") }),
    deleteSchema.extend({ operation: z.literal("archive") }),
    deleteSchema.extend({ operation: z.literal("trash") }),
    deleteSchema.extend({ operation: z.literal("soft_delete") }),
    deleteSchema.extend({ operation: z.literal("restore") }),
    deleteSchema.extend({ operation: z.literal("delete_permanently") }),
  ]);
  const parsed = parse(schema, input);
  if (!parsed.ok) return parsed.result;
  const value = parsed.value;
  if (value.operation === "create") { const { operation, ...payload } = value; void operation; return run(() => todoTasksService.create(payload)); }
  if (value.operation === "update") { const { operation, ...payload } = value; void operation; return run(() => todoTasksService.update(payload)); }
  if (value.operation === "restore") return run(() => todoTasksService.restore(value.id));
  if (value.operation === "archive") return run(async () => { await todoTasksService.archive(value.id); return null; });
  if (value.operation === "delete_permanently") return run(async () => { await todoTasksService.deletePermanently(value.id); return null; });
  return run(async () => { await todoTasksService.moveToTrash(value.id); return null; });
}
export async function reorderTodoTaskPositionsAction(input: unknown) {
  const schema = z.object({
    listId: z.uuid(),
    lane: z.enum(["pending", "done"]),
    taskIds: z.array(z.uuid()).max(2000),
  }).strict().superRefine((value, context) => {
    if (new Set(value.taskIds).size !== value.taskIds.length) {
      context.addIssue({ code: "custom", path: ["taskIds"], message: "A ordem contém tarefas duplicadas." });
    }
  });
  const parsed = parse(schema, input);
  if (!parsed.ok) return parsed.result;
  return run(() => todoTasksService.reorder(parsed.value));
}
export async function saveTodoTaskBundleAction(input: unknown) {
  const parsed = parse(todoTaskBundleSchema, input);
  if (!parsed.ok) return parsed.result;
  return run(() => todoTasksService.saveBundle(parsed.value));
}
export async function saveTodoTaskDetailsAction(input: unknown) {
  const parsed = parse(todoTaskDetailsSchema, input);
  if (!parsed.ok) return parsed.result;
  try {
    return { ok: true as const, data: await todoTasksService.saveDetails(parsed.value) };
  } catch (error) {
    unstable_rethrow(error);
    if (error && typeof error === "object" && "code" in error && error.code === "40001") {
      return { ok: false as const, message: "Esta tarefa foi alterada em outra sessão. Seu rascunho continua aqui; recarregue a versão atual antes de salvar." };
    }
    return { ok: false as const, message: "Não foi possível salvar as alterações. Seus dados continuam nesta tela para você tentar novamente." };
  }
}
export async function todoSubtaskAction(input: unknown) {
  const schema = z.discriminatedUnion("operation", [
    todoSubtaskInputSchema.extend({ operation: z.literal("create") }),
    todoSubtaskUpdateSchema.extend({ operation: z.literal("update") }),
    deleteSchema.extend({ operation: z.literal("delete") }),
  ]);
  const parsed = parse(schema, input);
  if (!parsed.ok) return parsed.result;
  const value = parsed.value;
  if (value.operation === "create") { const { operation, ...payload } = value; void operation; return run(() => todoSubtasksService.create(payload)); }
  if (value.operation === "update") { const { operation, ...payload } = value; void operation; return run(() => todoSubtasksService.update(payload)); }
  return run(async () => { await todoSubtasksService.delete(value.id); return null; });
}
export async function todoLabelAction(input: unknown) {
  const schema = z.discriminatedUnion("operation", [
    todoLabelInputSchema.extend({ operation: z.literal("create") }),
    todoLabelUpdateSchema.extend({ operation: z.literal("update") }),
    deleteSchema.extend({ operation: z.literal("delete") }),
  ]);
  const parsed = parse(schema, input);
  if (!parsed.ok) return parsed.result;
  const value = parsed.value;
  if (value.operation === "create") { const { operation, ...payload } = value; void operation; return run(() => todoLabelsService.create(payload)); }
  if (value.operation === "update") { const { operation, ...payload } = value; void operation; return run(() => todoLabelsService.update(payload)); }
  return run(async () => { await todoLabelsService.delete(value.id); return null; });
}
export async function todoTaskLabelAction(input: unknown) {
  const schema = todoTaskLabelInputSchema.extend({ operation: z.enum(["attach", "detach"]) });
  const parsed = parse(schema, input);
  if (!parsed.ok) return parsed.result;
  const value = parsed.value;
  const { operation, ...payload } = value;
  if (operation === "attach") return run(() => todoTaskLabelsService.attach(payload));
  return run(async () => { await todoTaskLabelsService.detach(payload); return null; });
}
