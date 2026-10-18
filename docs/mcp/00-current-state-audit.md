# Current state audit: assistant access (MCP)

Audit date: 2026-10-17  
Repository checkpoint: `d33f0c1` (`feat: add study settings and personal data exports`)  
Scope: phase A only. This document records the existing implementation and a minimal additive plan; it does not enable an MCP endpoint or change application/database behavior.

## Product goal and interpretation

The requested convenience is one HTTPS MCP URL that the user can register in Codex and, when allowed by the account/workspace, ChatGPT. The URL is an endpoint identifier, not a password: each client must complete OAuth authorization and the endpoint must derive the data owner from the verified Supabase Auth token. It will expose narrow study-domain tools over the app's current records, not source-code editing, arbitrary SQL, an AI feature inside the web app, or a second database.

The accompanying curriculum excerpt is incomplete JSON (it ends in the middle of the `PRF` object). It is data, not an implementation instruction, and is not safe to import as a catalogue. Phase D must wait for a complete, reviewed file and explicit import approval.

## Repository and environment inspected

- `README.md`, project `AGENTS.md`, `package.json`, `src/lib/supabase/database.types.ts`, authentication/session code, feature actions/read paths, and every existing SQL migration under `supabase/migrations`.
- App: Next.js App Router 16.4.2, React 19, TypeScript, Tailwind 4, shadcn/Base UI, Supabase JS/SSR. Feature code already uses a domain/data/components/actions layout.
- Existing Supabase migrations cover the product entities described below. `supabase/config.toml` and `supabase/functions/` do not exist yet.
- `.env.local` is intentionally not read or copied into this document. Per README it contains a project URL and publishable key only; no service-role secret is part of the application configuration.
- Production Supabase schema, OAuth settings, signing-key mode, live RLS state, and records were not queried in this audit. The local migration chain is evidence of intended schema, not proof that the live project is identical. No production database operation was performed.
- The repository was clean at the checkpoint above. No migration or MCP implementation has been made during this audit.

## Current architecture and source of truth

```mermaid
flowchart LR
  Browser[Next.js UI] --> Actions[Server Actions / route loaders]
  Actions --> Auth[requireUser + Supabase SSR session]
  Auth --> Valid[Zod schemas and feature rules]
  Valid --> DB[Supabase Postgres, authenticated user client]
  Valid --> RPC[Transactional Postgres RPCs]
  DB --> RLS[Row Level Security: auth.uid() = user_id]
  RPC --> RLS
  RLS --> Records[(Existing user records)]
  Metrics[Analytics pure functions] --> Facts[Sessions + question batches]
  Records --> Facts
  MCP[Future remote MCP / OAuth] -. phase B/C, pending .-> Valid
```

The existing web application obtains identity in `src/lib/auth/require-user.ts` using `supabase.auth.getUser()` on a cookie-scoped server client. `proxy.ts` refreshes Supabase session claims. User-owned row policies compare `auth.uid()` with `user_id`; SQL functions derive the actor from `auth.uid()`, revoke anonymous/public execution, and grant selected routines to `authenticated`. The existing web actions validate user input with Zod before they call database routines.

Mutating business invariants are often implemented transactionally in Postgres RPCs rather than in portable TypeScript use cases. In particular, session creation, question-batch changes, review workflow, schedule organization, topic/subject lifecycle, and exam-target links have existing database routines. These procedures, constraints, and the existing analytics reconciliation are the best current single source of truth. The new transport should call the same narrow RPCs behind explicit application use cases, not reimplement those rules in an MCP handler.

### Existing entities and integrity controls

| Entity | Existing tables / rules | Existing app coverage |
| --- | --- | --- |
| Preferences | `user_settings` (`timezone`, `daily_goal_minutes`, `weekly_availability`) | Settings edit/read and personal JSON/CSV exports |
| Curriculum | `subjects`, `topics`; per-user normalized uniqueness, topic-parent composite owner FK, archive/reorder routines | Subject and topic CRUD, archive/restore, ordering, status/priority |
| Plan | `study_blocks`; date/minute/status constraints; starter-plan, block, and reorganization RPCs | Today and weekly planning, preview/application of reorganization |
| Actual study | `study_sessions`; ownership FKs, checked counts, unique per-user `operation_key`, soft deletion, transactional save routine | Register/edit/delete sessions; scheduling occurs in DB routine |
| Question results | `question_batches`; count constraints, owner FKs, unique operation key, replacement flag for legacy session totals | Register/edit/archive batches using RPC; history and stats |
| Error notes | `mistake_entries`; owner FKs, validated fields, unique operation key, soft deletion | Create/update/archive through RPC |
| Reviews | `review_tasks`, `review_events`; unique standard interval, lifecycle/event history, timezone-aware deterministic completion/snooze RPCs | List and complete/snooze reviews; deterministic D+1/D+7/D+30 and reinforcement workflow |
| Exam goals | `exam_targets`, `exam_subjects`, `exam_topics`; same-user foreign keys and unique relation links | Create/edit/archive targets and maintain syllabus links |
| Progress | No separate aggregate table identified. `calculate-aggregates.ts` reconciles sessions with linked question batches through `replaces_session_totals` | Progress analytics, per-subject breakdown, accuracy trend and reinforcement recommendations |

Question totals are facts recorded either on a study session or a question batch. A linked active batch with `replaces_session_totals = true` supersedes that session's summary in analytics. Additive batches count alongside the legacy session summary. Multiple exam links are metadata and must not multiply study facts. The existing analytics domain has tests covering this reconciliation.

### Feature coverage matrix

| Area | Current state | MCP phase implication |
| --- | --- | --- |
| Hoje / dashboard | Exists; authenticated loader reads real settings, subjects, blocks, topics, sessions/reviews; starter plan is explicitly created by RPC | Reuse loader semantics and a user-scoped repository; no invented totals |
| Planejamento | Exists; CRUD and reorganization have Zod validation, deterministic TypeScript preview and transactional RPC application | Read first; a write tool must call same rules/RPC and preserve completed work/version conflict checks |
| Matérias / tópicos | Exists; normalized uniqueness, same-user FKs, archive/restore and order operations | Narrow upsert tools can call existing rules; detect near-duplicates, never accept owner IDs |
| Registrar estudo | Exists; Zod, timezone future-date validation, unique operation key, review scheduling in `save_study_session` | Reuse transactional RPC; no second scheduler |
| Questões / progress | Exists; Zod and RPC constraints; batch operation keys; explicit session-total replacement and aggregate functions | Reuse same write path and `calculate-aggregates`; test no double counting |
| Caderno de erros | Exists; Zod and validated save/archive routines | Reuse routine; stored notes are untrusted content when returned to a model |
| Revisões | Exists; D+1/D+7/D+30 standard tasks, event history, time-zone rules and review completion/snooze RPCs | Reuse workflow; never expose direct task-table updates |
| Concursos / mappings | Exists; goals and subject/topic links are kept in same-user transactions | Reuse transactional save routine; no invented exam facts |
| Configurações / exportação | Exists, including local JSON/CSV downloads scoped to authenticated user | No separate assistant settings store required |
| MCP transport / OAuth consent / client revocation | Missing; no Edge Function, MCP SDK, Supabase OAuth server config, consent screen or grant-management UI located | Must be added as an adapter and configured before the URL is connectable |
| Cross-tool audit/idempotency | Per-record idempotency exists for sessions, question batches and mistake notes; no general client/action ledger was found for other write families | Phase C needs a transactionally sound idempotency design for every write tool and client attribution |

## Risks and unknowns

1. **Production identity configuration is unverified.** Supabase's current authenticated MCP middleware requires an asymmetric JWT signing key, Auth OAuth 2.1 server, dynamic client registration, a consent route, and a public HTTPS site URL. None of those settings can be inferred from this repository.
2. **Live schema/RLS drift is unverified.** Local migrations and generated TypeScript types are present, but without a read-only production schema inspection, they do not prove which migrations or policies are applied in the live project.
3. **Existing app boundaries are Next-specific.** `requireUser`, `server-only`, cookies, and `revalidatePath` cannot run in a Deno Edge Function. Keep MCP transport isolated and pass its verified user-scoped Supabase client to feature application use cases/repositories; only share portable domain code or call existing transactional Postgres routines.
4. **Idempotency is uneven.** `study_sessions`, `question_batches`, and `mistake_entries` already have per-user operation keys. Settings/subject/topic/exam/plan/review mutations do not share one idempotency ledger. A retry-safe, per-user/per-client operation record must be atomic with a domain mutation; adding a non-transactional cache is insufficient.
5. **Update conflicts are uneven.** Most rows have `updated_at`, and some routines already compare expected update values, but this is not established as a uniform optimistic concurrency contract for every mutation.
6. **Stored notes can contain prompt-injection text.** Tool output must explicitly treat persisted text as data, limit size, and not act on instructions found in notes.
7. **Public endpoint does not mean public access.** OAuth discovery is public by design; private tools must return 401 without an access token and every request must use RLS-scoped user identity. Do not use service-role for user tools or provide generic SQL/table CRUD.
8. **ChatGPT availability is account/workspace-dependent.** Official OpenAI help currently documents custom remote MCP connections in the Plugins experience for eligible Business and Enterprise/Edu workspaces, subject to admin permissions. Codex CLI supports URL-configured HTTP MCP servers and OAuth login. The implementation cannot promise a connection on an ineligible ChatGPT account.
9. **Seed/import input is incomplete.** The second pasted attachment is truncated JSON, not an executable migration/import; no curriculum or progress should be inserted from it.

## Minimal additive implementation plan

### Phase B — authenticated read-only MCP

- Add one Supabase Edge Function with Streamable HTTP at `https://<project-ref>.supabase.co/functions/v1/operacao-aprovacao-mcp`.
- Use Supabase's official OAuth resource metadata and `auth: 'user'` middleware. The function derives identity only from verified token claims and uses the user-scoped Supabase client; keep existing RLS active. No service-role access.
- Add a small registry of read-only, bounded, typed tools (initially dashboard/next task, subjects/topics, plan, reviews, exam coverage, history/performance/error notes). Read using narrow selects/pagination and reuse existing pure calculations where portable.
- Add OAuth consent and connected-client revoke UI only as required by the deployed Supabase Auth flow; no chat page or sidebar redesign.
- Validate unauthenticated 401, per-user data isolation, bounded output, OAuth metadata/discovery, and read-only annotations using a local synthetic user and MCP Inspector. No production writes.

### Phase C — narrow write tools, still behind explicit user approval before enabling on a public endpoint

- Expose only domain operations that the web app already performs, each with strict Zod input, explicit ownership/reference checks, expected-version checks where needed, user-facing Portuguese metadata, and existing validated use cases/RPCs.
- Build a transactionally atomic idempotency and client audit strategy for writes that lack existing operation keys. Preserve current `operation_key` routines where they already cover retries. Do not accept `user_id`, arbitrary table names, raw SQL, or generic patches from tool arguments.
- Keep potentially destructive mutations reversible/archival and require specific confirmation for replan/archive operations. Replanning remains preview then apply with an immutable token/version.
- Verify invariants using synthetic fixture users before considering production authorization.

### Phases D/E — only after tool writes are safe

- Review scheduler/metrics/import boundaries and make only necessary deterministic consistency improvements; any import remains dry-run with an explicit approval and complete user-provided source file.
- Deploy only after OAuth configuration, local/integration tests, and approval of the public write surface. Report the actual endpoint and connection status only after exercising it with a real authorized client.

## Current decision and blockers

- Recommended transport: authenticated Supabase Edge Function using the official Supabase Auth OAuth 2.1 resource-server middleware. This produces the single HTTPS URL the user wants without exposing database credentials.
- No URL is currently live. The future URL is a path proposal only: `https://<project-ref>.supabase.co/functions/v1/operacao-aprovacao-mcp`.
- Phase A added no migration; migration list: **none**. No database, auth, GitHub, or production Vercel changes were made.
- Blocked from claiming production readiness by lack of verified live Auth OAuth configuration, signing-key mode, live schema/RLS inspection, and real-user MCP OAuth test.
- Phase A is complete. Proceeding beyond this audit requires building and testing the read-only local MCP endpoint. A later approval is mandatory before enabling public write tools or deploying a production MCP endpoint. ChatGPT connection remains subject to the user's account/workspace eligibility.

## Official implementation references checked

- [Supabase: Deploy MCP servers](https://supabase.com/docs/guides/ai-tools/byo-mcp) — authenticated Edge Function pattern, OAuth configuration prerequisites, user-scoped RLS client, client connection setup.
- [Supabase: MCP authentication](https://supabase.com/docs/guides/auth/oauth-server/mcp-authentication) — protected-resource discovery and authenticated `withSupabase({ auth: 'user' })` middleware.
- [Codex: MCP servers](https://developers.openai.com/codex/mcp) — CLI/IDE HTTP server configuration and OAuth login.
- [OpenAI Help: Connecting custom MCP servers in ChatGPT](https://help.openai.com/en/articles/12584461-connecting-custom-mcp-servers-in-chatgpt) — current connection flow and workspace eligibility.
- [Model Context Protocol specification](https://modelcontextprotocol.io/specification) — current protocol surface.
