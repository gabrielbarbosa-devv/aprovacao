import { Spinner } from "@/components/ui/spinner";

export default function SubjectTopicsLoading() {
  return <main className="app-page" aria-busy="true" aria-live="polite">
    <div className="flex min-h-[45svh] flex-col items-center justify-center gap-3 text-center">
      <Spinner className="size-6 text-primary" />
      <p className="text-sm font-medium text-foreground">Carregando tópicos…</p>
      <p className="text-sm text-muted-foreground">Buscando o conteúdo salvo nesta matéria.</p>
    </div>
  </main>;
}
