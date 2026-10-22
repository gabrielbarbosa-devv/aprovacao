"use client";

import type { ReactNode } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { ArrowLeft, BriefcaseBusiness, CalendarDays, CheckCircle2, CheckSquare2, CircleDot, Home, Layers3, ListTodo } from "lucide-react";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { ThemeToggle } from "@/components/theme-toggle";
import { Sidebar as ShadcnSidebar, SidebarContent, SidebarFooter, SidebarGroup, SidebarGroupContent, SidebarGroupLabel, SidebarHeader, SidebarInset, SidebarMenu, SidebarMenuButton, SidebarMenuItem, SidebarProvider, SidebarSeparator, SidebarTrigger } from "@/components/ui/sidebar";
import { TooltipProvider } from "@/components/ui/tooltip";
import { TodoDashboardProvider, useTodoDashboardData, type TodoDashboardView } from "@/features/todo/hooks/todo-dashboard-context";
import { Skeleton } from "@/components/ui/skeleton";

function initials(email: string): string {
  const parts = email.split("@")[0]?.split(/[._-]+/).filter(Boolean) ?? [];
  return parts.slice(0, 2).map((part) => part[0]).join("").toLocaleUpperCase("pt-BR") || "OA";
}

const mainNavigation: { view: TodoDashboardView; label: string; icon: typeof Home }[] = [
  { view: "overview", label: "Visão geral", icon: Home },
  { view: "today", label: "Hoje", icon: CalendarDays },
  { view: "all", label: "Todas as tarefas", icon: ListTodo },
  { view: "completed", label: "Concluídas", icon: CheckCircle2 },
];

function TodoSidebarContent({ email }: { email: string }) {
  const pathname = usePathname();
  const router = useRouter();
  const {
    lists, tasks, workspaces, loading, view, setView,
    selectedListId, selectedWorkspaceId, setSelectedListId, setSelectedWorkspaceId, setSelectedDate,
  } = useTodoDashboardData();
  const openCount = (listId: string) => tasks.filter((task) => task.list_id === listId && task.status !== "done").length;
  const tasksInWorkspace = (workspaceId: string) => tasks.filter((task) => task.workspace_id === workspaceId && task.status !== "done").length;

  const selectView = (nextView: TodoDashboardView) => {
    setSelectedListId(null);
    setSelectedWorkspaceId(null);
    setSelectedDate(null);
    setView(nextView);
    router.push(nextView === "today" ? "/todo/today" : nextView === "all" ? "/todo/all" : nextView === "completed" ? "/todo/completed" : "/todo");
  };

  return (
    <>
      <SidebarHeader className="px-4 pb-4 pt-4">
        <Link href="/" className="flex min-w-0 items-center gap-3" aria-label="Operação Aprovação, voltar aos módulos">
          <span className="grid size-9 shrink-0 place-items-center rounded-xl bg-primary text-primary-foreground"><CircleDot aria-hidden="true" className="size-5" /></span>
          <span className="min-w-0 leading-tight group-data-[collapsible=icon]:hidden">
            <span className="block truncate text-sm font-bold tracking-tight">Operação Aprovação</span>
            <span className="mt-1 block truncate text-xs text-muted-foreground">Seu espaço pessoal</span>
          </span>
        </Link>
      </SidebarHeader>
      <SidebarContent>
        <SidebarGroup className="px-3 py-1">
          <SidebarGroupLabel className="px-2 text-[10px] font-semibold uppercase tracking-[0.14em]">Módulo de tarefas</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu className="gap-1">
              {mainNavigation.map(({ view: itemView, label, icon: Icon }) => {
                const active = itemView === "today"
                  ? pathname === "/todo/today"
                  : itemView === "all"
                    ? pathname === "/todo/all"
                    : itemView === "completed"
                      ? pathname === "/todo/completed"
                      : pathname !== "/todo/today" && pathname !== "/todo/all" && pathname !== "/todo/completed" && view === itemView;
                return (
                  <SidebarMenuItem key={itemView}>
                    <SidebarMenuButton type="button" onClick={() => selectView(itemView)} isActive={active} aria-current={active ? "page" : undefined} tooltip={label} className="h-10 px-3 font-medium">
                      <Icon aria-hidden="true" /><span>{label}</span>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                );
              })}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>

        <SidebarGroup className="px-3 py-1">
          <SidebarGroupLabel className="px-2 text-[10px] font-semibold uppercase tracking-[0.14em]">Listas</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu className="gap-1">
              {loading ? <SidebarMenuItem><Skeleton className="mx-2 h-8" /></SidebarMenuItem> : lists.map((list) => {
                const active = view === "list" && selectedListId === list.id;
                return (
                  <SidebarMenuItem key={list.id}>
                    <SidebarMenuButton type="button" onClick={() => { setSelectedWorkspaceId(null); setSelectedDate(null); setSelectedListId(list.id); setView("list"); router.push("/todo"); }} isActive={active} aria-current={active ? "page" : undefined} tooltip={list.name} className="h-9 px-3">
                      <ListTodo aria-hidden="true" /><span>{list.name}</span><Badge variant="secondary" className="ml-auto h-5 min-w-6 justify-center px-1 text-[10px] group-data-[collapsible=icon]:hidden">{openCount(list.id)}</Badge>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                );
              })}
              <SidebarMenuItem>
                <SidebarMenuButton type="button" onClick={() => selectView("lists")} isActive={view === "lists"} aria-current={view === "lists" ? "page" : undefined} tooltip="Todas as listas" className="h-9 px-3 text-muted-foreground">
                  <Layers3 aria-hidden="true" /><span>Ver listas</span>
                </SidebarMenuButton>
              </SidebarMenuItem>
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>

        <SidebarGroup className="px-3 py-1">
          <SidebarGroupLabel className="px-2 text-[10px] font-semibold uppercase tracking-[0.14em]">Workspaces</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu className="gap-1">
              {loading ? <SidebarMenuItem><Skeleton className="mx-2 h-8" /></SidebarMenuItem> : workspaces.map((workspace) => {
                const active = view === "workspace" && selectedWorkspaceId === workspace.id;
                return (
                  <SidebarMenuItem key={workspace.id}>
                    <SidebarMenuButton type="button" onClick={() => { setSelectedListId(null); setSelectedDate(null); setSelectedWorkspaceId(workspace.id); setView("workspace"); router.push("/todo"); }} isActive={active} aria-current={active ? "page" : undefined} tooltip={workspace.name} className="h-9 px-3">
                      <BriefcaseBusiness aria-hidden="true" /><span>{workspace.name}</span><Badge variant="secondary" className="ml-auto h-5 min-w-6 justify-center px-1 text-[10px] group-data-[collapsible=icon]:hidden">{tasksInWorkspace(workspace.id)}</Badge>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                );
              })}
              <SidebarMenuItem>
                <SidebarMenuButton type="button" onClick={() => selectView("workspaces")} isActive={view === "workspaces"} aria-current={view === "workspaces" ? "page" : undefined} tooltip="Todos os workspaces" className="h-9 px-3 text-muted-foreground">
                  <Layers3 aria-hidden="true" /><span>Ver workspaces</span>
                </SidebarMenuButton>
              </SidebarMenuItem>
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>
      <SidebarFooter className="gap-2 px-3 pb-4">
        <SidebarSeparator className="mb-1" />
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton render={<Link href="/" />} tooltip="Voltar aos módulos" className="h-10 px-3 font-medium"><ArrowLeft aria-hidden="true" /><span>Voltar aos módulos</span></SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
        <div className="flex min-w-0 items-center gap-3 px-2 py-1 group-data-[collapsible=icon]:justify-center group-data-[collapsible=icon]:px-0">
          <Avatar className="size-9 shrink-0"><AvatarFallback className="bg-secondary text-xs font-bold text-secondary-foreground">{initials(email)}</AvatarFallback></Avatar>
          <div className="min-w-0 flex-1 group-data-[collapsible=icon]:hidden"><p className="truncate text-xs font-semibold">{email}</p><p className="mt-0.5 text-[11px] text-muted-foreground">Conta autenticada</p></div>
        </div>
      </SidebarFooter>
    </>
  );
}

export function TodoLayout({ children, email }: { children: ReactNode; email: string }) {
  return (
    <TodoDashboardProvider>
      <TooltipProvider>
        <SidebarProvider>
          <ShadcnSidebar collapsible="icon" className="border-sidebar-border">
            <TodoSidebarContent email={email} />
          </ShadcnSidebar>
          <SidebarInset className="min-h-svh min-w-0 bg-muted/30">
            <header className="flex h-14 shrink-0 items-center justify-between border-b bg-background px-4 sm:px-6">
              <div className="flex items-center gap-3"><SidebarTrigger aria-label="Abrir ou recolher navegação" className="-ml-2" /><span className="inline-flex items-center gap-2 text-sm font-medium text-muted-foreground"><CheckSquare2 aria-hidden="true" className="size-4" /> Produtividade pessoal</span></div>
              <ThemeToggle />
            </header>
            {children}
          </SidebarInset>
        </SidebarProvider>
      </TooltipProvider>
    </TodoDashboardProvider>
  );
}
