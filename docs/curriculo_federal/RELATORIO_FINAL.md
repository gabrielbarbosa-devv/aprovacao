# Operação Aprovação — auditoria da curadoria curricular

**Consulta:** 18/10/2026 · **Supabase:** `mnupjnlbsjsclxwlduon`  
**Escopo executado:** leitura autenticada do currículo/concursos, apresentação do grupo prioritário em Matérias, exibição dos vínculos tópicos–concursos existentes, correção do layout dos modais e pesquisa inicial de fontes oficiais. Não houve escrita, migração, criação de conta, alteração de histórico nem geração de blocos.

## Estado real consultado

- 19 matérias ativas. As sete de foco já estão em `sort_order` 1–7, com IDs existentes preservados.
- 144 tópicos ativos no conjunto: Português 41, Informática 20, Direito Penal 14, Legislação Penal Especial 27, Legislação de Trânsito 14, Execução Penal / LEP 20 e Contabilidade 8.
- Não foi encontrada duplicata **exata** por título normalizado dentro de cada uma das sete matérias. Isso não exclui sobreposição conceitual entre títulos diferentes; nada foi consolidado.
- Três alvos históricos ativos existem: PF Agente 2025, PRF Policial Rodoviário 2021 e DEPEN 2020 / Agente Federal de Execução Penal. Referências e cargos não são previsões de novos editais.
- As ferramentas read-only retornaram 12/17/13 matérias e 26/14/17 títulos de tópico no escopo dos alvos PF/PRF/DEPEN. Esses totais descrevem vínculos devolvidos pela API e não demonstram mapeamento item a item nem incidência estatística.
- Sessões, resultados de questões, revisões, fichas de erro, meta, histórico e plano não foram recontados nesta etapa; portanto não afirmo total atual para essas tabelas.

O [dry-run](./DRY_RUN_DIFF.md) contém o inventário e as lacunas antes de qualquer importação. A ferramenta de consulta não expôs as relações com referências do edital, os registros completos de guias ou o histórico de cada tópico; a auditoria documental detalhada permanece incompleta.

## Mudanças de aplicação

- **Matérias:** o grupo com `sort_order` 1–7 aparece em “Foco principal”; as outras matérias ficam em “Demais matérias do edital”. Ambos usam a lista e a ordem reais do banco. Não foi adicionada navegação.
- **Detalhe de tópico:** mostra concursos associados por registros reais de `exam_topics`, com leitura filtrada por `user_id`. Quando não há vínculo direto, informa isso sem inferi-lo a partir de um vínculo genérico com a matéria.
- **Modais laterais e dialogs:** largura responsiva, títulos/descrições com quebra segura, limite de altura, rolagem vertical sem overflow horizontal e cabeçalhos/rodapés fixos nos sheets de tópicos, planejamento, concursos e caderno de erros.

## Validação executada

| Comando | Resultado observado |
|---|---|
| `pnpm lint` | **PASSOU**, ESLint sem diagnósticos. |
| `pnpm test` | **PASSOU**, 22 arquivos e 73 testes. |
| `pnpm exec tsc --noEmit` | **PASSOU**, sem erros TypeScript. |
| `pnpm build` | **PASSOU**, Next.js 16.4.2 compilou, validou TypeScript e gerou as rotas. |
| `git diff --check` | **PASSOU**, sem whitespace errors. |
| Formatter | Não existe script/configuração de formatter no `package.json`; nenhum formatter foi executado. |

O primeiro comando combinado falhou porque `node` não estava no `PATH`; os checks foram repetidos com Node 24.19.0 e pnpm 11.25.0 do runtime desktop e então passaram. O navegador bloqueou a navegação de teste para `localhost` por política de segurança; a inspeção visual autenticada pós-alteração **não foi realizada**. O build e os testes não substituem essa verificação visual.

## Fontes e limites da evidência

- PF 2025: edital oficial e gabarito definitivo do Cargo 16 identificam a aplicação em 27/07/2025; o gabarito contém itens anulados. Ainda é necessário parear o caderno objetivo correto antes de classificar todas as questões.
- PRF 2021: edital oficial e gabarito definitivo confirmam a edição/cargo; parear caderno, tipo e gabarito antes da contagem.
- DEPEN: edital histórico e cargo 8 estão identificados. Foi localizado gabarito definitivo de reaplicação em 25/08/2024, mas ele **não** deve ser confundido com uma amostra da prova-base. O caderno/gabarito definitivo precisamente pareado à edição-base ainda precisa ser confirmado.
- Nenhuma prova foi classificada questão a questão nesta execução. Não declarar tópico frequente nem calcular percentual sem denominador elegível e amostra de itens documentada.
- As contagens de questão por disciplina da tabela de concursos não foram usadas como frequência de subtópico. Peso oficial, incidência observada e prioridade pedagógica são conceitos separados.

Veja [FONTES_OFICIAIS.md](./FONTES_OFICIAIS.md) para URLs e identificação por edição/cargo.

## Pendências para concluir a curadoria

1. Fornecer o `portugues_priorizado_v1.json` integral (a cópia colada chegou truncada) e comparar seus 29 tópicos com os 41 existentes.
2. Inspecionar os 144 tópicos, módulos e guias, identificar lacunas de conteúdo e duplicidades semânticas e fechar a matriz por edital com item/seção e link oficial.
3. Conferir quais guias têm campos ausentes ou fontes insuficientes; o schema de leitura atual não prova que guias estão completos.
4. Confirmar o caderno e gabarito final corretos do DEPEN por aplicação/cargo; separar edital 2020, prova-base e reaplicações posteriores.
5. Concluir a classificação de prova e itens; armazenar metadados de edição/cargo/item/denominador só após dry-run e aprovação de mudanças de banco.
6. Se for proposto um plano, mostrar somente prévia de sete dias e pedir confirmação; não alterar blocos concluídos, fixados ou sessões existentes.
7. Executar inspeção visual autenticada em navegador autorizado. Ela não foi possível nesta execução.

**Nenhuma escrita no Supabase foi aplicada.** Antes de qualquer seed ou migração, apresentar o diff tópico a tópico e obter aprovação explícita; eventual import precisa ser idempotente, transacional e preservar IDs, status, sessões, notas, resultados, revisões e blocos atuais.
