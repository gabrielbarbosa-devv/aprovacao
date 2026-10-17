"use client";

import { AlertCircle } from "lucide-react";
import { Button } from "@/components/ui/button";

export default function AppError({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <main className="grid min-h-svh place-items-center bg-muted/30 p-6">
      <section className="max-w-md text-center" aria-labelledby="error-title">
        <AlertCircle aria-hidden="true" className="mx-auto size-8 text-destructive" />
        <h1 id="error-title" className="mt-4 text-xl font-semibold">Não foi possível carregar seus estudos</h1>
        <p className="mt-2 text-sm text-muted-foreground">Confira sua conexão e tente carregar novamente.</p>
        <Button onClick={reset} className="mt-5">Tentar novamente</Button>
      </section>
    </main>
  );
}
