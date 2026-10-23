"use client";

import { useCallback, useEffect, useState, type FormEvent, type ReactNode } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import {
  ArrowLeft, BriefcaseBusiness, CalendarDays, CheckCircle2, CheckSquare2,
  ChevronDown, CircleDot, Home, Layers3, ListTodo,
  Plus, RefreshCw, UserRound, ClipboardCheck, MoreHorizontal,
} from "lucide-react";
import { toast } from "sonner";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { ThemeToggle } from "@/components/theme-toggle";
import {
  Sidebar as ShadcnSidebar, SidebarContent, SidebarFooter, SidebarGroup,
  SidebarGroupContent, SidebarGroupLabel, SidebarHeader, SidebarInset,
  SidebarMenu, SidebarMenuButton, SidebarMenuItem, SidebarProvider,
  SidebarSeparator, SidebarTrigger, useSidebar,
} from "@/components/ui/sidebar";
import { TooltipProvider } from "@/components/ui/tooltip";
import { useIsMobile } from "@/hooks/use-mobile";
import { TodoDashboardProvider, useTodoDashboardData, type TodoDashboardView } from "@/features/todo/hooks/todo-dashboard-context";
import {
  DEFAULT_TODO_SIDEBAR_PREFERENCES, parseTodoSidebarPreferences,
  todoSidebarStorageKey, type TodoSidebarGroup, type TodoSidebarPreferences,
} from "@/features/todo/domain/sidebar-preferences";
import { Skeleton } from "@/components/ui/skeleton";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { todoListAction } from "@/features/todo/actions";

function initials(email: string): string {
  const parts = email.split("@")[0]?.split(/[._-]+/).filter(Boolean) ?? [];
  return parts.slice(0, 2).map((part) => part[0]).join("").toLocaleUpperCase("pt-BR") || "OA";
}

const mainNavigation: { view: TodoDashboardView; label: string; icon: typeof Home; href: string }[] = [
  { view: "overview", label: "Visão geral", icon: Home, href: "/todo" },
  { view: "today", label: "Hoje", icon: CalendarDays, href: "/todo/today" },
  { view: "all", label: "Todas as tarefas", icon: ListTodo, href: "/todo/all" },
  { view: "completed", label: "Concluídas", icon: CheckCircle2, href: "/todo/completed" },
];

function TodoSidebarContent({
  email,
  groups,
  onToggleGroup,
}: {
  email: string;
  groups: TodoSidebarPreferences["groups"];
  onToggleGroup: (group: TodoSidebarGroup) => void;
}) {
  const pathname = usePathname();
  const router = useRouter();
  const { isMobile, setOpenMobile, state } = useSidebar();
  const [createListOpen, setCreateListOpen] = useState(false);
  const compact = state === "collapsed" && !isMobile;
  const {
    lists, tasks, workspaces, loading, view, setView, refreshAll,
    selectedListId, selectedWorkspaceId, setSelectedListId, setSelectedWorkspaceId, setSelectedDate,
  } = useTodoDashboardData();
  const openCount = (listId: string) => tasks.filter((task) => task.list_id === listId && task.status !== "done").length;
  const tasksInWorkspace = (workspaceId: string) => tasks.filter((task) => task.workspace_id === workspaceId && task.status !== "done").length;
  const closeMobile = () => { if (isMobile) setOpenMobile(false); };

  const navigate = (href: string, nextView?: TodoDashboardView) => {
    setSelectedListId(null);
    setSelectedWorkspaceId(null);
    setSelectedDate(null);
    if (nextView) setView(nextView);
    router.push(href);
    closeMobile();
  };

  const navigateList = (listId: string) => {
    setSelectedWorkspaceId(null);
    setSelectedDate(null);
    setSelectedListId(listId);
    setView("list");
    router.push(`/todo/lists/${listId}`);
    closeMobile();
  };

  const navigateWorkspace = (workspaceId: string) => {
    setSelectedListId(null);
    setSelectedDate(null);
    setSelectedWorkspaceId(workspaceId);
    setView("overview");
    router.push(`/todo/workspaces/${workspaceId}`);
    closeMobile();
  };

  const createList = async (name: string): Promise<boolean> => {
    const baseSlug = name.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLocaleLowerCase("pt-BR").replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 100) || "lista";
    const usedSlugs = new Set(lists.map((list) => list.slug));
    let slug = baseSlug;
    let suffix = 2;
    while (usedSlugs.has(slug)) slug = `${baseSlug.slice(0, 96)}-${suffix++}`;
    const position = lists.reduce((max, list) => Math.max(max, list.position), -1) + 1;
    const result = await todoListAction({ operation: "create", name, slug, icon: "list", color: "blue", position });
    if (!result.ok) {
      toast.error(result.message);
      return false;
    }
    if (!result.data || typeof result.data !== "object" || !("id" in result.data)) {
      toast.error("A lista foi criada, mas não foi possível abrir seus dados.");
      return false;
    }
    try {
      await refreshAll();
    } catch {
      toast.warning("A lista foi criada, mas a navegação precisa ser atualizada.");
    }
    toast.success("Lista criada.");
    setCreateListOpen(false);
    navigateList(result.data.id);
    return true;
  };

  const isMainActive = (itemView: TodoDashboardView) => itemView === "today"
    ? pathname === "/todo/today"
    : itemView === "all"
      ? pathname === "/todo/all"
      : itemView === "completed"
        ? pathname === "/todo/completed"
        : itemView === "recurring"
          ? pathname === "/todo/recurring"
          : itemView === "weekly-review"
            ? pathname === "/todo/weekly-review"
        : pathname === "/todo" && (view === itemView || view === "lists");

  const sectionHeading = (group: TodoSidebarGroup, label: string) => (
    <SidebarGroupLabel className="px-2 text-[10px] font-semibold uppercase tracking-[0.14em]">
      <button
        type="button"
        aria-expanded={groups[group]}
        aria-label={`${groups[group] ? "Recolher" : "Expandir"} grupo ${label}`}
        onClick={() => onToggleGroup(group)}
        className="flex h-full w-full items-center justify-between rounded-sm text-left outline-none focus-visible:ring-2 focus-visible:ring-sidebar-ring"
      >
        <span>{label}</span>
        <ChevronDown aria-hidden="true" className={`size-3.5 transition-transform motion-reduce:transition-none ${groups[group] ? "rotate-180" : ""}`} />
      </button>
    </SidebarGroupLabel>
  );

  return (
    <>
      <SidebarHeader className="gap-3 px-3 pb-3 pt-4">
        <div className={`flex min-w-0 items-center ${compact ? "justify-center" : "justify-between"}`}>
          <Link href="/" onClick={closeMobile} className="flex min-w-0 items-center gap-3" aria-label="Operação Aprovação, voltar aos módulos">
            <span className="grid size-9 shrink-0 place-items-center rounded-xl bg-primary text-primary-foreground"><CircleDot aria-hidden="true" className="size-5" /></span>
            <span className="min-w-0 leading-tight group-data-[collapsible=icon]:hidden">
              <span className="block truncate text-sm font-bold tracking-tight">Operação Aprovação</span>
              <span className="mt-1 block truncate text-xs text-muted-foreground">Seu espaço pessoal</span>
            </span>
          </Link>
        </div>
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton render={<Link href="/" onClick={closeMobile} />} tooltip="Voltar aos módulos" className="h-9 px-3 font-medium">
              <ArrowLeft aria-hidden="true" /><span>Voltar aos módulos</span>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarHeader>

      <SidebarContent>
        <SidebarGroup className="px-3 py-1">
          {sectionHeading("main", "Principal")}
          {groups.main && (
            <SidebarGroupContent>
              <SidebarMenu className="gap-1">
                {mainNavigation.map(({ view: itemView, label, icon: Icon, href }) => {
                  const active = isMainActive(itemView);
                  return <SidebarMenuItem key={itemView}><SidebarMenuButton type="button" onClick={() => navigate(href, itemView)} isActive={active} aria-current={active ? "page" : undefined} tooltip={label} className="h-10 px-3 font-medium"><Icon aria-hidden="true" /><span>{label}</span></SidebarMenuButton></SidebarMenuItem>;
                })}
                <SidebarMenuItem>
                  <Popover>
                    <PopoverTrigger render={<SidebarMenuButton type="button" tooltip="Mais" aria-label="Abrir ferramentas adicionais" className="h-10 px-3 font-medium"><MoreHorizontal aria-hidden="true" /><span>Mais</span></SidebarMenuButton>} />
                    <PopoverContent side={compact ? "right" : "bottom"} align="start" className="w-56 p-2">
                      <p className="px-2 py-1 text-xs font-semibold uppercase tracking-wide text-muted-foreground">Mais ferramentas</p>
                      {([{ view: "recurring" as const, label: "Recorrentes", icon: RefreshCw, href: "/todo/recurring" }, { view: "weekly-review" as const, label: "Revisão semanal", icon: ClipboardCheck, href: "/todo/weekly-review" }]).map(({ view: itemView, label, icon: Icon, href }) => <Button key={itemView} variant="ghost" className="h-9 w-full justify-start" onClick={() => navigate(href, itemView)}><Icon aria-hidden="true" />{label}{pathname === href ? <span className="sr-only">, página atual</span> : null}</Button>)}
                    </PopoverContent>
                  </Popover>
                </SidebarMenuItem>
              </SidebarMenu>
            </SidebarGroupContent>
          )}
        </SidebarGroup>

        <SidebarGroup className="px-3 py-1">
          {sectionHeading("lists", "Listas")}
          {compact ? (
            <SidebarGroupContent><SidebarMenu><SidebarMenuItem>
              <Popover>
                <PopoverTrigger render={<SidebarMenuButton tooltip="Listas" aria-label="Abrir listas" className="h-9 justify-center"><UserRound aria-hidden="true" /></SidebarMenuButton>} />
                <PopoverContent side="right" align="start" className="w-64 p-2">
                  <p className="px-2 py-1 text-xs font-semibold uppercase tracking-wide text-muted-foreground">Listas</p>
                  {lists.map((list) => <Button key={list.id} variant="ghost" className="h-9 w-full justify-start" onClick={() => navigateList(list.id)}>{list.name}<Badge variant="secondary" className="ml-auto">{openCount(list.id)}</Badge></Button>)}
                  <Button variant="ghost" className="h-9 w-full justify-start" onClick={() => navigate("/todo", "lists")}><Layers3 aria-hidden="true" />Ver listas</Button>
                  <Button variant="ghost" className="h-9 w-full justify-start" onClick={() => setCreateListOpen(true)}><Plus aria-hidden="true" />Criar lista</Button>
                </PopoverContent>
              </Popover>
            </SidebarMenuItem></SidebarMenu></SidebarGroupContent>
          ) : groups.lists && (
            <SidebarGroupContent><SidebarMenu className="gap-1">
              {loading ? <SidebarMenuItem><Skeleton className="mx-2 h-8" /></SidebarMenuItem> : lists.map((list) => {
                const active = pathname === `/todo/lists/${list.id}` || (view === "list" && selectedListId === list.id);
                return <SidebarMenuItem key={list.id}><SidebarMenuButton type="button" onClick={() => navigateList(list.id)} isActive={active} aria-current={active ? "page" : undefined} tooltip={list.name} className="h-9 px-3"><ListTodo aria-hidden="true" /><span>{list.name}</span><Badge variant="secondary" className="ml-auto h-5 min-w-6 justify-center px-1 text-[10px] group-data-[collapsible=icon]:hidden">{openCount(list.id)}</Badge></SidebarMenuButton></SidebarMenuItem>;
              })}
              <SidebarMenuItem><SidebarMenuButton type="button" onClick={() => navigate("/todo", "lists")} isActive={view === "lists"} aria-current={view === "lists" ? "page" : undefined} tooltip="Ver listas" className="h-9 px-3 text-muted-foreground"><Layers3 aria-hidden="true" /><span>Ver listas</span></SidebarMenuButton></SidebarMenuItem>
              <SidebarMenuItem><SidebarMenuButton type="button" onClick={() => setCreateListOpen(true)} tooltip="Criar lista" className="h-9 px-3 text-muted-foreground"><Plus aria-hidden="true" /><span>Criar lista</span></SidebarMenuButton></SidebarMenuItem>
            </SidebarMenu></SidebarGroupContent>
          )}
        </SidebarGroup>

        <SidebarGroup className="px-3 py-1">
          {sectionHeading("workspaces", "Workspaces")}
          {compact ? (
            <SidebarGroupContent><SidebarMenu><SidebarMenuItem>
              <Popover>
                <PopoverTrigger render={<SidebarMenuButton tooltip="Workspaces" aria-label="Abrir workspaces" className="h-9 justify-center"><BriefcaseBusiness aria-hidden="true" /></SidebarMenuButton>} />
                <PopoverContent side="right" align="start" className="w-64 p-2">
                  <p className="px-2 py-1 text-xs font-semibold uppercase tracking-wide text-muted-foreground">Workspaces</p>
                  {workspaces.map((workspace) => <Button key={workspace.id} variant="ghost" className="h-9 w-full justify-start" onClick={() => navigateWorkspace(workspace.id)}>{workspace.name}<Badge variant="secondary" className="ml-auto">{tasksInWorkspace(workspace.id)}</Badge></Button>)}
                  <Button variant="ghost" className="h-9 w-full justify-start" onClick={() => navigate("/todo/workspaces")}><Layers3 aria-hidden="true" />Ver workspaces</Button>
                  <Button variant="ghost" className="h-9 w-full justify-start" onClick={() => navigate("/todo/workspaces")}><Plus aria-hidden="true" />Criar workspace</Button>
                </PopoverContent>
              </Popover>
            </SidebarMenuItem></SidebarMenu></SidebarGroupContent>
          ) : groups.workspaces && (
            <SidebarGroupContent><SidebarMenu className="gap-1">
              {loading ? <SidebarMenuItem><Skeleton className="mx-2 h-8" /></SidebarMenuItem> : workspaces.map((workspace) => {
                const active = pathname === `/todo/workspaces/${workspace.id}` || (view === "workspace" && selectedWorkspaceId === workspace.id);
                return <SidebarMenuItem key={workspace.id}><SidebarMenuButton type="button" onClick={() => navigateWorkspace(workspace.id)} isActive={active} aria-current={active ? "page" : undefined} tooltip={workspace.name} className="h-9 px-3"><BriefcaseBusiness aria-hidden="true" /><span>{workspace.name}</span><Badge variant="secondary" className="ml-auto h-5 min-w-6 justify-center px-1 text-[10px] group-data-[collapsible=icon]:hidden">{tasksInWorkspace(workspace.id)}</Badge></SidebarMenuButton></SidebarMenuItem>;
              })}
              <SidebarMenuItem><SidebarMenuButton type="button" onClick={() => navigate("/todo/workspaces")} isActive={pathname === "/todo/workspaces"} aria-current={pathname === "/todo/workspaces" ? "page" : undefined} tooltip="Ver workspaces" className="h-9 px-3 text-muted-foreground"><Layers3 aria-hidden="true" /><span>Ver workspaces</span></SidebarMenuButton></SidebarMenuItem>
              <SidebarMenuItem><SidebarMenuButton type="button" onClick={() => navigate("/todo/workspaces")} tooltip="Criar workspace" className="h-9 px-3 text-muted-foreground"><Plus aria-hidden="true" /><span>Criar workspace</span></SidebarMenuButton></SidebarMenuItem>
            </SidebarMenu></SidebarGroupContent>
          )}
        </SidebarGroup>
      </SidebarContent>

      <SidebarFooter className="gap-2 px-3 pb-4">
        <SidebarSeparator className="mb-1" />
        <SidebarMenu>
          <SidebarMenuItem><SidebarMenuButton type="button" onClick={() => navigate("/todo/settings")} isActive={pathname.startsWith("/todo/settings")} aria-current={pathname.startsWith("/todo/settings") ? "page" : undefined} tooltip="Configurações" className="h-9 px-3"><CheckSquare2 aria-hidden="true" /><span>Configurações</span></SidebarMenuButton></SidebarMenuItem>
        </SidebarMenu>
        <div className="flex min-w-0 items-center gap-3 px-2 py-1 group-data-[collapsible=icon]:justify-center group-data-[collapsible=icon]:px-0">
          <Avatar className="size-9 shrink-0"><AvatarFallback className="bg-secondary text-xs font-bold text-secondary-foreground">{initials(email)}</AvatarFallback></Avatar>
          <div className="min-w-0 flex-1 group-data-[collapsible=icon]:hidden"><p className="truncate text-xs font-semibold">{email}</p><p className="mt-0.5 text-[11px] text-muted-foreground">Conta autenticada</p></div>
        </div>
      </SidebarFooter>
      <CreateTodoListDialog open={createListOpen} onOpenChange={setCreateListOpen} onCreate={createList} />
    </>
  );
}

function CreateTodoListDialog({ open, onOpenChange, onCreate }: { open: boolean; onOpenChange: (open: boolean) => void; onCreate: (name: string) => Promise<boolean> }) {
  const [name, setName] = useState("");
  const [saving, setSaving] = useState(false);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const normalizedName = name.trim();
    if (!normalizedName || saving) return;
    setSaving(true);
    try {
      if (await onCreate(normalizedName)) setName("");
    } catch {
      toast.error("Não foi possível criar a lista. Tente novamente.");
    } finally {
      setSaving(false);
    }
  }

  return <Dialog open={open} onOpenChange={(nextOpen) => { if (!saving) { onOpenChange(nextOpen); if (!nextOpen) setName(""); } }}>
    <DialogContent className="sm:max-w-md">
      <DialogHeader><DialogTitle>Nova lista</DialogTitle><DialogDescription>Dê um nome para organizar suas tarefas.</DialogDescription></DialogHeader>
      <form className="space-y-4" onSubmit={(event) => void submit(event)}>
        <div className="space-y-2"><Label htmlFor="todo-create-list-name">Nome</Label><Input id="todo-create-list-name" autoFocus autoComplete="off" required maxLength={80} value={name} onChange={(event) => setName(event.target.value)} placeholder="Ex.: Casa, Estudos, Viagens" /></div>
        <DialogFooter><Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={saving}>Cancelar</Button><Button type="submit" disabled={!name.trim() || saving}>{saving ? "Criando…" : "Criar lista"}</Button></DialogFooter>
      </form>
    </DialogContent>
  </Dialog>;
}

function TodoLayoutContent({ children, email, userId }: { children: ReactNode; email: string; userId: string }) {
  const isMobile = useIsMobile();
  const [preferences, setPreferences] = useState<TodoSidebarPreferences>(DEFAULT_TODO_SIDEBAR_PREFERENCES);
  const [loadedStorageKey, setLoadedStorageKey] = useState<string | null>(null);
  const storageKey = todoSidebarStorageKey(userId);

  useEffect(() => {
    const frame = window.requestAnimationFrame(() => {
      let next = DEFAULT_TODO_SIDEBAR_PREFERENCES;
      try {
        next = parseTodoSidebarPreferences(window.localStorage.getItem(storageKey));
      } catch {
        // Storage may be unavailable; use the accessible expanded defaults.
      }
      setPreferences(next);
      setLoadedStorageKey(storageKey);
    });
    return () => window.cancelAnimationFrame(frame);
  }, [storageKey]);

  useEffect(() => {
    if (loadedStorageKey !== storageKey) return;
    try { window.localStorage.setItem(storageKey, JSON.stringify(preferences)); } catch { /* Storage may be unavailable; navigation remains usable. */ }
  }, [preferences, loadedStorageKey, storageKey]);

  const setCompact = useCallback((open: boolean) => {
    setPreferences((current) => ({ ...current, compact: !open }));
  }, []);

  const toggleGroup = useCallback((group: TodoSidebarGroup) => {
    setPreferences((current) => ({ ...current, groups: { ...current.groups, [group]: !current.groups[group] } }));
  }, []);

  return (
    <TodoDashboardProvider>
      <TooltipProvider>
        <SidebarProvider open={!preferences.compact || isMobile} onOpenChange={setCompact} cookieName={null}>
          <ShadcnSidebar collapsible="icon" className="border-sidebar-border">
            <TodoSidebarContent email={email} groups={preferences.groups} onToggleGroup={toggleGroup} />
          </ShadcnSidebar>
          <SidebarInset className="min-h-svh min-w-0 bg-muted/30">
            <header className="flex h-14 shrink-0 items-center justify-between border-b bg-background px-4 sm:px-6">
              <div className="flex items-center gap-3"><SidebarTrigger aria-label="Abrir menu no celular ou recolher a barra lateral" className="-ml-2" /><span className="inline-flex items-center gap-2 text-sm font-medium text-muted-foreground"><CheckSquare2 aria-hidden="true" className="size-4" /> Produtividade pessoal</span></div>
              <ThemeToggle />
            </header>
            {children}
          </SidebarInset>
        </SidebarProvider>
      </TooltipProvider>
    </TodoDashboardProvider>
  );
}

export function TodoLayout({ children, email, userId }: { children: ReactNode; email: string; userId: string }) {
  return <TodoLayoutContent email={email} userId={userId}>{children}</TodoLayoutContent>;
}
