import { BriefcaseBusiness, FolderKanban, Heart, Laptop, Smartphone, Users } from "lucide-react";
import type { TodoWorkspace } from "@/features/todo/domain/types";
import { cn } from "@/lib/utils";

const workspaceIcons = { briefcase: BriefcaseBusiness, "folder-kanban": FolderKanban, smartphone: Smartphone, laptop: Laptop, users: Users, heart: Heart } as const;
const iconBackground: Record<string, string> = {
  blue: "bg-blue-500/10 text-blue-600 dark:text-blue-400",
  violet: "bg-violet-500/10 text-violet-600 dark:text-violet-400",
  green: "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400",
  orange: "bg-orange-500/10 text-orange-600 dark:text-orange-400",
  rose: "bg-rose-500/10 text-rose-600 dark:text-rose-400",
};

export function TodoWorkspaceIcon({ workspace, className }: { workspace: TodoWorkspace; className?: string }) {
  const Icon = workspaceIcons[workspace.icon as keyof typeof workspaceIcons] ?? BriefcaseBusiness;
  return <span className={cn("grid size-12 shrink-0 place-items-center rounded-2xl", iconBackground[workspace.color] ?? iconBackground.violet, className)}><Icon className="size-5" aria-hidden="true" /></span>;
}
