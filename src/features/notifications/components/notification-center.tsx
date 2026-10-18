"use client";

import Link from "next/link";
import { useEffect, useState, useTransition } from "react";
import { Bell, BookOpen, CalendarCheck, Check, CheckCheck, CircleAlert, LoaderCircle, RefreshCw, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { NOTIFICATION_CATEGORY_LABELS, type NotificationItem } from "@/features/notifications/domain/types";

type LoadState = "idle" | "loading" | "ready" | "error" | "offline";

export function NotificationCenter() {
  const [open, setOpen] = useState(false);
  const [items, setItems] = useState<NotificationItem[]>([]);
  const [timezone, setTimezone] = useState("America/Sao_Paulo");
  const [state, setState] = useState<LoadState>("idle");
  const [busy, startTransition] = useTransition();
  const unreadCount = items.filter((item) => item.read_at === null).length;

  async function load() {
    if (!navigator.onLine) { setState("offline"); return; }
    setState("loading");
    try {
      const response = await fetch("/api/notifications", { cache: "no-store" });
      if (!response.ok) throw new Error("load");
      const result: unknown = await response.json();
      if (!isNotificationResponse(result)) throw new Error("shape");
      setItems(result.items);
      setTimezone(result.timezone);
      setState("ready");
    } catch {
      setState(navigator.onLine ? "error" : "offline");
    }
  }

  useEffect(() => {
    const onOnline = () => { if (open) void load(); };
    const onOffline = () => setState("offline");
    window.addEventListener("online", onOnline);
    window.addEventListener("offline", onOffline);
    return () => { window.removeEventListener("online", onOnline); window.removeEventListener("offline", onOffline); };
  }, [open]);

  function mutate(action: "read" | "dismiss" | "read-all", id?: string) {
    startTransition(async () => {
      try {
        const response = await fetch("/api/notifications", {
          method: "PATCH", headers: { "Content-Type": "application/json" },
          body: JSON.stringify(action === "read-all" ? { action } : { action, id }),
        });
        if (!response.ok) throw new Error("mutation");
        if (action === "read-all") setItems((current) => current.map((item) => ({ ...item, read_at: item.read_at ?? new Date().toISOString() })));
        else if (action === "dismiss") setItems((current) => current.filter((item) => item.id !== id));
        else setItems((current) => current.map((item) => item.id === id ? { ...item, read_at: new Date().toISOString() } : item));
      } catch {
        setState(navigator.onLine ? "error" : "offline");
      }
    });
  }

  function openActivity(item: NotificationItem) {
    if (item.read_at === null) mutate("read", item.id);
    setOpen(false);
  }

  return <>
    <Button variant="ghost" size="icon" aria-label={unreadCount ? `Notificações, ${unreadCount} não lidas` : "Notificações"} aria-expanded={open} onClick={() => { setOpen(true); void load(); }} className="relative">
      <Bell aria-hidden="true" />
      {unreadCount ? <span className="absolute -right-0.5 -top-0.5 flex size-4 items-center justify-center rounded-full bg-primary text-[10px] font-bold text-primary-foreground">{unreadCount > 9 ? "9+" : unreadCount}</span> : null}
    </Button>
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetContent side="right" className="w-full max-w-lg sm:w-[28rem]">
        <SheetHeader className="border-b px-5 py-5">
          <div className="flex items-center justify-between gap-4 pr-8">
            <div><SheetTitle className="text-lg">Notificações</SheetTitle><SheetDescription className="mt-1">Lembretes baseados no seu planejamento real.</SheetDescription></div>
            {unreadCount ? <Button variant="outline" size="sm" onClick={() => mutate("read-all")} disabled={busy}><CheckCheck aria-hidden="true" />Marcar lidas</Button> : null}
          </div>
        </SheetHeader>
        <div className="flex-1 overflow-y-auto px-5 py-4">
          {state === "loading" || state === "idle" ? <div role="status" className="flex items-center justify-center gap-2 py-16 text-sm text-muted-foreground"><LoaderCircle className="size-4 animate-spin" />Carregando…</div> : null}
          {state === "offline" ? <NoticeState icon={<CircleAlert />} title="Sem conexão" description="Conecte-se à internet para atualizar seus avisos. Os estudos registrados continuam preservados." action={<Button variant="outline" size="sm" onClick={() => void load()}><RefreshCw />Tentar novamente</Button>} /> : null}
          {state === "error" ? <NoticeState icon={<CircleAlert />} title="Não foi possível carregar" description="O serviço de notificações está indisponível neste momento." action={<Button variant="outline" size="sm" onClick={() => void load()}><RefreshCw />Tentar novamente</Button>} /> : null}
          {state === "ready" && items.length === 0 ? <NoticeState icon={<Bell />} title="Nenhuma notificação" description="Quando houver um bloco ou uma revisão real no horário configurado, o aviso aparecerá aqui." /> : null}
          {state === "ready" && items.length ? <div className="space-y-6">
            <NotificationGroup title="Não lidas" timezone={timezone} items={items.filter((item) => item.read_at === null)} onOpen={openActivity} onRead={(id) => mutate("read", id)} onDismiss={(id) => mutate("dismiss", id)} />
            <NotificationGroup title="Lidas" timezone={timezone} items={items.filter((item) => item.read_at !== null)} onOpen={openActivity} onRead={(id) => mutate("read", id)} onDismiss={(id) => mutate("dismiss", id)} />
          </div> : null}
        </div>
      </SheetContent>
    </Sheet>
  </>;
}

function NotificationGroup({ title, items, timezone, onOpen, onRead, onDismiss }: {
  timezone: string;
  title: string; items: NotificationItem[]; onOpen: (item: NotificationItem) => void;
  onRead: (id: string) => void; onDismiss: (id: string) => void;
}) {
  if (!items.length) return null;
  return <section aria-label={title}>
    <h3 className="mb-3 text-xs font-semibold uppercase tracking-wide text-muted-foreground">{title}</h3>
    <ul className="space-y-2">{items.map((item) => <li key={item.id} className={`rounded-xl border p-4 ${item.read_at === null ? "bg-primary/[0.035]" : "bg-background"}`}>
      <div className="flex items-start gap-3">
        <CategoryIcon category={item.category} />
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2"><Badge variant="secondary">{NOTIFICATION_CATEGORY_LABELS[item.category]}</Badge>{item.read_at === null ? <span className="size-1.5 rounded-full bg-primary" aria-label="Não lida" /> : null}</div>
          <h4 className="mt-2 text-sm font-semibold">{item.title}</h4><p className="mt-1 text-sm leading-5 text-muted-foreground">{item.body}</p>
          <time className="mt-2 block text-xs text-muted-foreground" dateTime={item.created_at}>{formatDate(item.created_at, timezone)}</time>
          <div className="mt-3 flex flex-wrap gap-2">
            <Button render={<Link href={item.target_url} onClick={() => onOpen(item)} />} size="sm">Abrir atividade</Button>
            {item.read_at === null ? <Button variant="outline" size="sm" onClick={() => onRead(item.id)}><Check />Marcar como lida</Button> : null}
            <Button variant="ghost" size="icon-sm" aria-label="Dispensar notificação" onClick={() => onDismiss(item.id)}><X /></Button>
          </div>
        </div>
      </div>
    </li>)}</ul>
  </section>;
}

function CategoryIcon({ category }: { category: NotificationItem["category"] }) {
  const Icon = category === "study" ? BookOpen : category === "review" ? CalendarCheck : CircleAlert;
  return <span className="mt-0.5 flex size-9 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary"><Icon aria-hidden="true" className="size-4" /></span>;
}

function NoticeState({ icon, title, description, action }: { icon: React.ReactNode; title: string; description: string; action?: React.ReactNode }) {
  return <div className="flex flex-col items-center px-5 py-16 text-center"><span className="flex size-12 items-center justify-center rounded-2xl bg-muted text-muted-foreground">{icon}</span><h3 className="mt-4 text-sm font-semibold">{title}</h3><p className="mt-2 max-w-xs text-sm text-muted-foreground">{description}</p>{action ? <div className="mt-4">{action}</div> : null}</div>;
}

function formatDate(value: string, timezone: string) {
  try {
    return new Intl.DateTimeFormat("pt-BR", { dateStyle: "short", timeStyle: "short", timeZone: timezone }).format(new Date(value));
  } catch {
    return new Intl.DateTimeFormat("pt-BR", { dateStyle: "short", timeStyle: "short", timeZone: "America/Sao_Paulo" }).format(new Date(value));
  }
}

function isNotificationResponse(value: unknown): value is { items: NotificationItem[]; timezone: string } {
  return typeof value === "object" && value !== null && "items" in value && Array.isArray(value.items) && "timezone" in value && typeof value.timezone === "string";
}
