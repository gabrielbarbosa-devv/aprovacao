# Dry-run da curadoria das sete matérias prioritárias

**Consulta read-only:** 18/10/2026, projeto `mnupjnlbsjsclxwlduon`. Nenhuma escrita, migração, reorganização do planejamento ou alteração de status foi feita. Este é um diff de auditoria, não uma autorização para importar.

## Existente no Supabase

Há 19 matérias ativas. As sete matérias foco já ocupam `sort_order` 1–7; seus IDs foram preservados durante esta auditoria.

| Ordem | Matéria existente | Tópicos ativos | Duplicatas exatas normalizadas dentro da matéria |
|---:|---|---:|---:|
| 1 | Português | 41 | 0 |
| 2 | Informática | 20 | 0 |
| 3 | Direito Penal | 14 | 0 |
| 4 | Legislação Penal Especial | 27 | 0 |
| 5 | Legislação de Trânsito | 14 | 0 |
| 6 | Execução Penal / LEP | 20 | 0 |
| 7 | Contabilidade | 8 | 0 |
|  | **Total do grupo foco** | **144** | **0** |

O catálogo não deve criar novas matérias nem substituir tópicos existentes. A comparação exata não detecta duplicidades semânticas; títulos parecidos, assuntos parcialmente sobrepostos, versões de leis e agrupamentos de resoluções precisam de revisão humana antes de qualquer consolidação.

Também existem três alvos históricos ativos: PF — Agente (2025), PRF — Policial Rodoviário (2021) e Polícia Penal Federal — DEPEN (2020). As consultas de leitura retornaram respectivamente 12, 17 e 13 vínculos de matéria, e listas de 26, 14 e 17 títulos de tópico no escopo de cada alvo. Esses números são contagens de vínculos/títulos devolvidos pela ferramenta, **não** contagens oficiais de questões classificadas nem prova de que cada título corresponde corretamente ao item do edital.

## Alteração de interface proposta nesta etapa

- Em **Matérias**, agrupar em “Foco principal” matérias cujo `sort_order` existente é de 1 a 7.
- Exibir as demais matérias em “Demais matérias do edital”, mantendo a ordem que já vem do banco.
- Nenhum registro, relação, ordenação ou status será alterado pelo agrupamento visual.
- Ajustar componentes de dialog/sheet para títulos e descrições quebrarem linha, evitar overflow horizontal e manter cabeçalho/rodapé disponíveis enquanto o conteúdo longo rola.

## Em aberto antes de qualquer importação ou escrita

| Área | Constatação atual | Próximo passo seguro |
|---|---|---|
| Catálogo Português 29 tópicos | Entrada colada recebida está truncada; Português já tem 41 tópicos com IDs/histórico próprio | Comparar o JSON integral por título normalizado e conteúdo, listando colisões sem substituir registros |
| Guias didáticos | Há notas nos tópicos; a leitura MCP disponível não expõe `topic_study_guides` nem auditoria de cada campo/guia | Inspecionar a tabela e confrontar cobertura antes de gerar ou atualizar textos |
| Mapeamentos por edital | Existem referências de tópicos exibidas nos alvos, mas a ferramenta read-only não retorna IDs, item/seção, justificativa ou estado da fonte | Conferir cada relação com edital/retificações; mapear só correspondência demonstrável |
| Provas classificadas | Nenhuma amostra foi classificada item por item nesta etapa | Definir caderno e gabarito definitivo pareados por cargo/edição, registrar cada item elegível e seu único tópico primário antes de calcular incidência |
| Frequência oficial por tópico | Não comprovada; não há denominador auditado | Manter indisponível/“não apurada”; não inventar porcentagens nem declarar frequência |
| Norma vigente vs. edital histórico | Resoluções, portarias e leis podem ter mudado desde as edições históricas | Separar cobertura do edital de 2020/2021/2025 da vigência atual e registrar data de auditoria por norma |
| Plano de estudos | Dados de blocos e preferências não foram reconsultados nesta auditoria | Não criar nem substituir blocos; futura proposta deve mostrar só prévia de 7 dias e respeitar concluídos/fixados |

## Conflitos e riscos já identificados

- A matéria `Português` existente é canônica; “Língua Portuguesa” deve ser tratado como alias de edital, não como matéria nova.
- Os três alvos são referências de edições encerradas. O rótulo DEPEN 2020 registra o cargo histórico de Agente Federal de Execução Penal e não significa que seja um edital atual de Polícia Penal Federal.
- Agrupar assuntos em um tópico não comprova que todo o grupo constava do mesmo item oficial. Resoluções CONTRAN e o conteúdo do Bloco III DEPEN precisam de granularidade de fonte antes de associar ou contar.
- Há IDs, estados, tempos estimados, notas, prioridades e referências existentes. Nada disso foi atualizado ou apagado.

## Autorização e estratégia de rollback

Nenhuma operação de banco foi executada. Antes de qualquer importação, apresentar diff tópico por tópico com existentes/propostos/colisões, alvos e evidência oficial, e obter aprovação explícita. A execução futura deverá ser uma migração/import transacional e idempotente que cria somente linhas ausentes; não atualiza status, sessões, resultados, revisões, notas ou prioridade manual. Se a validação falhar, reverter somente as linhas criadas pela operação via chave de importação, sem excluir registros anteriores.
