import Link from "next/link";
import { ArrowRight, BookOpen, CheckSquare2, CircleDot } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { ThemeToggle } from "@/components/theme-toggle";

export function ModuleSelector() {
  return (
    <main className="flex min-h-svh flex-col bg-muted/30 px-4 py-5 sm:px-8">
      <header className="mx-auto flex w-full max-w-6xl items-center justify-between">
        <Link href="/" className="flex items-center gap-3 rounded-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring" aria-label="Operação Aprovação, seletor de módulos">
          <span className="grid size-10 place-items-center rounded-xl bg-primary text-primary-foreground">
            <CircleDot aria-hidden="true" className="size-5" />
          </span>
          <span className="leading-tight">
            <span className="block text-sm font-bold tracking-tight">Operação Aprovação</span>
            <span className="mt-1 block text-xs text-muted-foreground">Organize. Estude. Evolua.</span>
          </span>
        </Link>
        <ThemeToggle />
      </header>

      <section className="mx-auto flex w-full max-w-5xl flex-1 flex-col justify-center py-14 sm:py-20">
        <div className="mx-auto mb-10 max-w-2xl text-center sm:mb-12">
          <p className="text-xs font-bold uppercase tracking-[0.16em] text-primary">Bem-vindo(a)</p>
          <h1 className="mt-3 text-3xl font-bold tracking-tight sm:text-4xl">O que vamos fazer hoje?</h1>
          <p className="mt-3 text-base text-muted-foreground sm:text-lg">Escolha uma área para continuar.</p>
        </div>

        <div className="grid gap-5 md:grid-cols-2">
          <Card className="flex h-full min-h-72 flex-col border-border/80 shadow-sm">
            <CardHeader className="gap-5">
              <span className="grid size-14 place-items-center rounded-2xl bg-primary/10 text-primary" aria-hidden="true">
                <BookOpen className="size-7" />
              </span>
              <div className="space-y-2">
                <span className="inline-flex rounded-full bg-primary/10 px-2.5 py-1 text-[11px] font-bold uppercase tracking-wide text-primary">Estudos</span>
                <CardTitle className="text-xl">Preparação para concursos</CardTitle>
                <CardDescription className="max-w-sm text-sm leading-6">Planejamento, matérias, revisões e progresso.</CardDescription>
              </div>
            </CardHeader>
            <CardContent className="flex-1" />
            <CardFooter className="border-t bg-transparent">
              <Button render={<Link href="/hoje" />} variant="ghost" className="h-10 w-full justify-start px-0 font-semibold">
                Continuar estudando <ArrowRight aria-hidden="true" className="ml-1" />
              </Button>
            </CardFooter>
          </Card>

          <Card className="flex h-full min-h-72 flex-col border-primary/40 bg-primary/[0.025] shadow-sm ring-1 ring-primary/15">
            <CardHeader className="gap-5">
              <span className="grid size-14 place-items-center rounded-2xl bg-primary text-primary-foreground shadow-sm" aria-hidden="true">
                <CheckSquare2 className="size-7" />
              </span>
              <div className="space-y-2">
                <span className="inline-flex rounded-full bg-primary/10 px-2.5 py-1 text-[11px] font-bold uppercase tracking-wide text-primary">Produtividade</span>
                <CardTitle className="text-xl">Minhas tarefas</CardTitle>
                <CardDescription className="max-w-sm text-sm leading-6">Organize seu dia, suas listas e seus projetos.</CardDescription>
              </div>
            </CardHeader>
            <CardContent className="flex-1" />
            <CardFooter className="border-t border-primary/10 bg-transparent">
              <Button render={<Link href="/todo" />} className="h-10 w-full justify-center font-semibold">
                Abrir tarefas <ArrowRight aria-hidden="true" className="ml-1" />
              </Button>
            </CardFooter>
          </Card>
        </div>
      </section>

      <footer className="mx-auto w-full max-w-md border-t py-5 text-center text-xs text-muted-foreground">
        <p>“Disciplina hoje, resultados amanhã.”</p>
        <p className="mt-1">Operação Aprovação</p>
      </footer>
    </main>
  );
}
