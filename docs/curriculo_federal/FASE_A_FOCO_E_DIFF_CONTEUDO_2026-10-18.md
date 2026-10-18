# Fase A — foco pessoal e diff de conteúdo

**Data do retrato:** 18/10/2026 · **Supabase:** `mnupjnlbsjsclxwlduon`  
**Status:** Fase A implementada no código; nenhuma alteração de conteúdo foi escrita no Supabase.

## Estado confirmado no banco

Os IDs foram obtidos pela consulta autenticada da aplicação e usados para limitar as consultas de leitura. Nenhuma tabela QA foi incluída.

| Entidade | Existente |
|---|---:|
| Matérias ativas | 19 |
| Módulos | 51 |
| Tópicos ativos | 265 |
| Guias ligados a tópicos ativos | 169 |
| Tópicos ativos sem guia | 96 |
| Matérias marcadas `is_focus` | 12 |
| Alvos ativos | 3 |
| Vínculos matéria–concurso | 42 |
| Vínculos tópico–concurso | 89 |
| Blocos de estudo | 2 |
| Sessões, lotes, erros e revisões do titular | 0 em cada tabela |

O banco contém 171 linhas de guia no total do titular; duas pertencem a tópicos arquivados. Para cobertura, o denominador usado acima é de 265 tópicos ativos: 169 têm guia e 96 não têm.

### Foco atual e lacunas de guia

| Matéria | Foco | Tópicos ativos | Guias | Faltantes |
|---|:---:|---:|---:|---:|
| Português | Sim | 41 | 41 | 0 |
| Raciocínio Lógico | Sim | 8 | 0 | 8 |
| Matemática | Sim | 9 | 0 | 9 |
| Direito Constitucional | Sim | 11 | 0 | 11 |
| Direito Administrativo | Sim | 14 | 14 | 0 |
| Direito Processual Penal | Sim | 15 | 15 | 0 |
| Física | Sim | 6 | 0 | 6 |
| Direito Penal | Sim | 15 | 15 | 0 |
| Informática | Sim | 22 | 11 | 11 |
| Estatística | Sim | 12 | 12 | 0 |
| Contabilidade | Sim | 10 | 10 | 0 |
| Língua Estrangeira | Sim | 6 | 6 | 0 |
| Direitos Humanos | Não | 13 | 6 | 7 |
| Ética no Serviço Público | Não | 8 | 2 | 6 |
| Execução Penal / LEP | Não | 20 | 12 | 8 |
| Geopolítica | Não | 6 | 0 | 6 |
| Legislação de Trânsito | Não | 14 | 6 | 8 |
| Legislação Penal Especial | Não | 27 | 18 | 9 |
| Redação Discursiva | Não | 8 | 1 | 7 |
| **Total** |  | **265** | **169** | **96** |

A seleção marcada em `is_focus` coincide com a sequência inicial solicitada: Português, Raciocínio Lógico, Matemática, Constitucional, Administrativo, Processual Penal, Física, Penal, Informática, Estatística, Contabilidade e Língua Estrangeira (trilha de Inglês). Trânsito permanece no currículo com `is_focus=false`.

## Fase A — alteração proposta/implementada

| Item | Antes | Agora |
|---|---|---|
| Regra do grupo “Foco principal” | Primeiras sete posições de `sort_order` | Somente `subjects.is_focus = true` |
| Ordem visual | `sort_order` | Continua exclusivamente para ordenar dentro de cada grupo |
| Contador | Derivado do corte em sete | Derivado da lista marcada; hoje são 12 |
| Personalização | Sem ação de foco | Menu da própria matéria alterna o valor persistido em `is_focus` |
| Acesso à escrita | — | Server Action valida entrada, exige usuário autenticado, filtra pelo `user_id` e ainda passa pela política RLS existente |
| Reordenação | Índices de lista podiam divergir quando grupos intercalavam | O índice para reordenar agora é localizado na lista completa de ativas |

O código não muda matérias, tópicos, notas, estados de estudo, blocos, sessões ou revisões. A migration de `is_focus`, existente no histórico de produção, estava ausente do checkout; foi sincronizada localmente com `ADD COLUMN IF NOT EXISTS`. **Não foi aplicada ao banco nesta tarefa**. A política `subjects_owner_all` está limitada por `auth.uid() = user_id` em `USING` e `WITH CHECK`.

## Fase B — dry-run antes de qualquer importação

| Entidade | Existente | Proposta neste dry-run | Duplicatas/conflitos |
|---|---:|---:|---|
| Matérias | 19 | 0 novas | 0 títulos duplicados normalizados; nenhum ID muda |
| Tópicos ativos | 265 | 0 novos | 0 status, prioridade ou tópico reescrito |
| Guias ativos | 169 | Até 96 guias novos, um para cada tópico ativo existente sem guia | 0 guias existentes sobrescritos; o vínculo é por `topic_id` canônico |
| Vínculos tópico–concurso | 89 | Reavaliar antes de acrescentar qualquer associação | Não ampliar em lote sem correspondência auditável |
| Histórico | 2 blocos; 0 sessões/lotes/erros/revisões do titular | 0 alterações | Preservado |
| Registros QA | existem fora do currículo do titular | 0 operações | Preservados |

**Lacuna crítica de evidência:** a consulta encontrou **0 dos 96 tópicos sem guia com relação direta `exam_topics`**. As três metas têm links oficiais e relações por matéria, mas elas não identificam o item/subitem do edital para cada tópico. O `source_url` do tópico pode apontar para o edital geral, o que não prova que o tema está presente. Os 96 candidatos exigem mapeamento manual contra o programa oficial; temas complementares/pré-requisitos devem ser marcados como tal. Nenhum pode ser chamado de frequente, nem receber percentual de incidência, sem classificar questões oficiais individuais e declarar denominador/gabarito.

### Distribuição dos 96 candidatos

| Matéria | Faltantes |
|---|---:|
| Direito Constitucional | 11 |
| Física | 6 |
| Informática | 11 |
| Matemática | 9 |
| Raciocínio Lógico | 8 |
| **Foco pessoal — subtotal** | **45** |
| Direitos Humanos | 7 |
| Ética no Serviço Público | 6 |
| Execução Penal / LEP | 8 |
| Geopolítica | 6 |
| Legislação de Trânsito | 8 |
| Legislação Penal Especial | 9 |
| Redação Discursiva | 7 |
| **Outras matérias — subtotal** | **51** |

## Edições/fontes oficiais de referência

- **PF 2025, Cargo 16 — Agente de Polícia Federal**, edital nº 1 de 20/05/2025, revisado até a retificação 4 de 06/08/2025. Para esse cargo, o edital separa 60 itens no Bloco I, 36 no Bloco II e 24 no Bloco III. Os 60 itens do Bloco I não foram atribuídos a uma matéria única. [PDF oficial do edital atualizado](https://cdn.cebraspe.org.br/concursos/PF_25/arquivos/Ed_1_PF_25_Abertura_Atualizado_ate_ret_4.pdf).
- **PRF 2021 — Policial Rodoviário Federal**, edital de abertura publicado pelo Cebraspe. O número de um bloco comum não deve ser tratado como número de itens de uma disciplina específica. A disciplina de trânsito deve ser confrontada com o programa listado no edital, sem extrapolar contagens retrospectivas. [PDF oficial do edital](https://cdn.cebraspe.org.br/concursos/PRF_21/arquivos/ED_1_PRF_2021_ABERTURA.PDF).
- **DEPEN 2020, Cargo 8 — Agente Federal de Execução Penal**, edital de abertura de 05/05/2020. O edital divide a objetiva em 30 itens básicos, 50 específicos e 40 complementares; não atribuir um bloco completo à LEP. [PDF oficial do edital](https://cdn.cebraspe.org.br/concursos/depen_20/arquivos/ed_1_depen_2020_abt.pdf).

Nesta etapa foram abertos os três editais oficiais. A conferência validou o cargo/edição e os totais de blocos acima, mas **não classificou questões individuais nem validou a cobertura de cada um dos 265 tópicos**. Gabaritos definitivos e cadernos por cargo/prova ainda precisam ser pareados antes de calcular incidência. Os 89 vínculos tópicos existentes são relações do usuário, não uma auditoria de cobertura e não foram alterados.

## Proteção e reconciliação

- Sem escrita no Supabase: contadores do banco antes/depois permanecem iguais aos acima.
- Sem novas matérias ou tópicos; títulos ativos não apresentaram grupos duplicados após normalização (caixa/espaços/pontuação).
- Nenhum estado, prioridade, módulo, bloco ou histórico de usuário alterado.
- Não foi testado o `UPDATE` por um usuário não proprietário. RLS foi lida no banco, mas o teste cruzado requer segunda identidade autenticada; não foi feito nesta validação.
- O botão de foco no menu foi implementado, mas a UI publicada observada ainda é a versão anterior. A validação interativa da nova versão só será possível após o deploy; não alternar e deixar alterada a preferência real do usuário para fins de teste.

## Próximo gate

Apresentar um diff de conteúdo por lote, com IDs atuais dos tópicos candidatos, proposta de guia estruturado por tópico, fundamento/trecho oficial ou indicação de pré-requisito complementar, URL, status da fonte e conflito/duplicata. A primeira proposta pode priorizar os **45 candidatos nas matérias marcadas como foco**. Nenhuma gravação será feita até a aprovação explícita desse diff. Os guias serão inseridos de forma idempotente pela chave existente `topic_id`, sem `UPDATE` de guias antigos.
