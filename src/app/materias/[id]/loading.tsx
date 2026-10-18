import { Spinner } from "@/components/ui/spinner";

export default function SubjectTopicsLoading() {
  return <main className="mx-auto w-full max-w-[1240px] flex-1 px-5 pb-10 pt-10 sm:px-8 lg:px-10" aria-busy="true" aria-live="polite">
    <div className="flex min-h-[45svh] flex-col items-center justify-center gap-3 text-center">
      <Spinner className="size-6 text-primary" />
      <p className="text-sm font-medium text-foreground">Carregando tópicos…</p>
      <p className="text-sm text-muted-foreground">Buscando o conteúdo salvo nesta matéria.</p>
    </div>
  </main>;
}
