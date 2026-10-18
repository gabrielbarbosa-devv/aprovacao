"use client";

import { useState, useTransition, type FormEvent } from "react";
import { Bell, Check, Clock3, LoaderCircle, Moon, Smartphone } from "lucide-react";
import { toast } from "sonner";
import { useRouter } from "next/navigation";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { saveNotificationPreferencesAction } from "@/features/settings/actions";
import type { NotificationPreferencesInput } from "@/features/notifications/domain/schemas";
import { PushNotificationsControl } from "@/features/notifications/components/push-notifications-control";

export function NotificationPreferences({ initial, timezone, weekdays }: {
  initial: NotificationPreferencesInput & { reminderTimeSaved: boolean };
  timezone: string;
  weekdays: number[];
}) {
  const [preferences, setPreferences] = useState<NotificationPreferencesInput>(initial);
  const [saving, startSave] = useTransition();
  const router = useRouter();

  function set<K extends keyof NotificationPreferencesInput>(key: K, value: NotificationPreferencesInput[K]) {
    setPreferences((current) => ({ ...current, [key]: value }));
  }

  function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    startSave(async () => {
      const result = await saveNotificationPreferencesAction(preferences);
      if (!result.ok) { toast.error(result.message); return; }
      toast.success("Preferências de notificações salvas.");
      router.refresh();
    });
  }

  return <section aria-labelledby="notification-preferences-heading" className="space-y-5">
    <div><h2 id="notification-preferences-heading" className="flex items-center gap-2 text-lg font-semibold"><Bell aria-hidden="true" className="size-4 text-primary" />Notificações de estudos</h2><p className="mt-1 text-sm text-muted-foreground">Avisos internos derivados do seu planejamento, das suas revisões e dos blocos ainda pendentes.</p></div>
    <form onSubmit={save} className="space-y-5">
      <fieldset className="space-y-3">
        <legend className="text-sm font-medium">Categorias de aviso</legend>
        <ToggleRow id="notify-study" label="Estudos planejados para hoje" description="Agrupa os blocos reais do dia em um aviso." checked={preferences.studyEnabled} onChange={(checked) => set("studyEnabled", checked)} />
        <ToggleRow id="notify-reviews" label="Revisões vencidas ou de hoje" description="Considera apenas revisões pendentes que vieram de estudos registrados." checked={preferences.reviewsEnabled} onChange={(checked) => set("reviewsEnabled", checked)} />
        <ToggleRow id="notify-pending" label="Estudos pendentes de dias anteriores" description="Aponta o bloco pendente mais antigo sem mover as datas do planejamento." checked={preferences.pendingEnabled} onChange={(checked) => set("pendingEnabled", checked)} />
      </fieldset>

      <div className="grid gap-4 sm:grid-cols-3">
        <div className="space-y-2"><Label htmlFor="daily-reminder">Horário preferido</Label><Input id="daily-reminder" type="time" value={preferences.dailyReminderTime} onChange={(event) => set("dailyReminderTime", event.target.value)} required aria-describedby="daily-reminder-help" /><p id="daily-reminder-help" className="text-xs text-muted-foreground">Fuso: {timezone}</p></div>
        <div className="space-y-2"><Label htmlFor="reminder-lead">Antecedência (min)</Label><Input id="reminder-lead" type="number" min={0} max={1440} step={5} value={preferences.reminderLeadMinutes} onChange={(event) => set("reminderLeadMinutes", Number(event.target.value))} required aria-describedby="reminder-lead-help" /><p id="reminder-lead-help" className="text-xs text-muted-foreground">Usada quando o bloco tem horário definido.</p></div>
        <div className="space-y-2"><Label>Dias disponíveis</Label><p className="flex min-h-10 items-center text-sm text-muted-foreground">{weekdays.length} dia(s), reaproveitando os dias já salvos na rotina.</p></div>
      </div>

      <fieldset className="space-y-2">
        <legend className="flex items-center gap-2 text-sm font-medium"><Moon aria-hidden="true" className="size-4" />Horário de silêncio (opcional)</legend>
        <p className="text-xs text-muted-foreground">Se preenchido, nenhum canal de notificação será acionado nesse período.</p>
        <div className="grid max-w-md grid-cols-2 gap-3">
          <div className="space-y-1"><Label htmlFor="quiet-start">Início</Label><Input id="quiet-start" type="time" value={preferences.quietHoursStart ?? ""} onChange={(event) => set("quietHoursStart", event.target.value || null)} /></div>
          <div className="space-y-1"><Label htmlFor="quiet-end">Fim</Label><Input id="quiet-end" type="time" value={preferences.quietHoursEnd ?? ""} onChange={(event) => set("quietHoursEnd", event.target.value || null)} /></div>
        </div>
      </fieldset>

      <div className="rounded-xl border p-4"><div className="flex items-start gap-3"><Clock3 aria-hidden="true" className="mt-0.5 size-4 text-primary" /><div><p className="text-sm font-medium">Horário inicial sugerido: 06:00</p><p className="mt-1 text-sm text-muted-foreground">Essa sugestão não foi salva nem sobrescreve suas preferências. {initial.reminderTimeSaved ? "O horário atual já está salvo." : "Confirme e salve o horário para ativar o processamento."}</p></div></div></div>

      <div className="rounded-xl border p-4"><div className="mb-3 flex items-start gap-3"><Smartphone aria-hidden="true" className="mt-0.5 size-4 text-primary" /><div><p className="text-sm font-medium">Notificações do navegador</p><p className="mt-1 text-sm text-muted-foreground">A permissão só é solicitada depois de clicar em ativar. O suporte varia por navegador, sistema e instalação da PWA.</p></div></div><PushNotificationsControl enabled={preferences.browserPushEnabled} onChange={(enabled) => set("browserPushEnabled", enabled)} /></div>

      <Separator />
      <Button type="submit" disabled={saving}>{saving ? <><LoaderCircle className="animate-spin" />Salvando…</> : <><Check />Salvar notificações</>}</Button>
    </form>
    <Alert><Bell aria-hidden="true" /><AlertDescription>Os avisos informam e direcionam. Marcar como lido ou dispensar nunca conclui um estudo nem altera seu desempenho.</AlertDescription></Alert>
  </section>;
}

function ToggleRow({ id, label, description, checked, onChange }: { id: string; label: string; description: string; checked: boolean; onChange: (checked: boolean) => void }) {
  return <label htmlFor={id} className="flex cursor-pointer items-start gap-3 rounded-lg border p-3 hover:bg-muted/30"><input id={id} type="checkbox" checked={checked} onChange={(event) => onChange(event.target.checked)} className="mt-1 size-4 accent-primary" /><span><span className="block text-sm font-medium">{label}</span><span className="mt-0.5 block text-sm text-muted-foreground">{description}</span></span></label>;
}
