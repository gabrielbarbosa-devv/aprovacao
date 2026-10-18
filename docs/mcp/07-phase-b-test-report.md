# Phase B verification report

## Automated checks

| Check | Result |
| --- | --- |
| `pnpm lint` | Pass |
| `pnpm exec tsc --noEmit` | Pass |
| `pnpm test` | Pass: 20 test files, 67 tests |
| `cd supabase/functions/operacao-aprovacao-mcp && deno check index.ts` | Pass |
| `pnpm build` | Pass: Next.js 16 production build and route prerender |

## Production connection checks

| Check | Result |
| --- | --- |
| Vercel consent route `https://aprovacao-tau.vercel.app/oauth/consent` | Pass: HTTP 200 |
| Supabase protected-resource discovery | Pass: HTTP 200 with the configured OAuth issuer |
| Unauthenticated MCP endpoint | Pass: HTTP 401 |
| OAuth server metadata | Pass: dynamic registration endpoint advertised; ES256 JWKS key present |
| Codex OAuth login | Pass: `codex mcp login operacao-aprovacao` completed |
| MCP `tools/list` through Codex | Pass: nine read-only tools returned, no records queried |

## Remaining integration checks

The local Docker/Supabase runtime is not installed in this environment. A real authenticated data query, synthetic-user RLS isolation, result-bound checks against production records, and grant revocation have not been exercised end to end. No study records were read during the connection verification.
