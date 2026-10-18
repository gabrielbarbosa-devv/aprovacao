import { BookOpenCheck, ExternalLink, Lightbulb, ListChecks, Search, Target } from "lucide-react";
import type { StudyGuide } from "@/features/topics/domain/types";

export function TopicStudyGuide({ guide }: { guide: StudyGuide | null }) {
  if (!guide) return <section className="rounded-xl border border-dashed p-4 text-sm text-muted-foreground">
    O guia didático ainda não está disponível para este tópico. As notas pessoais seguem preservadas abaixo.
  </section>;

  return <div className="space-y-5">
    <GuideSection icon={<Target aria-hidden="true" className="size-4" />} title="Objetivo da aprendizagem">
      {guide.objective ? <p className="text-sm leading-6 text-foreground/90">{guide.objective}</p> : <Empty>Objetivo ainda não informado.</Empty>}
    </GuideSection>

    <GuideSection icon={<ListChecks aria-hidden="true" className="size-4" />} title="O que estudar">
      {guide.studyPoints.length > 0 ? <ol className="list-decimal space-y-2 pl-5 text-sm leading-6 text-foreground/90 marker:font-medium marker:text-muted-foreground">
        {guide.studyPoints.map((point, index) => <li key={`${index}-${point}`}>{point}</li>)}
      </ol> : <Empty>Roteiro conceitual ainda não informado.</Empty>}
      <p className="mt-3 text-xs text-muted-foreground">Roteiro conceitual de estudo; não representa tarefas concluídas.</p>
    </GuideSection>

    <GuideSection icon={<BookOpenCheck aria-hidden="true" className="size-4" />} title="Como a banca cobra">
      {guide.examStyle ? <div className="space-y-2">
        {guide.examStyle.board ? <p className="text-sm font-medium">{guide.examStyle.board}</p> : null}
        {guide.examStyle.description ? <p className="text-sm leading-6 text-foreground/90">{guide.examStyle.description}</p> : <Empty>Descrição da cobrança ainda não informada.</Empty>}
        {guide.examStyle.evidenceType ? <p className="rounded-lg bg-muted/60 px-3 py-2 text-xs leading-5 text-muted-foreground">Natureza da evidência: {guide.examStyle.evidenceType}</p> : null}
      </div> : <Empty>Descrição da banca ainda não informada.</Empty>}
      <p className="mt-3 text-xs leading-5 text-muted-foreground">Esta explicação didática não comprova, por si só, incidência histórica do subtópico.</p>
    </GuideSection>

    <GuideSection icon={<Lightbulb aria-hidden="true" className="size-4" />} title="Pegadinhas e erros comuns">
      {guide.pitfalls.length > 0 ? <ul className="space-y-2">
        {guide.pitfalls.map((pitfall, index) => <li key={`${index}-${pitfall}`} className="rounded-lg border bg-background px-3 py-2.5 text-sm leading-5">{pitfall}</li>)}
      </ul> : <Empty>Nenhuma armadilha foi registrada no guia.</Empty>}
      <p className="mt-2 text-xs text-muted-foreground">Conteúdo geral do guia; não é um erro pessoal do seu caderno.</p>
    </GuideSection>

    <GuideSection icon={<BookOpenCheck aria-hidden="true" className="size-4" />} title="Exemplo comentado">
      {guide.examples.length > 0 ? <div className="space-y-3">
        {guide.examples.map((example, index) => <article key={`${index}-${example.statement}`} className="space-y-3 rounded-xl border bg-background p-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Exemplo {index + 1}</p>
            {example.original === true ? <span className="rounded-full bg-secondary px-2 py-1 text-[11px] font-medium text-secondary-foreground">Exemplo didático original</span> : null}
            {example.original === null ? <span className="rounded-full bg-secondary px-2 py-1 text-[11px] font-medium text-secondary-foreground">Origem não informada</span> : null}
          </div>
          <p className="whitespace-pre-wrap text-sm leading-6">{example.statement}</p>
          {example.answer ? <p className="text-sm"><span className="font-medium">Resposta:</span> {example.answer}</p> : null}
          {example.explanation ? <p className="text-sm leading-6 text-muted-foreground"><span className="font-medium text-foreground">Justificativa:</span> {example.explanation}</p> : null}
        </article>)}
      </div> : <Empty>O guia não possui exemplo comentado.</Empty>}
    </GuideSection>

    <GuideSection icon={<Search aria-hidden="true" className="size-4" />} title="Como praticar">
      {guide.practice ? <div className="space-y-3 text-sm leading-6">
        {guide.practice.firstQuestions !== null ? <p>O guia sugere começar com <strong>{guide.practice.firstQuestions} questões</strong>, em plataforma externa.</p> : null}
        {guide.practice.platform ? <p><span className="font-medium">Plataforma:</span> {guide.practice.platform}</p> : null}
        {guide.practice.filters.length > 0 ? <div><p className="mb-2 font-medium">Filtros sugeridos</p><ul className="flex flex-wrap gap-2">{guide.practice.filters.map((filter) => <li key={filter} className="rounded-full bg-muted px-2.5 py-1 text-xs">{filter}</li>)}</ul></div> : null}
        {guide.practice.videoSearch ? <p><span className="font-medium">Busca de videoaula:</span> {guide.practice.videoSearch}</p> : null}
        {guide.practice.activeRecall ? <p className="rounded-lg bg-primary/5 px-3 py-2.5"><span className="font-medium">Recuperação ativa:</span> {guide.practice.activeRecall}</p> : null}
      </div> : <Empty>Orientação de prática ainda não informada.</Empty>}
    </GuideSection>

    <GuideSection icon={<ExternalLink aria-hidden="true" className="size-4" />} title="Fontes e evidências">
      <div className="mb-3 rounded-lg bg-muted/50 px-3 py-2 text-sm text-muted-foreground">
        {guide.incidence?.measuredPercent !== null && guide.incidence?.measuredPercent !== undefined && guide.incidence.measuredSample !== null && guide.incidence.measuredSample !== undefined
          ? `Incidência medida em amostra documentada de ${guide.incidence.measuredSample} questões.`
          : "Incidência histórica não apurada."}
      </div>
      {guide.officialSources.length > 0 ? <ul className="space-y-2">
        {guide.officialSources.map((source) => <li key={`${source.exam}-${source.url}`} className="rounded-lg border bg-background p-3">
          <a href={source.url} target="_blank" rel="noopener noreferrer" className="inline-flex items-start gap-2 text-sm font-medium text-primary underline-offset-4 hover:underline focus-visible:rounded-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
            <span>{source.exam}{source.reference ? ` · ${source.reference}` : ""}</span><ExternalLink aria-hidden="true" className="mt-0.5 size-3.5 shrink-0" /><span className="sr-only">(abre em nova aba)</span>
          </a>
          <p className="mt-1 break-all text-xs text-muted-foreground">{source.url}</p>
        </li>)}
      </ul> : <Empty>Referência oficial detalhada ainda não verificada.</Empty>}
      {guide.coverageNote ? <p className="mt-3 text-xs leading-5 text-muted-foreground">{guide.coverageNote}</p> : null}
    </GuideSection>

    {guide.legacyNotes ? <details className="group rounded-xl border bg-background">
      <summary className="cursor-pointer list-none px-4 py-3 text-sm font-medium outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-inset">Notas históricas do tópico</summary>
      <p className="whitespace-pre-wrap border-t px-4 py-3 text-xs leading-5 text-muted-foreground">{guide.legacyNotes}</p>
    </details> : null}
  </div>;
}

function GuideSection({ icon, title, children }: { icon: React.ReactNode; title: string; children: React.ReactNode }) {
  return <section className="space-y-3">
    <h3 className="flex items-center gap-2 text-sm font-semibold"><span className="text-primary">{icon}</span>{title}</h3>
    {children}
  </section>;
}

function Empty({ children }: { children: React.ReactNode }) {
  return <p className="text-sm text-muted-foreground">{children}</p>;
}
