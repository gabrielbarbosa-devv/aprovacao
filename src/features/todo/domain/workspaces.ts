import type { TodoTask } from "@/features/todo/domain/types";

export function summarizeWorkspaceTasks(tasks: TodoTask[]) {
  const completed = tasks.filter((task) => task.status === "done").length;
  const total = tasks.length;
  return {
    total,
    completed,
    pending: total - completed,
    progress: total ? Math.round((completed / total) * 100) : 0,
    filterStatus: total > 0 && completed === total ? "completed" as const : total > completed ? "in_progress" as const : "empty" as const,
  };
}

export function filterWorkspacesBySearch<T extends { name: string; description: string | null }>(workspaces: T[], search: string) {
  const query = search.trim().toLocaleLowerCase("pt-BR");
  if (!query) return workspaces;
  return workspaces.filter((workspace) => `${workspace.name} ${workspace.description ?? ""}`.toLocaleLowerCase("pt-BR").includes(query));
}

export function activityLabel(action: string) {
  switch (action) {
    case "created": return "Nova tarefa criada";
    case "completed": return "Tarefa concluída";
    case "reopened": return "Tarefa reaberta";
    case "soft_deleted": return "Tarefa removida";
    default: return "Tarefa atualizada";
  }
}
