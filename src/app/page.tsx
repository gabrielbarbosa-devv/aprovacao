const capabilities = [
  {
    number: "01",
    title: "Planejamento",
    description: "Organize matérias, prioridades e seu ritmo de estudo em um plano claro.",
    mark: "↗",
  },
  {
    number: "02",
    title: "Registros",
    description: "Acompanhe o que estudou e mantenha sua evolução documentada.",
    mark: "＋",
  },
  {
    number: "03",
    title: "Revisões",
    description: "Tenha um lugar para organizar os conteúdos que precisam voltar à sua rotina.",
    mark: "◷",
  },
];

export default function Home() {
  return (
    <main className="min-h-screen overflow-hidden bg-[#f5f4ef] text-[#192720]">
      <header className="mx-auto flex w-full max-w-7xl items-center justify-between px-6 py-6 sm:px-10 lg:px-12">
        <a href="#inicio" className="flex items-center gap-3" aria-label="Operação Aprovação, início">
          <span className="grid size-10 place-items-center rounded-xl bg-[#1f4938] text-sm font-bold tracking-tight text-white">OA</span>
          <span className="text-sm font-semibold tracking-[-0.02em]">Operação Aprovação</span>
        </a>
        <span className="hidden rounded-full border border-[#d9ddd6] px-4 py-2 text-xs font-medium text-[#617067] sm:inline-flex">
          Seu espaço de estudos
        </span>
      </header>

      <section id="inicio" className="mx-auto grid w-full max-w-7xl gap-14 px-6 pb-16 pt-12 sm:px-10 md:pb-24 md:pt-20 lg:grid-cols-[1.1fr_.9fr] lg:items-center lg:px-12">
        <div className="relative z-10 max-w-2xl">
          <p className="mb-6 inline-flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.18em] text-[#52705f]">
            <span className="size-2 rounded-full bg-[#d7894a]" />
            Uma rotina com direção
          </p>
          <h1 className="text-5xl font-semibold leading-[1.04] tracking-[-0.055em] sm:text-6xl lg:text-[4.5rem]">
            Estude com método. <span className="text-[#547662]">Avance com confiança.</span>
          </h1>
          <p className="mt-7 max-w-xl text-base leading-7 text-[#637168] sm:text-lg sm:leading-8">
            Um espaço para planejar seus estudos para concursos, registrar seu progresso e manter as revisões no radar.
          </p>
          <a href="#como-funciona" className="mt-9 inline-flex items-center gap-3 rounded-full bg-[#1f4938] px-6 py-3.5 text-sm font-semibold text-white transition hover:bg-[#2b5d47] focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[#1f4938]">
            Conheça a proposta <span aria-hidden="true">↓</span>
          </a>
          <p className="mt-5 text-xs text-[#879187]">Planejamento, organização e acompanhamento — em um só lugar.</p>
        </div>

        <div aria-hidden="true" className="relative mx-auto aspect-[1.03/1] w-full max-w-[510px]">
          <div className="absolute inset-[7%] rounded-[2.5rem] bg-[#e4e8df]" />
          <div className="absolute right-[8%] top-[7%] h-[76%] w-[67%] rounded-[2rem] border border-white/70 bg-[#fbfaf6] p-6 shadow-[0_28px_80px_-45px_rgba(25,39,32,.35)] sm:p-8">
            <div className="flex items-center justify-between border-b border-[#e8e9e2] pb-5">
              <div>
                <span className="text-[10px] font-semibold uppercase tracking-[.16em] text-[#889288]">Seu próximo passo</span>
                <div className="mt-1 text-lg font-semibold tracking-tight">Uma coisa de cada vez.</div>
              </div>
              <span className="grid size-9 place-items-center rounded-full bg-[#edf1e9] text-[#52705f]">✳</span>
            </div>
            <div className="mt-6 space-y-3">
              {[
                ["Organize o plano", "Defina o que importa agora", "01"],
                ["Registre seus estudos", "Veja o caminho percorrido", "02"],
                ["Retome os conteúdos", "Revisão também é progresso", "03"],
              ].map(([title, subtitle, index]) => (
                <div key={index} className="flex items-center gap-3 rounded-2xl border border-[#e9ebe5] bg-white/80 p-3.5">
                  <span className="grid size-9 shrink-0 place-items-center rounded-xl bg-[#f1f3ed] text-[10px] font-semibold text-[#718273]">{index}</span>
                  <div>
                    <div className="text-sm font-semibold">{title}</div>
                    <div className="mt-0.5 text-xs text-[#879187]">{subtitle}</div>
                  </div>
                  <span className="ml-auto text-xs text-[#b0b9ae]">↗</span>
                </div>
              ))}
            </div>
            <div className="mt-5 rounded-2xl bg-[#1f4938] p-4 text-white">
              <p className="text-[10px] font-semibold uppercase tracking-[.16em] text-white/65">O foco</p>
              <p className="mt-1 text-sm font-medium">Consistência vale mais que pressa.</p>
            </div>
          </div>
          <div className="absolute bottom-[8%] left-[1%] flex items-center gap-3 rounded-2xl border border-white/80 bg-white px-4 py-3 shadow-[0_18px_45px_-30px_rgba(25,39,32,.4)]">
            <span className="grid size-9 place-items-center rounded-full bg-[#f7eadc] text-[#bd7842]">✦</span>
            <span className="text-xs font-medium leading-5 text-[#526158]">Seu ritmo.<br />Seu plano.</span>
          </div>
          <span className="absolute bottom-[18%] right-[3%] size-14 rounded-full bg-[#d9894f]" />
          <span className="absolute left-[8%] top-[13%] size-5 rounded-full bg-[#78917d]" />
        </div>
      </section>

      <section id="como-funciona" className="border-t border-[#e2e4dd] bg-[#fbfaf6]">
        <div className="mx-auto max-w-7xl px-6 py-16 sm:px-10 md:py-20 lg:px-12">
          <div className="mb-10 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[.18em] text-[#718273]">A estrutura</p>
              <h2 className="mt-3 text-3xl font-semibold tracking-[-.04em] sm:text-4xl">O essencial para manter o ritmo.</h2>
            </div>
            <p className="max-w-sm text-sm leading-6 text-[#778279]">Feito para organizar a preparação sem aulas nem banco de questões.</p>
          </div>
          <div className="grid gap-3 md:grid-cols-3">
            {capabilities.map((item) => (
              <article key={item.number} className="rounded-3xl border border-[#e7e9e2] bg-white p-6 sm:p-7">
                <div className="flex items-center justify-between text-xs font-semibold text-[#91a092]">
                  <span>{item.number}</span><span className="text-lg text-[#547662]">{item.mark}</span>
                </div>
                <h3 className="mt-9 text-xl font-semibold tracking-[-.03em]">{item.title}</h3>
                <p className="mt-2 max-w-xs text-sm leading-6 text-[#778279]">{item.description}</p>
              </article>
            ))}
          </div>
        </div>
      </section>

      <footer className="mx-auto flex max-w-7xl flex-col gap-2 px-6 py-7 text-xs text-[#889288] sm:flex-row sm:items-center sm:justify-between sm:px-10 lg:px-12">
        <span>Operação Aprovação</span><span>Organização para a sua preparação.</span>
      </footer>
    </main>
  );
}
