import { McpServer } from "npm:@modelcontextprotocol/server@2.3.1";
import { z } from "npm:zod@4.6.7";
import type { SupabaseClient } from "npm:@supabase/supabase-js@2.118.0";
import type { Database } from "../../../src/lib/supabase/database.types.ts";
import { toolError, toolResult } from "./tools.ts";

type Client = SupabaseClient<Database>;
type ToolServer = InstanceType<typeof McpServer>;

const createSubjectInput = z.object({
  name: z.string().trim().min(1).max(80).transform((name) => name.replace(/\s+/g, " ")),
  colorToken: z.enum(["blue", "green", "violet", "orange", "rose"]).nullable().default(null),
});

export function registerWriteTools(server: ToolServer, client: Client, userId: string): void {
  server.registerTool("create_subject", {
    title: "Cadastrar matéria",
    description: "Cria uma matéria na conta autenticada. Não cria tópicos, registros de estudo nem blocos de planejamento. Se já houver matéria com o mesmo nome (ignorando maiúsculas e minúsculas), não duplica e informa que ela já existe.",
    inputSchema: createSubjectInput,
    annotations: { readOnlyHint: false, destructiveHint: false, openWorldHint: false },
  }, async ({ name, colorToken }) => {
    const { data: lastSubject, error: orderError } = await client
      .from("subjects")
      .select("sort_order")
      .eq("user_id", userId)
      .order("sort_order", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (orderError) return toolError("Não foi possível preparar a nova matéria.");

    const { data, error } = await client.from("subjects").insert({
      user_id: userId,
      name,
      color_token: colorToken,
      sort_order: (lastSubject?.sort_order ?? 0) + 1,
    }).select("id, name, color_token, sort_order").single();

    if (error?.code === "23505") {
      return toolResult({ status: "already_exists", name, message: "Já existe uma matéria com esse nome na sua conta." });
    }
    if (error || !data) return toolError("Não foi possível cadastrar a matéria. Confira os dados e tente novamente.");

    return toolResult({
      status: "created",
      subject: { id: data.id, name: data.name, colorToken: data.color_token, sortOrder: data.sort_order },
    });
  });
}
