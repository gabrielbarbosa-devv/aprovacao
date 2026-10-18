"use client";

import { Button } from "@/components/ui/button";

export default function Error({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <main className="mx-auto grid min-h-[55svh] w-full max-w-xl place-content-center px-6 text-center">
      <h1 className="text-xl font-semibold">Não foi possível carregar seu progresso</h1>
      <p className="mt-2 text-sm text-muted-foreground">Confira sua conexão e tente carregar os dados novamente.</p>
      <Button type="button" onClick={reset} className="mx-auto mt-5">Tentar novamente</Button>
    </main>
  );
}
