# Operação Aprovação — auditoria inicial do Lote 1

> **Snapshot supersedido.** Os números deste relatório refletem uma consulta anterior. A consulta autenticada mais recente encontrou 260 tópicos ativos, 143 guias e 57 relações `exam_topics` no conjunto dos três alvos. Consulte [AUDITORIA_DE_FECHAMENTO_2026-10-18.md](./AUDITORIA_DE_FECHAMENTO_2026-10-18.md) para o estado atual. As contagens antigas permanecem abaixo apenas como histórico da execução anterior.

**Data:** 18/10/2026  
**Escopo:** leitura do repositório, consulta read-only ao Supabase e inspeção da interface autenticada em produção. Nenhum dado do banco foi gravado ou removido nesta etapa.

## Dados confirmados

A conta principal tem 19 matérias, 51 módulos, 193 tópicos ativos, 78 guias, 3 concursos-alvo, 42 relações matéria–concurso, 0 relações tópico–concurso e 2 blocos planejados. Há 0 sessões, lotes de questões, erros e revisões para o titular nesta consulta. As tabelas consultadas têm RLS habilitada; isso não substitui um teste separado de políticas com identidades autenticadas diferentes.

O Lote 1 tem 78 tópicos e 78 guias nos quatro componentes listados no [diff](./LOTE_1_DIFF_2026-10-18.md). A verificação de duplicatas exatas normalizadas encontrou 0; duplicatas semânticas e pertinência tópico a tópico permanecem pendentes.

Um conjunto separado de QA existe na conta de teste identificada como QA. Ele não aparece nas contagens do titular e foi preservado. Não se recomenda misturar esse conjunto com o currículo do titular.

## Pesquisa e cobertura

Editais oficiais confirmam os programas e cargos de referência, mas não produzem por si sós estatísticas de incidência. As páginas oficiais mostram materiais de prova/gabarito para os comparadores FGV/Vunesp; para os concursos Cebraspe, é necessário parear cada caderno de cargo e sua chave definitiva. Até cada questão estar classificada com edição, cargo, banca, item, denominador e chave, a incidência permanece **não apurada**.

As 12 relações de matéria existentes entre quatro matérias e três alvos serão preservadas. Nenhum dos 78 tópicos será vinculado em massa. A estrutura de `exam_topics` não comporta atualmente os metadados de evidência exigidos para uma auditoria reproduzível; a proposta de extensão deverá ser aditiva, RLS-scoped e submetida como diff antes de migração.

## Interface

A rota autenticada `/` foi inspecionada em produção no Chrome: Hoje carregou com dois blocos do plano atual, zero revisões pendentes e atalhos existentes. A interface de Matérias em produção foi anteriormente observada como lista longa de uma coluna. A implementação local agora centraliza larguras e espaçamentos, usa duas colunas para matérias a partir de `xl`, reduz alturas dos estados vazios e harmoniza páginas de carregamento. A validação visual desta alteração local e sua publicação ficam condicionadas ao build/testes concluídos no mesmo commit.

Não foi testado o comportamento de filtro tópico–concurso porque o vínculo não existe ainda. Não se afirma cobertura integral do Lote 1.

## Validação técnica

- `pnpm lint`: aprovado.
- `pnpm exec tsc --noEmit`: aprovado.
- `pnpm test`: aprovado, 22 arquivos e 73 testes.
- `pnpm build`: aprovado; Next.js 16.4.2 gerou as rotas de produção.

Os comandos precisaram incluir o runtime Node empacotado pelo Codex no `PATH`, porque o terminal padrão disponibiliza pnpm mas não encontra `node`.

## Alterações desta etapa

Ajuste compartilhado de largura e espaçamento das páginas, grade de matérias de duas colunas em desktop, linhas de matéria mais compactas, estados vazios menores e skeletons com respiro equivalente. Os detalhes estão no diff de código do repositório. Nenhum item de navegação foi adicionado e nenhuma regra de dados foi modificada.

## Próximos passos

1. Revisar e aprovar o diff de cobertura antes de gravar quaisquer ligações ou migrar o schema.
2. Concluir a classificação das provas do Lote 1, incluindo as questões individuais e status final de chave.
3. Só então preparar um diff de importação idempotente, com pré-condições, contagens antes/depois e plano de rollback.
4. Testar Matérias, Detalhe do Tópico, Hoje, Planejamento, registro, Revisões e Caderno de Erros com conta de QA isolada após cada lote.

**Operação recomendada amanhã:** abrir Hoje; estudar o primeiro tópico com uma videoaula externa; resolver questões em um site externo; registrar minutos, questões e acertos reais; conferir as revisões vencidas depois.
