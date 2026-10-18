# Etapa 22 — Central e lembretes de estudo

## Resultado

Foi adicionada uma central de notificações interna ao header, preferências em Configurações, processamento idempotente a partir do planejamento e das revisões existentes, e envio opcional por Web Push. A funcionalidade não adiciona item de navegação, calendário, estudo, revisão ou resultado fictício.

## Auditoria antes/depois

Leitura autenticada do projeto Supabase `mnupjnlbsjsclxwlduon` antes da alteração:

| Dado | Antes | Depois das migrations e da chamada segura de processamento |
|---|---:|---:|
| Blocos de estudo | 1 | 1 |
| Sessões de estudo | 0 | 0 |
| Revisões | 0 | 0 |
| Eventos de revisão | 0 | 0 |
| Lotes de questões | 0 | 0 |
| Anotações de erros | 0 | 0 |
| Notificações | 0 | 0 |
| Inscrições Web Push | 0 | 0 |

O bloco real de Português permaneceu planejado para 18/10/2026. As preferências de notificação continuam desativadas até o titular configurá-las. O teste do endpoint retornou `401` sem segredo e `200` com segredo, sem enviar push ou criar conteúdo porque não há categorias ativadas nem inscrições.

## Estruturas e segurança

- `user_settings` recebeu flags desligadas por padrão, horário diário opcional, antecedência, silêncio e preferência de push. Horário `06:00` aparece como sugestão não salva quando ainda não existe escolha.
- `public.notifications` armazena notificações derivadas, chave única `(user_id, dedupe_key)`, índices por usuário e RLS para leitura/atualização do próprio usuário. O cliente não pode inserir nem excluir notificações e só atualiza `read_at` ou `dismissed_at`.
- `public.notification_push_subscriptions` aceita inscrição e remoção do próprio titular. Chaves de autenticação não são selecionáveis pelo cliente.
- `private.notification_push_attempts` guarda tentativas mínimas (resultado e status HTTP), sem URL do endpoint, chave, conteúdo de estudo ou credenciais.
- RPCs validam o usuário autenticado para sincronização/preferências. RPCs de processamento, claim e envio exigem `service_role` e não são concedidos a `anon`/`authenticated`.
- A Edge Function tem verificação JWT do gateway desativada para que Supabase Cron possa chamá-la; antes de processar, compara em tempo constante um segredo aleatório privado. O segredo está em Supabase Secrets e o agendamento o lê do Supabase Vault. Nenhuma service-role key foi adicionada ao cliente.
- O MCP `operacao-aprovacao-mcp` existente permaneceu inalterado e read-only.

## Regras implementadas

- Estudo: considera blocos reais `planejado`/`em_andamento` para o dia local, matéria e tópico não arquivados. Respeita horário do bloco e antecedência; se o bloco não tem horário, usa o lembrete diário confirmado. Agrupa os blocos do dia.
- Revisões: inclui somente `review_tasks` pendentes com `due_on <= dia local`, distinguindo atrasadas das de hoje. Não cria nem conclui revisões.
- Pendências: aponta o bloco incompleto mais antigo de data anterior, sem alterar a data ou mover blocos.
- Silêncio respeita intervalos no mesmo dia e intervalos que cruzam a meia-noite. Fuso inválido em processamento interno recua para `America/Sao_Paulo`.
- O processamento é repetível e concorrente sem duplicar ocorrências. Marcar como lida/dispensar não altera o progresso.
- Web Push solicita permissão somente após clique, usa Service Worker e não bloqueia a central interna. Tentativas limitadas a três, com espera entre retries; endpoints 404/410 são removidos.

## Migrations e agendamento

Aplicadas no Supabase e registradas como aplicadas:

1. `20261019120000_notification_center.sql`
2. `20261019130000_notification_scheduler_extensions.sql`
3. `20261019140000_notification_push_delivery_log.sql`
4. `20261019150000_notification_push_quiet_hours.sql`
5. `20261019160000_notification_push_timezone_fallback.sql`

Extensões habilitadas: `pg_cron 1.6.4`, `pg_net 0.20.4`; Vault já estava habilitado (`0.3.1`). O job único `process-study-notifications` está ativo em `*/5 * * * *`. A Edge Function `process-study-notifications` está ativa. A chave pública VAPID foi configurada no ambiente Production da Vercel; a privada e o token do job estão somente em Supabase Secrets.

O histórico remoto tinha a versão anterior `20261018042957` sem arquivo correspondente local. Não foi reparada nem removida. `supabase db push --dry-run` não conseguiu autenticar no Postgres porque não havia `SUPABASE_DB_PASSWORD`; as migrations novas foram aplicadas pelo canal Management API `supabase db query --linked --file`, cada uma em transação SQL, e somente seus cinco IDs foram marcados aplicados. O restante do histórico não foi alterado.

## Arquivos alterados/criados

- `src/components/header.tsx`
- `src/app/api/notifications/route.ts`
- `src/app/api/notifications/push/route.ts`
- `src/app/manifest.ts`
- `src/features/notifications/components/notification-center.tsx`
- `src/features/notifications/components/notification-preferences.tsx`
- `src/features/notifications/components/push-notifications-control.tsx`
- `src/features/notifications/data/get-notifications.ts`
- `src/features/notifications/domain/schemas.ts`
- `src/features/notifications/domain/schemas.test.ts`
- `src/features/notifications/domain/types.ts`
- `src/features/settings/actions.ts`
- `src/features/settings/components/settings-page.tsx`
- `src/features/settings/data/get-settings-page-data.ts`
- `src/lib/supabase/database.types.ts`
- `public/sw.js`
- `supabase/config.toml`
- `supabase/functions/process-study-notifications/index.ts`
- Cinco migrations listadas acima.
- Este relatório.

## Verificação

Comandos finais executados:

- `pnpm lint` — passou.
- `pnpm exec tsc --noEmit` — passou.
- `pnpm test` — passou: 22 arquivos, 72 testes.
- `pnpm build` — passou, incluindo prerender e rotas de notificação.
- `supabase functions deploy process-study-notifications --project-ref mnupjnlbsjsclxwlduon --use-api` — função ativa.
- Teste HTTP do job: sem segredo `401`; com segredo `200`, `{"processed":true,"claimed":0,"sent":0}`.
- Consulta do agendamento: um job ativo a cada cinco minutos.
- O log do Supabase registrou uma execução bem-sucedida do job.
- Consulta autenticada de contagens antes/depois: histórico inalterado e zero notificações/inscrições.
- Inspeção manual autenticada em produção: Configurações mostra as preferências desativadas por padrão; o sino mostra o estado vazio real.

Não foi criado fixture nem feito teste de inscrição Push real: isso pediria permissão ao navegador e criaria um dispositivo autorizado. As políticas e privilégios RLS foram inspecionados no banco; não havia uma segunda identidade autenticada disponível para um teste ponta a ponta de acesso entre contas. O envio real depende de o usuário optar pelo Push.

## Uso

1. Abra **Configurações → Notificações de estudos**.
2. Ative apenas as categorias que deseja receber, confirme o horário e salve. O fuso segue a rotina já configurada; os dias disponíveis são reaproveitados da preferência existente.
3. Para Push, clique em **Ativar neste navegador**, permita no diálogo do navegador e depois salve as preferências. Para cancelar, clique para desativar e salve.
4. O sino do header lista avisos reais; abrir, marcar como lido ou dispensar não conclui estudos/revisões.
5. O Push exige HTTPS e suporte do navegador. No iOS, o suporte requer iOS 16.4+ e a aplicação instalada na tela inicial; a entrega também depende do navegador, sistema e permissões. A central interna é o fallback, sem garantia de entrega em todos os dispositivos.

## Referências oficiais

- Supabase Cron: https://supabase.com/docs/guides/cron
- Agendamento de Edge Functions: https://supabase.com/docs/guides/functions/schedule-functions
- PWA e Web Push no Next.js: https://nextjs.org/docs/app/guides/progressive-web-apps
