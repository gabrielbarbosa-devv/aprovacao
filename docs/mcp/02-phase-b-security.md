# Phase B: authentication and security controls

## Authentication and authorization

- Supabase Auth is the OAuth 2.1 authorization server.
- The browser consent route retrieves authorization details using the user's cookie-backed Supabase client; missing/expired requests are rejected without exposing raw provider errors.
- The login continuation only accepts a relative `/oauth/consent?authorization_id=...` path matching a narrow character allowlist.
- OAuth authorization and revocation use the Supabase Auth JS OAuth APIs. Grant revocation invalidates the corresponding authorization/session as handled by Supabase Auth.
- Edge Function OAuth discovery is intentionally reachable without a bearer token. MCP initialize/list/call requests pass through `withSupabase({ auth: 'user' })`, which verifies a user token and produces a user-scoped client.
- SQL reads use explicit `user_id` filters and rely on the existing RLS policies as the final database boundary. No service-role key is used.

## Tool surface

All tools declare `readOnlyHint: true`, `destructiveHint: false`, and `openWorldHint: false`. Tool inputs are Zod-validated. Result JSON is capped at 48 KB. List tools cap requested rows; date-window tools validate real ISO dates and limit their ranges. Analytics refuses to calculate if the source queries exceed safe row caps.

Text fields written by the user (topic notes, study notes, mistake descriptions, exam notes) are returned as data and length-limited. Tool descriptions instruct consuming models not to interpret those fields as instructions. Database errors are replaced with generic Portuguese error messages.

## Operational prerequisites before production

1. Verify the Supabase OAuth server is enabled and the project uses an asymmetric signing key supported by the Edge Function middleware.
2. Set the production Auth Site URL to the deployed consent-screen origin (not `localhost`).
3. Decide whether to enable dynamic OAuth client registration. It is required for clients that expect to register themselves and means compatible clients can request registration; the user still must consent before access.
4. Deploy the consent route to Vercel, verify Auth redirect allowlists, deploy the Edge Function, then test OAuth discovery and consent using a dedicated test user.
5. Confirm anonymous requests receive 401 with resource metadata, authenticated requests only see that user's rows, and grant revocation blocks subsequent MCP calls.

No production Auth configuration, function deployment, database migration, or production data access was performed during Phase B implementation.
