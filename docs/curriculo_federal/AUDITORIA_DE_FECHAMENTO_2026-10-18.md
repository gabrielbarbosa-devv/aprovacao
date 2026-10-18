# Auditoria de fechamento curricular — retrato inicial

**Data:** 18/10/2026 · **Projeto Supabase:** `mnupjnlbsjsclxwlduon`  
**Modo:** leitura autenticada e escopo limitado aos IDs das 19 matérias retornadas para a conta ativa. Nenhuma escrita, migração ou alteração de histórico foi executada.

## Resultado do retrato atual

O documento de missão informa 250 tópicos e 135 guias. A leitura atual encontrou **260 tópicos ativos** e **143 guias estruturados** para as matérias da conta: 117 tópicos não têm guia. A diferença de dez tópicos em relação ao número de referência precisa ser reconciliada antes de qualquer seed. O catálogo global do projeto contém registros de outras contas; as contagens abaixo foram filtradas pelos IDs de matérias retornados autenticadamente.

| Matéria | Tópicos ativos | Guias existentes | Guias faltantes |
|---|---:|---:|---:|
| Português | 41 | 41 | 0 |
| Informática | 20 | 9 | 11 |
| Direito Penal | 14 | 14 | 0 |
| Legislação Penal Especial | 27 | 18 | 9 |
| Legislação de Trânsito | 14 | 6 | 8 |
| Execução Penal / LEP | 20 | 12 | 8 |
| Contabilidade | 10 | 1 | 9 |
| Direito Constitucional | 11 | 0 | 11 |
| Direito Administrativo | 12 | 12 | 0 |
| Direito Processual Penal | 14 | 14 | 0 |
| Raciocínio Lógico | 8 | 0 | 8 |
| Estatística | 12 | 1 | 11 |
| Matemática | 9 | 0 | 9 |
| Direitos Humanos | 13 | 6 | 7 |
| Redação Discursiva | 8 | 0 | 8 |
| Física | 6 | 0 | 6 |
| Ética no Serviço Público | 7 | 1 | 6 |
| Geopolítica | 6 | 0 | 6 |
| Língua Estrangeira | 8 | 8 | 0 |
| **Total** | **260** | **143** | **117** |

As sete matérias em destaque mantêm sua ordem atual e totalizam **146 tópicos**, dos quais **101 têm guia e 45 não têm**. O banco contém 51 módulos. A relação atual dos três alvos contém 57 associações `exam_topics`: PF Agente 2025: 26 tópicos/12 matérias; PRF 2021: 14 tópicos/17 matérias; DEPEN 2020: 17 tópicos/13 matérias.

## Auditoria de guias — campos presentes não equivalem a conteúdo conferido

Todos os 143 guias existentes têm `research_status = incidencia_auditoria_pendente`. O modelo armazena JSON do guia, fontes e esse status; não tem um estado editorial de conferência independente do domínio do estudante. Foi executado um diagnóstico estrutural, sem considerar a presença dos campos como validação editorial. Os seguintes números medem apenas a presença dos campos e não são aprovação do conteúdo:

- 143/143 têm objetivo, pelo menos três pontos de estudo, pelo menos uma pegadinha, instruções de prática e ao menos uma referência oficial salva.
- 90/143 têm ao menos um exemplo com enunciado, resposta e explicação não vazios.
- Em Informática, Legislação Penal Especial, Legislação de Trânsito, Execução Penal / LEP, Contabilidade, Estatística, Direitos Humanos e Ética, há guias salvos sem exemplo comentado completo, conforme validação estrutural.
- Não foi possível confirmar, apenas pelos campos, se cada fonte oficial ampara aquele tópico, se a explicação é correta/vigente ou se a referência é suficientemente específica. Por isso nenhum guia foi chamado de completo/conferido.

## Duplicatas e conflitos

- Não há título repetido após normalização de caixa, acentos, pontuação e espaços dentro de cada matéria.
- A comparação lexical encontrou dois pares para revisão humana, sem mesclar ou alterar: Informática — “Fundamentos de programação Python e APIs” / “Programação em Python e R — fundamentos”; Direito Penal — “Crimes contra a fé pública” / “Crimes contra a Administração Pública”. O segundo par compartilha apenas estrutura nominal e pode ser conteúdo distinto.
- Conflito de inventário: contagem anterior de 250 tópicos e Contabilidade com 8 diverge da leitura autenticada atual (260 e 10). A nova leitura também encontrou 10 tópicos de Contabilidade, não 8.

## Evidência dos concursos e limite da cobertura

Os três alvos ativos correspondem aos cargos históricos corretos. `exam_topics` tem somente `user_id`, `exam_target_id`, `topic_id` e timestamps. Não guarda o item/subitem do edital, transcrição curta, URL por vínculo, cargo/edição por item, status de gabarito, cobertura, ou justificativa editorial. Assim, os 57 vínculos existentes podem ser contados, mas não comprovam reconciliação item a item. Também não foi classificada nenhuma prova questão por questão nesta execução.

| Referência | Cargos e evidência confirmados | Itens oficiais | Cobertos | Parciais | Ausentes | Pendentes de verificação |
|---|---|---:|---:|---:|---:|---:|
| PF 2025 | Cargo 16, Agente de Polícia Federal; edital/Cargo 16 e caderno/gabarito exigem pareamento por caderno e bloco | Não contado | Não contado | Não contado | Não contado | Todos os itens/subitens do conteúdo programático |
| PRF 2021 | Cargo Policial Rodoviário Federal; o edital permite que um item avalie mais de um objeto (24.1.2) | Não contado | Não contado | Não contado | Não contado | Todos os itens/subitens do conteúdo programático |
| DEPEN 2020 | Cargo 8, Agente Federal de Execução Penal; prova do concurso aplicada em 15/05/2022; edital separa P1=30, P2=50 e P3=40 itens | 120 itens de prova, não são 120 objetos de edital | Não contado | Não contado | Não contado | Todos os objetos e pareamento de caderno/gabarito por aplicação |

“Não contado” é intencional: a contagem de matérias/títulos existente não é o denominador oficial de objetos do edital nem classifica questões reais. Nenhuma taxa de incidência foi calculada. Os dados por matéria em `exam_subjects` representam associação/peso de prova, não incidência de subtópico.

## Atualização jurídica/normativa observada

- **Trânsito:** a lista oficial de resoluções do Ministério dos Transportes é atualizada e inclui atos de 2026. A página informa, por exemplo, que a Resolução 1027/2026 revogou 809/2020, 817/2021 e 999/2023. O agrupamento atual de resoluções do edital PRF em cinco tópicos não permite conferir individualmente a vigência de cada resolução listada em 2021. O guia deve distinguir texto do edital histórico e norma vigente na data da consulta.
- **DEPEN/PPF:** a Lei 13.327 é de 29/07/2016, e a Lei 14.875/2024 alterou o contexto de carreira/nomenclatura. O alvo 2020 continua registrado como cargo histórico de Agente Federal de Execução Penal, não como novo edital atual.
- **DEPEN:** o edital estabelece 120 itens objetivos distribuídos em P1/P2/P3. Não se pode associar o Bloco III inteiro a Execução Penal/LEP; o mapeamento dos seus vários objetos continua pendente.
- **PF Informática:** o programa do Cargo 16 inclui Python, API e ETL/ELT no bloco de noções de programação e interoperabilidade. Os 11 assuntos de Informática sem guia precisam ser reconciliados com a lista completa do Cargo 16; a lista atual de tópicos não demonstra cobertura integral dos itens técnicos.

## Diff proposto — ainda sem execução no banco

| Entidade | Estado atual | Proposta de curadoria | Efeito esperado |
|---|---|---|---|
| Matérias | 19 matérias existentes | Reutilizar os IDs existentes; nenhuma nova matéria | Nenhum registro duplicado |
| Módulos | 51 existentes | Reutilizar; alterar apenas após matriz do edital aprovada | Sem reorganizar o ciclo ou mover status |
| Tópicos | 260 ativos | Não inserir nem excluir no diff atual; reconciliar 10 tópicos de divergência e mapear lacunas por edital primeiro | Nenhum status, prioridade, nota, ID ou histórico alterado |
| Guias | 143 presentes, 117 ausentes | Criar 117 guias somente para os tópicos existentes que forem conferidos; revisar os 143 existentes item a item e atualizar somente conteúdo cuja evidência sustente a mudança | Nenhuma alteração aos estados de domínio do estudante |
| Relações `exam_topics` | 57 existentes (26/14/17) | Manter IDs; comparar cada relação com item/subitem e fonte oficial; propor novas relações apenas após auditoria e colisões | Sem duplicar ligações ou alegar frequência |
| Evidência editorial | `source_evidence` em guias; ausência de referência/trecho em `exam_topics` | Se o pareamento item a item for confirmado, propor metadados editoriais mínimos versionados; ainda não aplicar DDL | Exige diff de migração e aprovação antes da escrita |
| Provas classificadas | Nenhuma amostra item a item confirmada por esta auditoria | Não criar incidência nem estatísticas derivadas | Percentuais continuam “não apurada” |

O resultado final de uma importação deverá ser transacional/idempotente, incluir IDs estáveis nos registros criados e permitir rollback seletivo do lote. A rotina não pode alterar sessões, lotes, erros, revisões, blocos, notas, preferências, status ou prioridades do estudante.

## Fontes oficiais usadas nesta conferência

- PF 2025 — edital do Cargo 16: [página oficial Cebraspe](https://cdn.cebraspe.org.br/concursos/PF_25/arquivos/Ed_1_PF_25_Abertura.html); [PDF do edital com conteúdo programático](https://cdn.cebraspe.org.br/concursos/PF_25/arquivos/208B2F9CD7C49B6E7FF2FB6F027B9D7D7904F50E049EF749BD4C2DEA8ED30B3D.pdf); [gabarito definitivo](https://cdn.cebraspe.org.br/concursos/PF_25/arquivos/CDC24D454696C9FE260E6C50FE758707F322649AEE24B6FB664FDDA10E307BCF.pdf).
- PRF 2021 — [edital de abertura](https://cdn.cebraspe.org.br/concursos/PRF_21/arquivos/ED_1_PRF_2021_ABERTURA.PDF); [gabarito definitivo do cargo](https://cdn.cebraspe.org.br/concursos/prf_21/arquivos/GAB_DEFINITIVO_578_PRF_001_01.PDF).
- DEPEN 2020 — [edital de abertura, cargo 8](https://cdn.cebraspe.org.br/concursos/depen_20/arquivos/ed_1_depen_2020_abt.pdf); [gabarito definitivo da prova aplicada em 15/05/2022, Cargo 8](https://cdn.cebraspe.org.br/concursos/depen_20/arquivos/GAB_PRELIMINAR_687_DEPEN20CF_001_01.PDF). Separar esta aplicação da avaliação/curso de formação posterior em 2024.
- Normas de trânsito — [lista oficial de resoluções CONTRAN](https://www.gov.br/transportes/pt-br/assuntos/transito/conteudo-Senatran/resolucoes-contran), página consultada em 18/10/2026.
- Carreira federal de execução penal — [Lei 13.327/2016](https://www.planalto.gov.br/ccivil_03/_ato2015-2018/2016/lei/l13327.htm); [Lei 14.875/2024](https://www.planalto.gov.br/ccivil_03/_ato2023-2026/2024/lei/l14875.htm).

## Verificações não realizadas

- Nenhum INSERT, UPDATE, DELETE, DDL ou migração foi executado. O histórico permaneceu intocado por não haver escrita; totais de sessões, resultados, revisões e erros não foram capturados antes/depois.
- Não foram feitas chamadas de teste com identidade não proprietária; o navegador autenticado não ficou disponível para inspecionar as telas.
- Nenhuma questão de PF/PRF/DEPEN foi classificada individualmente. A lista pública consultada e os vínculos existentes não substituem essa classificação.
- A inspeção lexical de títulos não substitui revisão semântica dos 260 tópicos.

## Checks locais executados

Node e pnpm do runtime desktop foram incluídos no `PATH` para executar os scripts do projeto. Resultado:

| Comando | Resultado |
|---|---|
| `pnpm lint` | PASSOU |
| `pnpm test` | PASSOU — 22 arquivos, 73 testes |
| `pnpm exec tsc --noEmit` | Passou após `pnpm build` regenerar `.next/types/routes.js`; a primeira tentativa, antes do build, falhou porque o arquivo gerado não existia |
| `pnpm build` | PASSOU — Next.js 16.4.2, compilação e checagem TypeScript concluídas |
| `git diff --check` | PASSOU |
| Formatter | Não há script de formatter em `package.json`; não executado |

Esses checks são locais. Não cobrem leitura/escrita no Supabase, RLS com outra conta, testes de browser autenticado nem revisão visual das telas.

## Próximos lotes seguros

1. Confirmar o diff de edição de conteúdo e, em seguida, fechar a matriz documental dos sete focos, começando pelos tópicos sem guia em Informática, Legislação Penal Especial, Trânsito, LEP e Contabilidade.
2. Reconciliar os programas oficiais completos por cargo, registrando tópico primário/subsecundário e trechos curtos com fonte, sem extrapolar os títulos.
3. Revisar guias existentes sem trocar status de domínio ou reescrever fatos sem fonte; manter incidência não apurada até classificar amostra oficial completa.
4. Continuar pelas demais matérias existentes, preservando o ciclo de estudo.
5. Apresentar diff e aprovação para qualquer escrita no Supabase ou migração de schema, como exigido pelo fluxo de curadoria previamente definido.
