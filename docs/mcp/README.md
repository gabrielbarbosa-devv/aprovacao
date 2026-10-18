# Operação Aprovação MCP

The intended single server URL is:

```text
https://mnupjnlbsjsclxwlduon.supabase.co/functions/v1/operacao-aprovacao-mcp
```

The URL is live. The Next.js consent route is deployed at `https://aprovacao-tau.vercel.app/oauth/consent`, the Supabase OAuth server and dynamic client registration are enabled, and the Edge Function is deployed with JWT verification handled by Supabase's user-auth middleware. The Codex CLI has completed OAuth login and successfully listed the server's nine tools.

Codex CLI connection (already configured globally for this user):

```sh
codex mcp add operacao-aprovacao --url https://mnupjnlbsjsclxwlduon.supabase.co/functions/v1/operacao-aprovacao-mcp
codex mcp login operacao-aprovacao
```

Codex Desktop can use the same URL in MCP server settings and open the browser flow for OAuth consent. In ChatGPT, remote MCP availability depends on the account/workspace plan and its administrator settings; add the same URL under the available custom connector/developer settings, then sign in and consent.

The connection is OAuth-authenticated and read-only. It exposes only the current user's scoped study data; no tools can mutate data. Discovery returns 200, unauthenticated MCP requests return 401, and OAuth uses the project's ES256 signing key. A full user-data query, cross-user isolation test, and grant-revocation test remain to be exercised. See `03-phase-b-tool-contracts.md` for the exact read surface.
