-- Safe additive scheduler prerequisites. A single scheduled job is configured
-- after the Edge Function secrets are installed, using Supabase Vault.
create extension if not exists pg_cron with schema pg_catalog;
create extension if not exists pg_net with schema extensions;
