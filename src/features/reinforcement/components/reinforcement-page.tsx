"use client";

import Link from "next/link";
import { useMemo, useState, useTransition } from "react";
import { ArrowLeft, ArrowRight, CircleAlert, Info, RefreshCw, Sparkles } from "lucide-react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { AppShell } from "@/components/app-shell";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { applyReinforcementPlanAction } from "@/features/reinforcement/actions";
import { buildReplanPreview, type ReinforcementRecommendation, type ReplanBlock } from "@/features/reinforcement/domain/recommendations";
import { formatShortDate } from "@/features/planning/domain/dates";

type ReinforcementPageData = {
  email: string;
  today: string;
  from: string;
  dailyGoalMinutes: number;
  recommendations: ReinforcementRecommendation[];
  plannerBlocks: ReplanBlock[];
  hasQuestionHistory: boolean;
  protectedBlockCount: number;
};

export function ReinforcementPage({ data }: { data: ReinforcementPageData }) {
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [previewOpen, setPreviewOpen] = useState(false);
  const [pending, startTransition] = useTransition();
  const router = useRouter();
  const selected = data.recommendations.filter((item) => selectedIds.includes(item.topicId) && item.signal === "high");
  const displaceableTopicIds = useMemo(() => new Set(data.recommendations.filter((item) => item.signal === "monitor").map((item) => item.topicId)), [data.recommendations]);
  const changes = useMemo(() => buildReplanPreview({ blocks: data.plannerBlocks, selected, displaceableTopicIds, today: data.today, dailyGoalMinutes: data.dailyGoalMinutes }), [data.plannerBlocks, data.today, data.dailyGoalMinutes, selected, displaceableTopicIds]);
  const eligible = data.recommendations.filter((item) => item.signal === "high");
  const todayFormatted = formatShortDate(data.today);
  const sampleStart = formatShortDate(data.from);
  const noWeakSignals = eligible.length === 0 && (data.hasQuestionHistory || data.recommendations.length > 0);

  function toggleTopic(topicId: string) {
    setSelectedIds((current) => current.includes(topicId) ? current.filter((id) => id !== topicId) : [...current, topicId]);
  }

  function applyPlan() {
    const expected = data.plannerBlocks.filter((block) => block.date >= data.today && block.status === "planejado").map((block) => ({
      id: block.id, topic_id: block.topicId, planned_date: block.date, planned_minutes: block.minutes,
      planned_start_time: block.startTime, status: "planejado" as const, pinned: block.pinned, updated_at: block.updatedAt,
    }));
    const payload = {
      revisionId: crypto.randomUUID(), expected,
      changes: changes.map(({ blockId, before, after }) => ({
        id: blockId, before_topic_id: before.topicId, before_date: before.date,
        after_topic_id: after.topicId, after_date: after.date,
      })),
    };
    startTransition(async () => {
      const result = await applyReinforcementPlanAction(payload);
      if (!result.ok) {
        toast.error(result.message);
        return;
      }
      toast.success("Plano de reforço aplicado ao seu planejamento.");
      setPreviewOpen(false);
      router.push("/planejamento");
    });
  }

  return (
    <AppShell email={data.email} activeItem="planejamento">
      <main className="mx-auto w-full max-w-[1240px] flex-1 px-5 pb-8 pt-8 sm:px-8 sm:pt-10 lg:px-10">
        <header className="mb-7 flex flex-col gap-5 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <Link href="/planejamento" className="mb-4 inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground"><ArrowLeft aria-hidden="true" className="size-4" />Voltar ao calendário</Link>
            <p className="text-xs font-bold uppercase tracking-[0.14em] text-primary">Evolução baseada em registros</p>
            <h1 className="mt-2 text-3xl font-bold tracking-tight sm:text-[34px]">Plano de reforço</h1>
            <p className="mt-2 max-w-2xl text-sm text-muted-foreground">Mais atenção aos pontos que seus registros indicam, mantendo o controle do planejamento.</p>
          </div>
          <Badge variant="secondary" className="w-fit">Dados de {sampleStart} a {todayFormatted}</Badge>
        </header>

        <Card className="shadow-sm">
          <CardHeader className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
            <div><CardTitle>Oportunidades de reforço</CardTitle><CardDescription className="mt-2">Sugestões baseadas nos seus registros canônicos de questões dos últimos 30 dias.</CardDescription></div>
            <Badge variant="outline">{eligible.length} {eligible.length === 1 ? "sinal" : "sinais"} de reforço</Badge>
          </CardHeader>
          <CardContent>
            {!data.hasQuestionHistory && data.recommendations.length === 0 ? (
              <div className="rounded-xl border border-dashed px-5 py-12 text-center">
                <CircleAlert aria-hidden="true" className="mx-auto size-8 text-muted-foreground" />
                <h2 className="mt-4 font-semibold">Registre questões para descobrir quais tópicos reforçar</h2>
                <p className="mx-auto mt-2 max-w-lg text-sm text-muted-foreground">Não há registros de questões neste período. O plano não cria resultados ou dificuldades por conta própria.</p>
                <Button render={<Link href="/registros" />} variant="outline" className="mt-4">Ir para Registros</Button>
              </div>
            ) : data.recommendations.length === 0 ? (
              <div className="rounded-xl border border-dashed px-5 py-12 text-center">
                <Sparkles aria-hidden="true" className="mx-auto size-8 text-muted-foreground" />
                <h2 className="mt-4 font-semibold">Sem sinais suficientes de dificuldade no período</h2>
                <p className="mx-auto mt-2 max-w-lg text-sm text-muted-foreground">Não foram encontrados tópicos com pelo menos 10 questões e aproveitamento abaixo de 70%.</p>
              </div>
            ) : (
              <>
              {noWeakSignals ? <p className="mb-4 rounded-lg border border-primary/15 bg-primary/5 px-3 py-2 text-sm text-muted-foreground">Sem sinais suficientes de dificuldade no período. Acompanhe os tópicos e continue registrando seus estudos.</p> : null}
              <div className="divide-y">
                {data.recommendations.map((item) => {
                  const canSelect = item.signal === "high";
                  return <label key={item.topicId} className={`flex items-start gap-3 py-4 first:pt-0 last:pb-0 ${canSelect ? "cursor-pointer" : ""}`}>
                    {canSelect ? <input type="checkbox" checked={selectedIds.includes(item.topicId)} onChange={() => toggleTopic(item.topicId)} aria-label={`Selecionar ${item.topic} para reforço`} className="mt-1 size-4 shrink-0 accent-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring" /> : <span aria-hidden="true" className="mt-1 size-4 shrink-0" />}
                    <div className="grid size-10 shrink-0 place-items-center rounded-xl bg-primary/8 text-primary"><Sparkles aria-hidden="true" className="size-4" /></div>
                    <div className="min-w-0 flex-1">
                      <p className="font-semibold">{item.topic}</p>
                      <p className="mt-1 text-sm text-muted-foreground">{item.subject}
                        {item.questions > 0 ? <> · {formatPercent(item.accuracy)} de acertos · {item.questions} {item.questions === 1 ? "questão" : "questões"}</> : null}
                      </p>
                      {item.flaggedForReview ? <p className="mt-1 text-xs text-amber-700 dark:text-amber-300">Marcado “Precisa revisar” no caderno de erros (sinal qualitativo, sem contagem adicional).</p> : null}
                    </div>
                    <div className="flex max-w-48 flex-col items-end gap-1 text-right">
                      <Badge variant={item.signal === "high" ? "outline" : "secondary"} className={item.signal === "high" ? "border-amber-500/30 bg-amber-500/10 text-amber-800 dark:text-amber-300" : ""}>{item.signal === "high" ? "Reforço indicado" : item.signal === "insufficient" ? "Amostra insuficiente" : "Acompanhar"}</Badge>
                      {item.signal === "insufficient" ? <span className="text-xs text-muted-foreground">Abaixo de 10 tentativas</span> : null}
                    </div>
                  </label>;
                })}
              </div>
              </>
            )}

            <Alert className="mt-5">
              <Info aria-hidden="true" />
              <AlertDescription>Regra de triagem: abaixo de 70% em pelo menos 10 questões no período. É uma heurística de organização, não uma nota mínima oficial nem previsão de aprovação.</AlertDescription>
            </Alert>
          </CardContent>
        </Card>

        <Card className="mt-5 shadow-sm">
          <CardHeader className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
            <div><CardTitle>Prévia de ajuste do planejamento</CardTitle><CardDescription className="mt-2">Nenhum bloco muda sem confirmação. A proposta troca um bloco futuro e mostra onde o conteúdo deslocado será realocado.</CardDescription></div>
            <Button onClick={() => setPreviewOpen(true)} disabled={!selected.length} className="shrink-0"><RefreshCw aria-hidden="true" />Criar plano de reforço</Button>
          </CardHeader>
          <CardContent>
            <div className="grid gap-4 border-t pt-5 sm:grid-cols-2">
              <div><p className="text-xs font-medium uppercase text-muted-foreground">Planejamento atual</p><p className="mt-2 text-2xl font-semibold">{formatHours(data.dailyGoalMinutes)} / dia</p><p className="mt-1 text-sm text-muted-foreground">Sua meta diária permanece configurada.</p></div>
              <div><p className="text-xs font-medium uppercase text-muted-foreground">Com o reforço</p><p className="mt-2 text-2xl font-semibold">{formatHours(data.dailyGoalMinutes)} / dia</p><p className="mt-1 text-sm text-muted-foreground">Substituição e realocação preservam a meta diária.</p></div>
            </div>
            {data.protectedBlockCount > 0 ? <p className="mt-5 text-xs text-muted-foreground">{data.protectedBlockCount} bloco(s) vinculados a concursos com prova em até 30 dias permanecem protegidos contra substituição.</p> : null}
          </CardContent>
        </Card>

        <div className="mt-4 flex items-start gap-2 rounded-xl border border-primary/10 bg-primary/5 px-4 py-3 text-sm text-muted-foreground"><Info aria-hidden="true" className="mt-0.5 size-4 shrink-0 text-primary" /><p>Estudos concluídos, blocos fixados e revisões de sessões concluídas não serão alterados. Se a proposta não encontrar espaço compatível com a carga diária, nenhum ajuste será aplicado.</p></div>
      </main>

      <Dialog open={previewOpen} onOpenChange={setPreviewOpen}>
        <DialogContent className="max-h-[90svh] overflow-y-auto sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle>Prévia do plano de reforço</DialogTitle>
            <DialogDescription>Confira cada bloco original e o destino proposto antes de aplicar.</DialogDescription>
          </DialogHeader>
          {changes.length === 0 ? <div className="rounded-lg border border-dashed p-5 text-sm text-muted-foreground">Não encontrei dois blocos futuros, pendentes e não fixados no mesmo dia para fazer a substituição sem aumentar sua carga. Seu planejamento continua intacto.</div> : <>
            <div className="space-y-3">
              {changes.map(({ blockId, before, after }) => <div key={blockId} className="grid gap-3 rounded-lg border p-3 sm:grid-cols-[1fr_auto_1fr] sm:items-center">
                <div><p className="text-[11px] font-semibold uppercase text-muted-foreground">Antes · {formatShortDate(before.date)}</p><p className="mt-1 text-sm font-medium">{before.subject} · {before.topic}</p><p className="mt-1 text-xs text-muted-foreground">{before.minutes} min{before.startTime ? ` · ${before.startTime.slice(0, 5)}` : ""}</p></div>
                <ArrowRight aria-hidden="true" className="hidden size-4 text-muted-foreground sm:block" />
                <div><p className="text-[11px] font-semibold uppercase text-muted-foreground">Proposta · {formatShortDate(after.date)}</p><p className="mt-1 text-sm font-medium">{after.subject} · {after.topic}</p><p className="mt-1 text-xs text-muted-foreground">{after.minutes} min{after.startTime ? ` · ${after.startTime.slice(0, 5)}` : ""}</p></div>
              </div>)}
            </div>
            <div className="rounded-lg bg-muted/50 p-3 text-sm">
              <p className="font-medium">Resumo desta proposta</p>
              <ul className="mt-2 space-y-1 text-muted-foreground">
                <li>{changes.length} blocos futuros serão alterados, considerando as realocações exibidas.</li>
                <li>Minutos totais planejados permanecem iguais; a meta diária continua em {formatHours(data.dailyGoalMinutes)}.</li>
                {getWeeklyDelta(changes).map(({ week, minutes }) => <li key={week}>Semana de {formatShortDate(week)}: {minutes > 0 ? "+" : ""}{minutes} min planejados.</li>)}
                <li>Histórico concluído e revisões vinculadas permanecem intactos.</li>
              </ul>
            </div>
          </>}
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setPreviewOpen(false)} disabled={pending}>Cancelar</Button>
            <Button type="button" onClick={applyPlan} disabled={pending || changes.length === 0}>{pending ? "Aplicando…" : "Aplicar alterações"}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </AppShell>
  );
}

function formatPercent(value: number | null): string {
  if (value === null) return "Sem dados";
  return `${new Intl.NumberFormat("pt-BR", { maximumFractionDigits: 1 }).format(value)}%`;
}

function formatHours(minutes: number): string {
  const hours = Math.floor(minutes / 60);
  const rest = minutes % 60;
  if (hours && rest) return `${hours}h ${rest}min`;
  return hours ? `${hours}h` : `${rest}min`;
}

function getWeeklyDelta(changes: ReturnType<typeof buildReplanPreview>): { week: string; minutes: number }[] {
  const totals = new Map<string, number>();
  for (const { before, after } of changes) {
    const previousWeek = getMonday(before.date);
    const nextWeek = getMonday(after.date);
    totals.set(previousWeek, (totals.get(previousWeek) ?? 0) - before.minutes);
    totals.set(nextWeek, (totals.get(nextWeek) ?? 0) + after.minutes);
  }
  return [...totals].filter(([, minutes]) => minutes !== 0).sort(([a], [b]) => a.localeCompare(b)).map(([week, minutes]) => ({ week, minutes }));
}

function getMonday(date: string): string {
  const [year, month, day] = date.split("-").map(Number);
  const value = new Date(Date.UTC(year, month - 1, day));
  const weekday = value.getUTCDay();
  value.setUTCDate(value.getUTCDate() - (weekday === 0 ? 6 : weekday - 1));
  return value.toISOString().slice(0, 10);
}
