"use client";

import { Button } from "@/components/ui/button";

export default function SettingsError({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return <main className="mx-auto w-full max-w-xl flex-1 px-5 py-16 text-center">
    <h1 className="text-xl font-semibold">Não foi possível carregar as configurações</h1>
    <p className="mt-2 text-sm text-muted-foreground">Suas preferências continuam salvas. Confira a conexão e tente novamente.</p>
    <Button onClick={reset} className="mt-5">Tentar novamente</Button>
  </main>;
}
