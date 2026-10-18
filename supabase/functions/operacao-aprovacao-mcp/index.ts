/// <reference lib="deno.ns" />
import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createMcpHandler, McpServer } from "npm:@modelcontextprotocol/server@2.3.1";
import { pipeline } from "npm:@supabase/middleware@1.0.0";
import { withOAuthProtectedResource, withSupabase } from "npm:@supabase/server@1.9.2";
import type { Database } from "../../../src/lib/supabase/database.types.ts";
import { registerReadTools } from "./tools.ts";

const middleware = [
  withOAuthProtectedResource(),
  withSupabase<Database>({ auth: "user", cors: "disabled" }),
] as const;

Deno.serve(
  pipeline(middleware, async (request, { supabase }) => {
    const { data, error } = await supabase.auth.getUser();
    if (error || !data.user) {
      return Response.json({ error: "Unauthorized" }, { status: 401 });
    }

    const handler = createMcpHandler(() => {
      const server = new McpServer({ name: "operacao-aprovacao", version: "0.2.0" });
      registerReadTools(server, supabase, data.user.id);
      return server;
    });

    return handler.fetch(request);
  }),
);
