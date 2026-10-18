"use client";

import { useState } from "react";
import { LoaderCircle, Smartphone } from "lucide-react";
import { Button } from "@/components/ui/button";

const VAPID_PUBLIC_KEY = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;

export function PushNotificationsControl({ enabled, onChange }: { enabled: boolean; onChange: (enabled: boolean) => void }) {
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const supported = typeof window !== "undefined" && "serviceWorker" in navigator && "PushManager" in window && "Notification" in window;

  async function toggle() {
    if (!VAPID_PUBLIC_KEY) { setMessage("Web Push ainda não está configurado no ambiente de produção."); return; }
    if (!supported) { setMessage("Este navegador não oferece suporte a Web Push."); return; }
    setBusy(true); setMessage(null);
    try {
      const registration = await navigator.serviceWorker.register("/sw.js");
      const existing = await registration.pushManager.getSubscription();
      if (enabled) {
        if (existing) {
          await fetch("/api/notifications/push", { method: "DELETE", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ endpoint: existing.endpoint }) });
          await existing.unsubscribe();
        }
        onChange(false);
      } else {
        const permission = await Notification.requestPermission();
        if (permission !== "granted") { setMessage("Permissão negada. Os avisos internos continuam disponíveis."); return; }
        const subscription = existing ?? await registration.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: decodeKey(VAPID_PUBLIC_KEY) });
        const payload = subscription.toJSON();
        const response = await fetch("/api/notifications/push", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) });
        if (!response.ok) throw new Error("save-subscription");
        onChange(true);
      }
    } catch {
      setMessage("Não foi possível configurar Web Push. A central interna continua funcionando.");
    } finally { setBusy(false); }
  }

  return <div className="space-y-2"><Button type="button" variant="outline" onClick={toggle} disabled={busy || !VAPID_PUBLIC_KEY}>{busy ? <><LoaderCircle className="animate-spin" />Atualizando…</> : <><Smartphone />{enabled ? "Desativar neste navegador" : "Ativar neste navegador"}</>}</Button>{message ? <p role="status" className="text-sm text-muted-foreground">{message}</p> : !VAPID_PUBLIC_KEY ? <p className="text-xs text-muted-foreground">Chave pública Web Push ainda não configurada. Avisos internos não dependem desse canal.</p> : null}</div>;
}

function decodeKey(value: string): Uint8Array<ArrayBuffer> {
  const normalized = value.replace(/-/g, "+").replace(/_/g, "/");
  const raw = window.atob(normalized.padEnd(Math.ceil(normalized.length / 4) * 4, "="));
  const bytes = new Uint8Array(new ArrayBuffer(raw.length));
  for (let index = 0; index < raw.length; index += 1) bytes[index] = raw.charCodeAt(index);
  return bytes;
}
