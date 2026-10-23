"use client";

import { useCallback, useEffect, useState } from "react";
import { Archive, LoaderCircle, RotateCcw, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { loadTodoListsAction, loadTodoTasksAction, todoTaskAction } from "@/features/todo/actions";
import type { TodoList, TodoTask } from "@/features/todo/domain/types";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";

type View = "trash" | "archived";

function timeLabel(value: string | null) {
  if (!value) return "";
  return new Intl.DateTimeFormat("pt-BR", { dateStyle: "medium", timeStyle: "short" }).format(new Date(value));
}

export function TodoLifecycleSettingsPage() {
  const [view, setView] = useState<View>("trash");
  const [trash, setTrash] = useState<TodoTask[]>([]);
  const [archived, setArchived] = useState<TodoTask[]>([]);
  const [lists, setLists] = useState<TodoList[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<TodoTask | null>(null);
  const [permanentlyDeleting, setPermanentlyDeleting] = useState(false);

  const refresh = useCallback(async () => {
    setError(null);
    const [listResult, trashResult, archivedResult] = await Promise.all([
      loadTodoListsAction(),
      loadTodoTasksAction({ lifecycle: "trash" }),
      loadTodoTasksAction({ lifecycle: "archived" }),
    ]);
    if (!listResult.ok || !trashResult.ok || !archivedResult.ok) {
      setError(!listResult.ok ? listResult.message : !trashResult.ok ? trashResult.message : !archivedResult.ok ? archivedResult.message : "Não foi possível carregar as tarefas.");
      return;
    }
    setLists(listResult.data as TodoList[]);
    setTrash(trashResult.data as TodoTask[]);
    setArchived(archivedResult.data as TodoTask[]);
  }, []);

  useEffect(() => {
    const frame = window.requestAnimationFrame(() => { void refresh().finally(() => setLoading(false)); });
    return () => window.cancelAnimationFrame(frame);
  }, [refresh]);

  const rows = view === "trash" ? trash : archived;
  const taskList = (task: TodoTask) => lists.find((list) => list.id === task.list_id)?.name ?? "Lista indisponível";

  async function restore(task: TodoTask) {
    setBusyId(task.id);
    try {
      const result = await todoTaskAction({ operation: "restore", id: task.id });
      if (!result.ok) { toast.error(result.message); return; }
      setTrash((current) => current.filter((item) => item.id !== task.id));
      setArchived((current) => current.filter((item) => item.id !== task.id));
      try { await refresh(); } catch { toast.warning("A tarefa foi restaurada, mas a tela ainda não foi atualizada."); }
      toast.success("Tarefa restaurada para a lista de origem.");
    } catch { toast.error("Não foi possível restaurar a tarefa."); }
    finally { setBusyId(null); }
  }

  async function deletePermanently() {
    if (!deleteTarget || permanentlyDeleting) return;
    setPermanentlyDeleting(true);
    try {
      const result = await todoTaskAction({ operation: "delete_permanently", id: deleteTarget.id });
      if (!result.ok) { toast.error(result.message); return; }
      setTrash((current) => current.filter((item) => item.id !== deleteTarget.id));
      setDeleteTarget(null);
      try { await refresh(); } catch { toast.warning("A tarefa foi excluída, mas os itens restantes não foram recarregados."); }
      toast.success("Tarefa excluída definitivamente.");
    } catch { toast.error("Não foi possível excluir a tarefa definitivamente."); }
    finally { setPermanentlyDeleting(false); }
  }

  if (loading) return <main className="mx-auto w-full max-w-4xl space-y-5 p-4 sm:p-6"><Skeleton className="h-20 w-2/3" /><Skeleton className="h-12" /><Skeleton className="h-48" /></main>;

  return <>
    <main className="mx-auto w-full max-w-4xl space-y-5 p-4 sm:p-6 xl:p-8">
      <header><p className="text-xs font-semibold uppercase tracking-[0.14em] text-primary">Configurações do To-Do</p><h1 className="mt-2 text-2xl font-bold tracking-tight sm:text-3xl">Itens arquivados e lixeira</h1><p className="mt-2 text-sm text-muted-foreground">Restaure tarefas para a lista de origem ou remova da lixeira quando tiver certeza.</p></header>
      <Alert><Archive className="size-4" /><AlertTitle>Retenção de 30 dias</AlertTitle><AlertDescription>A política do produto prevê 30 dias na lixeira. A remoção automática ainda não está habilitada; os itens permanecem aqui até serem restaurados ou excluídos manualmente.</AlertDescription></Alert>
      <div className="flex flex-wrap gap-2" role="tablist" aria-label="Estado das tarefas">
        <Button type="button" role="tab" aria-selected={view === "trash"} variant={view === "trash" ? "default" : "outline"} onClick={() => setView("trash")}>Lixeira <Badge variant={view === "trash" ? "secondary" : "outline"} className="ml-1">{trash.length}</Badge></Button>
        <Button type="button" role="tab" aria-selected={view === "archived"} variant={view === "archived" ? "default" : "outline"} onClick={() => setView("archived")}>Arquivadas <Badge variant={view === "archived" ? "secondary" : "outline"} className="ml-1">{archived.length}</Badge></Button>
      </div>
      {error ? <Alert variant="destructive"><AlertTitle>Não foi possível carregar os itens</AlertTitle><AlertDescription className="mt-2 flex flex-wrap items-center justify-between gap-3">{error}<Button variant="outline" size="sm" onClick={() => void refresh()}>Tentar novamente</Button></AlertDescription></Alert> : rows.length ? <section className="divide-y rounded-xl border" aria-label={view === "trash" ? "Tarefas na lixeira" : "Tarefas arquivadas"}>{rows.map((task) => {
        const timestamp = view === "trash" ? task.deleted_at : task.archived_at;
        return <article key={task.id} className="flex min-w-0 flex-col gap-3 p-4 sm:flex-row sm:items-center">
          <div className="min-w-0 flex-1"><div className="flex flex-wrap items-center gap-2"><h2 className="break-words text-sm font-semibold">{task.title}</h2><Badge variant="outline">{taskList(task)}</Badge></div><p className="mt-1 text-xs text-muted-foreground">{view === "trash" ? "Enviada para a lixeira" : "Arquivada"}{timestamp ? ` em ${timeLabel(timestamp)}` : ""}</p></div>
          <div className="flex shrink-0 gap-2"><Button type="button" variant="outline" size="sm" disabled={busyId === task.id} onClick={() => void restore(task)}>{busyId === task.id ? <LoaderCircle className="size-4 animate-spin" /> : <RotateCcw className="size-4" />}Restaurar</Button>{view === "trash" ? <Button type="button" variant="ghost" size="sm" className="text-destructive hover:bg-destructive/10 hover:text-destructive" disabled={busyId === task.id} onClick={() => setDeleteTarget(task)}><Trash2 className="size-4" />Excluir definitivamente</Button> : null}</div>
        </article>;
      })}</section> : <Card className="shadow-none"><CardContent className="py-10 text-center"><p className="text-sm font-medium">{view === "trash" ? "A lixeira está vazia." : "Nenhuma tarefa arquivada."}</p><p className="mt-1 text-sm text-muted-foreground">{view === "trash" ? "Tarefas movidas para a lixeira aparecerão aqui." : "Tarefas arquivadas aparecerão aqui e poderão ser restauradas."}</p></CardContent></Card>}
    </main>
    <AlertDialog open={deleteTarget !== null} onOpenChange={(open) => { if (!open && !permanentlyDeleting) setDeleteTarget(null); }}><AlertDialogContent><AlertDialogHeader><AlertDialogTitle>Excluir tarefa definitivamente?</AlertDialogTitle><AlertDialogDescription><span className="mb-1 block font-medium text-foreground">{deleteTarget?.title}</span>Esta ação não pode ser desfeita. Também serão removidos as subtarefas, os vínculos de etiquetas e o histórico desta tarefa.</AlertDialogDescription></AlertDialogHeader><AlertDialogFooter className="flex-col sm:flex-row"><AlertDialogCancel disabled={permanentlyDeleting}>Cancelar</AlertDialogCancel><AlertDialogAction variant="ghost" className="text-destructive hover:bg-destructive/10 hover:text-destructive" disabled={permanentlyDeleting} onClick={(event) => { event.preventDefault(); void deletePermanently(); }}>{permanentlyDeleting ? <LoaderCircle className="size-4 animate-spin" /> : <Trash2 className="size-4" />}Excluir definitivamente</AlertDialogAction></AlertDialogFooter></AlertDialogContent></AlertDialog>
  </>;
}
