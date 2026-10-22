"use server";

import { z } from "zod";
import { unstable_rethrow } from "next/navigation";
import {
  todoIdSchema, todoLabelInputSchema, todoLabelUpdateSchema, todoListInputSchema, todoListUpdateSchema,
  todoSubtaskInputSchema, todoSubtaskUpdateSchema, todoTaskIdSchema, todoTaskInputSchema,
  todoTaskLabelInputSchema, todoTaskUpdateSchema, todoWorkspaceInputSchema, todoWorkspaceUpdateSchema,
} from "@/features/todo/domain/schemas";
import {
  todoActivityService, todoLabelsService, todoListsService, todoSubtasksService,
  todoTaskLabelsService, todoTasksService, todoWorkspacesService,
} from "@/features/todo/services/todo-services";

export type TodoActionResult<T> = { ok: true; data: T } | { ok: false; message: string };

async function run<T>(operation: () => Promise<T>): Promise<TodoActionResult<T>> {
  try {
    return { ok: true, data: await operation() };
  } catch (error) {
    unstable_rethrow(error);
    return { ok: false, message: "Não foi possível concluir a operação. Confira os dados e tente novamente." };
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
  const schema = z.object({ listId: z.uuid().optional(), workspaceId: z.uuid().optional(), status: z.enum(["todo", "in_progress", "done"]).optional(), includeDeleted: z.boolean().optional() }).strict();
  const parsed = parse(schema, input);
  if (!parsed.ok) return parsed.result;
  return run(() => todoTasksService.list(parsed.value));
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
    deleteSchema.extend({ operation: z.literal("soft_delete") }),
    deleteSchema.extend({ operation: z.literal("restore") }),
  ]);
  const parsed = parse(schema, input);
  if (!parsed.ok) return parsed.result;
  const value = parsed.value;
  if (value.operation === "create") { const { operation, ...payload } = value; void operation; return run(() => todoTasksService.create(payload)); }
  if (value.operation === "update") { const { operation, ...payload } = value; void operation; return run(() => todoTasksService.update(payload)); }
  if (value.operation === "restore") return run(() => todoTasksService.restore(value.id));
  return run(async () => { await todoTasksService.softDelete(value.id); return null; });
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
