# Operação Aprovação MCP

The intended single server URL is:

```text
https://mnupjnlbsjsclxwlduon.supabase.co/functions/v1/operacao-aprovacao-mcp
```

**This URL is not live yet.** Phase B implements the source and OAuth consent flow locally. Production OAuth settings still show `localhost` in the supplied dashboard screenshot, and the Supabase Edge Function has not been deployed or tested against a real OAuth client. Do not add this URL to an MCP client until the production checklist in `02-phase-b-security.md` is completed.

After production setup, Codex CLI can connect with:

```sh
codex mcp add operacao-aprovacao --url https://mnupjnlbsjsclxwlduon.supabase.co/functions/v1/operacao-aprovacao-mcp
codex mcp login operacao-aprovacao
```

Codex Desktop can use the same URL in MCP server settings and open the browser flow for OAuth consent. In ChatGPT, remote MCP availability depends on the account/workspace plan and its administrator settings; add the same URL under the available custom connector/developer settings, then sign in and consent.

See `03-phase-b-tool-contracts.md` for the exact read surface. No tools can currently mutate data.
