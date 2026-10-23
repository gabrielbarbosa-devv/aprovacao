import { z } from "zod";
import { todoRecurrenceConfigSchema } from "./recurrence";

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
export const todoTaskBundleSchema = z.object({
  id: uuid.nullable().optional(),
  listId: uuid,
  workspaceId: uuid.nullable().optional(),
  title: text(240),
  description: z.string().max(10000).nullable().optional(),
  priority: z.enum(["low", "medium", "high"]),
  startsOn: date,
  dueOn: date.nullable(),
  dueAt: z.iso.datetime({ offset: true }).nullable(),
  labelIds: z.array(uuid).max(50),
  newLabels: z.array(text(60)).max(30),
  subtasks: z.array(z.object({ id: uuid.optional(), title: text(240), isCompleted: z.boolean() }).strict()).max(50),
  recurrence: todoRecurrenceConfigSchema.nullable().optional(),
}).strict().superRefine((input, context) => {
  if (input.dueOn && input.dueOn < input.startsOn) context.addIssue({ code: "custom", path: ["dueOn"], message: "O vencimento não pode ser anterior à data de início." });
  if (input.dueAt && !input.dueOn) context.addIssue({ code: "custom", path: ["dueAt"], message: "Selecione uma data de vencimento para definir um horário." });
  if (!input.id && input.recurrence && input.recurrence.startsOn !== input.startsOn) context.addIssue({ code: "custom", path: ["recurrence", "startsOn"], message: "A data de início da recorrência deve corresponder à data de início da tarefa." });
});
export const todoTaskDetailsSchema = todoTaskBundleSchema.safeExtend({
  id: uuid,
  status: z.enum(["todo", "in_progress", "done"]),
  expectedUpdatedAt: z.iso.datetime({ offset: true }),
  recurrenceScope: z.enum(["occurrence", "following", "series"]).default("occurrence"),
});
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
export type TodoTaskBundle = z.infer<typeof todoTaskBundleSchema>;
export type TodoTaskDetails = z.infer<typeof todoTaskDetailsSchema>;
export type TodoSubtaskInput = z.infer<typeof todoSubtaskInputSchema>;
export type TodoSubtaskUpdate = z.infer<typeof todoSubtaskUpdateSchema>;
export type TodoLabelInput = z.infer<typeof todoLabelInputSchema>;
export type TodoLabelUpdate = z.infer<typeof todoLabelUpdateSchema>;
export type TodoTaskLabelInput = z.infer<typeof todoTaskLabelInputSchema>;
