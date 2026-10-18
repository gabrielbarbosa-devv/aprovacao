"use client";

import { Button } from "@/components/ui/button";

export default function Error({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return <main className="mx-auto w-full max-w-xl flex-1 px-5 py-16 text-center">
    <h1 className="text-xl font-semibold">Não foi possível carregar o plano de reforço</h1>
    <p className="mt-2 text-sm text-muted-foreground">Seus registros e o planejamento continuam preservados. Tente novamente.</p>
    <Button onClick={reset} className="mt-5">Tentar novamente</Button>
  </main>;
}
