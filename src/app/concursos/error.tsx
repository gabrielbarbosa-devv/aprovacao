"use client";

import { AlertTriangle } from "lucide-react";
import { Button } from "@/components/ui/button";

export default function ErrorPage({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return <main className="grid min-h-svh place-items-center bg-muted/30 px-5"><section role="alert" className="max-w-md rounded-2xl border bg-card p-7 text-center shadow-sm">
    <span className="mx-auto grid size-11 place-items-center rounded-xl bg-destructive/10 text-destructive"><AlertTriangle aria-hidden="true" className="size-5" /></span>
    <h1 className="mt-4 text-lg font-semibold">Não foi possível carregar seus concursos</h1>
    <p className="mt-2 text-sm text-muted-foreground">Tente novamente. Seus registros continuam protegidos.</p>
    <Button onClick={reset} className="mt-5">Tentar novamente</Button>
  </section></main>;
}
