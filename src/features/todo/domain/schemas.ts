import { z } from "zod";

const text = (max: number) => z.string().trim().min(1).max(max);
const uuid = z.uuid();
const date = z.iso.date();

export const todoListInputSchema = z.object({ name: text(80), slug: z.string().trim().min(1).max(100).regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/), icon: text(48).optional(), color: text(32).optional(), position: z.number().int().min(0).optional() }).strict();
export const todoListUpdateSchema = todoListInputSchema.partial().extend({ id: uuid }).strict();
export const todoWorkspaceInputSchema = z.object({ name: text(100), description: z.string().max(2000).nullable().optional(), icon: text(48).optional(), color: text(32).optional() }).strict();
export const todoWorkspaceUpdateSchema = todoWorkspaceInputSchema.partial().extend({ id: uuid }).strict();

export const todoTaskInputSchema = z.object({
  listId: uuid,
  workspaceId: uuid.nullable().optional(),
  title: text(240),
  description: z.string().max(10000).nullable().optional(),
  status: z.enum(["todo", "in_progress", "done"]).optional(),
  priority: z.enum(["low", "medium", "high"]).optional(),
  startsOn: date.optional(),
  dueOn: date.nullable().optional(),
  dueAt: z.iso.datetime({ offset: true }).nullable().optional(),
  position: z.number().int().min(0).optional(),
}).strict();
export const todoTaskUpdateSchema = todoTaskInputSchema.partial().extend({ id: uuid }).strict();
export const todoSubtaskInputSchema = z.object({ taskId: uuid, title: text(240), position: z.number().int().min(0).optional() }).strict();
export const todoSubtaskUpdateSchema = z.object({ id: uuid, title: text(240).optional(), isCompleted: z.boolean().optional(), position: z.number().int().min(0).optional() }).strict();
export const todoLabelInputSchema = z.object({ name: text(60), color: text(32).optional() }).strict();
export const todoLabelUpdateSchema = todoLabelInputSchema.partial().extend({ id: uuid }).strict();
export const todoTaskLabelInputSchema = z.object({ taskId: uuid, labelId: uuid }).strict();
export const todoTaskIdSchema = z.object({ taskId: uuid }).strict();
export const todoIdSchema = z.object({ id: uuid }).strict();

export type TodoListInput = z.infer<typeof todoListInputSchema>;
export type TodoListUpdate = z.infer<typeof todoListUpdateSchema>;
export type TodoWorkspaceInput = z.infer<typeof todoWorkspaceInputSchema>;
export type TodoWorkspaceUpdate = z.infer<typeof todoWorkspaceUpdateSchema>;
export type TodoTaskInput = z.infer<typeof todoTaskInputSchema>;
export type TodoTaskUpdate = z.infer<typeof todoTaskUpdateSchema>;
export type TodoSubtaskInput = z.infer<typeof todoSubtaskInputSchema>;
export type TodoSubtaskUpdate = z.infer<typeof todoSubtaskUpdateSchema>;
export type TodoLabelInput = z.infer<typeof todoLabelInputSchema>;
export type TodoLabelUpdate = z.infer<typeof todoLabelUpdateSchema>;
export type TodoTaskLabelInput = z.infer<typeof todoTaskLabelInputSchema>;
