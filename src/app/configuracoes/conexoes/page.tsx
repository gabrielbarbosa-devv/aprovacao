import { Suspense } from "react";
import { redirect } from "next/navigation";
import { Link2Off, ShieldCheck } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { AppShell } from "@/components/app-shell";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { revokeOAuthGrant } from "./actions";

type SearchParams = Promise<{ status?: string }>;

export default function ConnectedAppsPage({ searchParams }: { searchParams: SearchParams }) {
  return <Suspense fallback={<ConnectionsLoading />}><ConnectedAppsContent searchParams={searchParams} /></Suspense>;
}

async function ConnectedAppsContent({ searchParams }: { searchParams: SearchParams }) {
  const { status } = await searchParams;
  const supabase = await createSupabaseServerClient();
  const { data: user } = await supabase.auth.getUser();
  if (!user.user) redirect("/login");
  const { data, error } = await supabase.auth.oauth.listGrants();

  return (
    <AppShell email={user.user.email ?? ""} activeItem="configuracoes">
    <main className="mx-auto min-h-svh w-full max-w-3xl flex-1 space-y-6 px-4 py-10 sm:px-6">
      <header className="space-y-2">
        <p className="text-xs font-semibold uppercase tracking-[0.16em] text-primary">Privacidade da conta</p>
        <h1 className="text-3xl font-semibold tracking-tight">Aplicativos conectados</h1>
        <p className="text-muted-foreground">Confira os aplicativos autorizados a acessar os dados da sua conta e encerre conexões quando quiser.</p>
      </header>
      {status === "revoked" ? <p role="status" className="rounded-lg border border-primary/20 bg-primary/5 p-3 text-sm">A conexão foi revogada.</p> : null}
      {status === "error" || status === "invalid" ? <p role="alert" className="rounded-lg border border-destructive/30 bg-destructive/5 p-3 text-sm text-destructive">Não foi possível revogar essa conexão. Atualize a página e tente novamente.</p> : null}
      <Card>
        <CardHeader>
          <div className="flex items-center gap-3">
            <span className="grid size-10 place-items-center rounded-lg bg-primary/10 text-primary"><ShieldCheck aria-hidden="true" className="size-5" /></span>
            <div className="space-y-1"><CardTitle>Autorizações OAuth</CardTitle><CardDescription>As permissões refletem o consentimento concedido em cada aplicativo.</CardDescription></div>
          </div>
        </CardHeader>
        <CardContent className="space-y-3">
          {error ? <p role="alert" className="text-sm text-destructive">Não foi possível carregar as conexões. A configuração OAuth do Supabase pode ainda não estar habilitada neste ambiente.</p> : null}
          {!error && (data ?? []).length === 0 ? <p className="rounded-lg border border-dashed p-6 text-center text-sm text-muted-foreground">Nenhum aplicativo foi autorizado nesta conta.</p> : null}
          {(data ?? []).map((grant) => (
            <section key={grant.client.id} className="flex flex-col gap-4 rounded-lg border p-4 sm:flex-row sm:items-center sm:justify-between">
              <div className="min-w-0 space-y-2">
                <h2 className="font-medium">{grant.client.name}</h2>
                {grant.client.uri ? <p className="break-all text-sm text-muted-foreground">{grant.client.uri}</p> : null}
                <div className="flex flex-wrap gap-2">
                  {grant.scopes.map((scope) => <Badge key={scope} variant="secondary">{scope}</Badge>)}
                  <span className="self-center text-xs text-muted-foreground">Autorizado em {new Intl.DateTimeFormat("pt-BR", { dateStyle: "medium" }).format(new Date(grant.granted_at))}</span>
                </div>
              </div>
              <form action={revokeOAuthGrant}>
                <input type="hidden" name="client_id" value={grant.client.id} />
                <Button variant="outline" type="submit" className="w-full sm:w-auto"><Link2Off aria-hidden="true" />Revogar acesso</Button>
              </form>
            </section>
          ))}
        </CardContent>
      </Card>
    </main>
    </AppShell>
  );
}

function ConnectionsLoading() {
  return <main className="mx-auto min-h-svh w-full max-w-3xl space-y-6 px-4 py-10 sm:px-6"><Skeleton className="h-4 w-40" /><Skeleton className="h-10 w-72" /><Skeleton className="h-4 w-full max-w-xl" /><Card><CardHeader><Skeleton className="h-6 w-52" /><Skeleton className="h-4 w-full max-w-md" /></CardHeader><CardContent className="space-y-3"><Skeleton className="h-24 w-full" /><Skeleton className="h-24 w-full" /></CardContent></Card></main>;
}
