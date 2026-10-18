"use client";

import { useEffect } from "react";
import { Button } from "@/components/ui/button";

export default function SubjectTopicsError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => console.error(error), [error]);
  return <main className="mx-auto flex w-full max-w-2xl flex-1 flex-col items-center justify-center px-5 py-16 text-center">
    <h1 className="text-xl font-semibold">Não foi possível carregar os tópicos</h1>
    <p className="mt-2 text-sm text-muted-foreground">Confira sua conexão e tente novamente. Seus dados não foram alterados.</p>
    <Button variant="outline" className="mt-5" onClick={reset}>Tentar novamente</Button>
  </main>;
}
