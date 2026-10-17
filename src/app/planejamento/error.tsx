"use client";

import { useEffect } from "react";
import { AlertCircle } from "lucide-react";
import { Button } from "@/components/ui/button";

export default function PlanningError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => { console.error("Erro ao carregar planejamento", error); }, [error]);
  return <main className="grid min-h-[60svh] place-items-center p-6">
    <section className="max-w-md text-center" aria-labelledby="planning-error-title">
      <AlertCircle aria-hidden="true" className="mx-auto size-8 text-destructive" />
      <h1 id="planning-error-title" className="mt-4 text-xl font-semibold">Não foi possível carregar seu planejamento</h1>
      <p className="mt-2 text-sm text-muted-foreground">Seus dados não foram alterados. Verifique a conexão e tente novamente.</p>
      <Button onClick={reset} className="mt-5">Tentar novamente</Button>
    </section>
  </main>;
}
