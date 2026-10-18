"use client";

import { Button } from "@/components/ui/button";

export default function Error({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return <main className="grid min-h-[40vh] place-items-center px-5 py-8"><section className="max-w-md text-center"><h1 className="text-xl font-semibold">Não foi possível carregar as revisões</h1><p className="mt-2 text-sm text-muted-foreground">Suas tarefas e registros foram preservados. Tente carregar novamente.</p><Button className="mt-5" onClick={reset}>Tentar novamente</Button></section></main>;
}
