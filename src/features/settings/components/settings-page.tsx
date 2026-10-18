"use client";

import Link from "next/link";
import { useState, useTransition, type FormEvent } from "react";
import { CalendarClock, Check, Download, Info, LoaderCircle } from "lucide-react";
import { toast } from "sonner";
import { useRouter } from "next/navigation";
import { AppShell } from "@/components/app-shell";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { saveStudyPreferencesAction } from "@/features/settings/actions";
import { NotificationPreferences } from "@/features/notifications/components/notification-preferences";
import { WEEKDAY_OPTIONS } from "@/features/settings/domain/settings";
import type { StudyPreferences } from "@/features/settings/domain/settings";

type ExportKind = "json" | "csv";
type SettingsPageData = { email: string; preferences: StudyPreferences; notificationPreferences: Parameters<typeof NotificationPreferences>[0]["initial"] };

const TIMEZONE_SUGGESTIONS = [
  "America/Sao_Paulo", "America/Manaus", "America/Rio_Branco", "America/Noronha", "America/Belem",
  "America/Fortaleza", "America/Recife", "America/Bahia", "America/Cuiaba", "America/Porto_Velho",
  "America/New_York", "America/Chicago", "America/Denver", "America/Los_Angeles", "America/Toronto",
  "Europe/Lisbon", "Europe/London", "Europe/Paris", "Europe/Berlin", "Europe/Madrid", "Europe/Rome",
  "Asia/Tokyo", "Asia/Shanghai", "Asia/Dubai", "Australia/Sydney", "UTC",
];

export function SettingsPage({ data }: { data: SettingsPageData }) {
  const [dailyGoal, setDailyGoal] = useState(String(data.preferences.dailyGoalMinutes));
  const [timezone, setTimezone] = useState(data.preferences.timezone);
  const [weekdays, setWeekdays] = useState<number[]>(data.preferences.weekdays);
  const [saving, startSave] = useTransition();
  const [exporting, setExporting] = useState<ExportKind | null>(null);
  const [exportError, setExportError] = useState<string | null>(null);
  const router = useRouter();

  function toggleWeekday(value: number) {
    setWeekdays((current) => current.includes(value) ? current.filter((day) => day !== value) : [...current, value]);
  }

  function savePreferences(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const payload = { dailyGoalMinutes: Number(dailyGoal), timezone, weekdays };
    startSave(async () => {
      const result = await saveStudyPreferencesAction(payload);
      if (!result.ok) {
        toast.error(result.message);
        return;
      }
      toast.success("Preferências salvas.");
      router.refresh();
    });
  }

  async function downloadExport(kind: ExportKind) {
    setExporting(kind);
    setExportError(null);
    try {
      const response = await fetch(`/api/export/${kind}`, { method: "GET", cache: "no-store" });
      if (!response.ok) {
        const body: unknown = await response.json().catch(() => null);
        const message = isErrorBody(body) ? body.error : "Não foi possível criar a cópia agora.";
        throw new Error(message);
      }
      const blob = await response.blob();
      const filename = kind === "json" ? "operacao-aprovacao-dados-v1.json" : "operacao-aprovacao-questoes.csv";
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement("a");
      anchor.href = url;
      anchor.download = filename;
      document.body.append(anchor);
      anchor.click();
      anchor.remove();
      window.setTimeout(() => URL.revokeObjectURL(url), 1000);
      toast.success(`${kind.toUpperCase()} preparado; o download foi iniciado neste dispositivo.`);
    } catch (error) {
      const message = error instanceof Error ? error.message : "Falha inesperada na exportação.";
      setExportError(`${message} Você pode tentar novamente.`);
      toast.error("A exportação não foi concluída.");
    } finally {
      setExporting(null);
    }
  }

  return (
    <AppShell email={data.email} activeItem="configuracoes">
      <main className="app-page">
        <header className="mb-6">
          <p className="text-xs font-bold uppercase tracking-[0.14em] text-primary">Sua conta</p>
          <h1 className="mt-2 text-3xl font-bold tracking-tight sm:text-[34px]">Configurações</h1>
          <p className="mt-2 text-sm text-muted-foreground">Ajuste sua rotina e mantenha uma cópia pessoal dos dados de estudo.</p>
        </header>

        <Card className="max-w-[800px] shadow-sm">
          <CardHeader className="pb-4">
            <CardTitle>Rotina de estudos</CardTitle>
            <CardDescription>Essas preferências ficam no seu perfil. Alterá-las não reorganiza seus blocos nem reescreve datas já registradas.</CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={savePreferences} className="space-y-5">
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="daily-goal">Meta diária disponível (minutos)</Label>
                  <Input id="daily-goal" type="number" min={15} max={960} step={15} value={dailyGoal} onChange={(event) => setDailyGoal(event.target.value)} required aria-describedby="daily-goal-help" />
                  <p id="daily-goal-help" className="text-xs text-muted-foreground">De 15 minutos a 16 horas; em intervalos de 15 minutos.</p>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="study-timezone">Fuso horário (IANA)</Label>
                  <Input id="study-timezone" list="study-timezone-options" value={timezone} onChange={(event) => setTimezone(event.target.value)} autoComplete="off" required aria-describedby="timezone-help" />
                  <datalist id="study-timezone-options">{TIMEZONE_SUGGESTIONS.map((item) => <option key={item} value={item} />)}</datalist>
                  <p id="timezone-help" className="text-xs text-muted-foreground">Exemplo: America/Sao_Paulo. Você também pode digitar outro fuso IANA válido.</p>
                </div>
              </div>

              <fieldset className="space-y-3">
                <legend className="text-sm font-medium">Dias disponíveis para estudar</legend>
                <div className="flex flex-wrap gap-2">
                  {WEEKDAY_OPTIONS.map((day) => {
                    const selected = weekdays.includes(day.value);
                    return <label key={day.value} className={`inline-flex cursor-pointer items-center gap-2 rounded-lg border px-3 py-2 text-sm transition-colors focus-within:ring-2 focus-within:ring-ring ${selected ? "border-primary/25 bg-primary/8 text-primary" : "bg-background text-muted-foreground hover:bg-muted/50"}`}>
                      <input type="checkbox" checked={selected} onChange={() => toggleWeekday(day.value)} aria-label={day.fullLabel} className="size-4 accent-primary focus-visible:outline-none" />
                      {day.label}
                    </label>;
                  })}
                </div>
                <p className="text-xs text-muted-foreground">Pelo menos um dia deve permanecer selecionado. Salvar não move blocos existentes.</p>
              </fieldset>

              <Button type="submit" disabled={saving} className="min-w-48">
                {saving ? <><LoaderCircle aria-hidden="true" className="animate-spin" />Salvando…</> : <><Check aria-hidden="true" />Salvar preferências</>}
              </Button>
            </form>

            <Alert className="mt-5">
              <CalendarClock aria-hidden="true" />
              <AlertDescription className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                <span>Mudar meta diária ou fuso não altera seu histórico nem reorganiza o calendário automaticamente.</span>
                <Button render={<Link href="/planejamento" />} variant="outline" size="sm" className="w-fit shrink-0">Revisar planejamento</Button>
              </AlertDescription>
            </Alert>

            <Separator className="my-7" />

            <NotificationPreferences initial={data.notificationPreferences} timezone={timezone} weekdays={weekdays} />

            <Separator className="my-7" />

            <section aria-labelledby="settings-export-heading">
              <h2 id="settings-export-heading" className="text-lg font-semibold">Seus dados</h2>
              <p className="mt-1 text-sm text-muted-foreground">Exporte seus registros para guardar uma cópia local no seu dispositivo.</p>

              <div className="mt-4 flex flex-col gap-3 rounded-xl border p-4 sm:flex-row sm:items-center sm:justify-between">
                <div><h3 className="text-sm font-semibold">Aplicativos conectados</h3><p className="mt-1 text-sm text-muted-foreground">Revise ou revogue o acesso OAuth concedido a outros aplicativos.</p></div>
                <Button render={<Link href="/configuracoes/conexoes" />} variant="outline" className="shrink-0">Gerenciar conexões</Button>
              </div>

              <div className="mt-5 space-y-3">
                <ExportRow title="Exportar histórico" description="Matérias, tópicos, planejamento, sessões, questões, caderno de erros, revisões e concursos." kind="json" busy={exporting === "json"} disabled={exporting !== null} onDownload={downloadExport} />
                <ExportRow title="Exportar planilha" description="Todos os lotes de questões, inclusive os removidos logicamente, em CSV com proteção contra fórmulas." kind="csv" busy={exporting === "csv"} disabled={exporting !== null} onDownload={downloadExport} />
              </div>
              {exporting ? <p role="status" aria-live="polite" className="mt-3 flex items-center gap-2 text-sm text-muted-foreground"><LoaderCircle aria-hidden="true" className="size-4 animate-spin" />Preparando exportação {exporting.toUpperCase()}…</p> : null}
              {exportError ? <Alert variant="destructive" className="mt-4"><Info aria-hidden="true" /><AlertDescription>{exportError} Use o botão de download para tentar novamente.</AlertDescription></Alert> : null}
            </section>

            <Alert className="mt-5 border-primary/15 bg-primary/5 text-muted-foreground">
              <Info aria-hidden="true" />
              <AlertDescription>A exportação inicia um download para este dispositivo. Ela não exclui registros, não muda seu planejamento e não guarda uma cópia em outro lugar.</AlertDescription>
            </Alert>
          </CardContent>
        </Card>
      </main>
    </AppShell>
  );
}

function ExportRow({ title, description, kind, busy, disabled, onDownload }: {
  title: string;
  description: string;
  kind: ExportKind;
  busy: boolean;
  disabled: boolean;
  onDownload: (kind: ExportKind) => void;
}) {
  return <div className="flex flex-col gap-4 rounded-xl border p-4 sm:flex-row sm:items-center sm:justify-between">
    <div className="min-w-0"><h3 className="text-sm font-semibold">{title}</h3><p className="mt-1 text-sm text-muted-foreground">{description}</p></div>
    <Button type="button" variant="outline" disabled={disabled} onClick={() => onDownload(kind)} className="shrink-0 sm:min-w-52">
      {busy ? <><LoaderCircle aria-hidden="true" className="animate-spin" />Preparando…</> : <><Download aria-hidden="true" />Baixar {kind.toUpperCase()}</>}
    </Button>
  </div>;
}

function isErrorBody(value: unknown): value is { error: string } {
  return typeof value === "object" && value !== null && "error" in value && typeof value.error === "string";
}
