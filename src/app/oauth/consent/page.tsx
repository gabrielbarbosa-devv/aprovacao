import { Suspense } from "react";
import { redirect } from "next/navigation";
import Link from "next/link";
import { AlertCircle, Check, CircleDot, ShieldCheck } from "lucide-react";
import { Button, buttonVariants } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { decideOAuthConsent } from "./actions";

type SearchParams = Promise<{ authorization_id?: string; error?: string }>;

export default function OAuthConsentPage({ searchParams }: { searchParams: SearchParams }) {
  return <Suspense fallback={<ConsentLoading />}><OAuthConsentContent searchParams={searchParams} /></Suspense>;
}

async function OAuthConsentContent({ searchParams }: { searchParams: SearchParams }) {
  const { authorization_id: authorizationId, error: errorCode } = await searchParams;
  if (!authorizationId || !/^[A-Za-z0-9_-]{1,200}$/.test(authorizationId)) {
    return <ConsentError message="Esta solicitação de acesso está incompleta ou expirou. Volte ao aplicativo que iniciou a conexão e tente novamente." />;
  }

  const supabase = await createSupabaseServerClient();
  const { data: authData } = await supabase.auth.getUser();
  if (!authData.user) {
    const returnTo = `/oauth/consent?authorization_id=${encodeURIComponent(authorizationId)}`;
    redirect(`/login?returnTo=${encodeURIComponent(returnTo)}`);
  }

  const { data, error } = await supabase.auth.oauth.getAuthorizationDetails(authorizationId);
  if (error || !data) {
    return <ConsentError message="Não foi possível validar o aplicativo solicitante. Feche esta página e inicie a conexão novamente pelo aplicativo." />;
  }
  if (!("authorization_id" in data)) redirect(data.redirect_url);

  const scopes = data.scope.split(/\s+/).filter(Boolean);

  return (
    <main className="grid min-h-svh place-items-center bg-muted/30 p-4">
      <Card className="w-full max-w-lg shadow-sm">
        <CardHeader className="space-y-4">
          <span className="grid size-11 place-items-center rounded-xl bg-primary text-primary-foreground">
            <CircleDot aria-hidden="true" className="size-6" />
          </span>
          <div className="space-y-1">
            <CardTitle className="text-2xl">Conectar aplicativo</CardTitle>
            <CardDescription>Revise o acesso antes de autorizar. Você pode revogar esta conexão em <Link href="/configuracoes/conexoes" className="font-medium text-primary underline-offset-4 hover:underline">Aplicativos conectados</Link>.</CardDescription>
          </div>
        </CardHeader>
        <CardContent className="space-y-6">
          {errorCode ? <p role="alert" className="rounded-md border border-destructive/30 bg-destructive/5 p-3 text-sm text-destructive">Não foi possível concluir a autorização. Confira a solicitação e tente novamente.</p> : null}
          <section className="rounded-lg border bg-muted/20 p-4" aria-label="Aplicativo solicitante">
            <p className="font-semibold">{data.client.name}</p>
            {data.client.uri ? <p className="mt-1 break-all text-sm text-muted-foreground">{data.client.uri}</p> : null}
            <p className="mt-3 text-xs text-muted-foreground">Conta: {authData.user.email ?? "sua conta"}</p>
          </section>
          <section className="space-y-3">
            <h2 className="text-sm font-semibold">Acesso solicitado</h2>
            <ul className="space-y-2 text-sm text-muted-foreground">
              <li className="flex gap-2"><ShieldCheck aria-hidden="true" className="mt-0.5 size-4 shrink-0 text-primary" />Consultar seus registros de estudo, planejamento, matérias, revisões, concursos e desempenho.</li>
              <li className="flex gap-2"><Check aria-hidden="true" className="mt-0.5 size-4 shrink-0 text-primary" />Este conector está configurado como somente leitura; ele não pode alterar seus dados.</li>
            </ul>
            {scopes.length > 0 ? <p className="text-xs text-muted-foreground">Permissões OAuth solicitadas: {scopes.join(", ")}</p> : null}
          </section>
          <div className="flex flex-col-reverse gap-2 border-t pt-4 sm:flex-row sm:justify-end">
            <form action={decideOAuthConsent}>
              <input type="hidden" name="authorization_id" value={authorizationId} />
              <input type="hidden" name="decision" value="deny" />
              <Button type="submit" variant="outline" className="w-full sm:w-auto">Recusar</Button>
            </form>
            <form action={decideOAuthConsent}>
              <input type="hidden" name="authorization_id" value={authorizationId} />
              <input type="hidden" name="decision" value="approve" />
              <Button type="submit" className="w-full sm:w-auto">Autorizar acesso</Button>
            </form>
          </div>
        </CardContent>
      </Card>
    </main>
  );
}

function ConsentLoading() {
  return <main className="grid min-h-svh place-items-center bg-muted/30 p-4"><Card className="w-full max-w-lg"><CardHeader className="space-y-4"><Skeleton className="size-11 rounded-xl" /><Skeleton className="h-7 w-56" /><Skeleton className="h-4 w-full" /></CardHeader><CardContent className="space-y-5"><Skeleton className="h-24 w-full" /><Skeleton className="h-20 w-full" /><div className="flex justify-end gap-2"><Skeleton className="h-9 w-24" /><Skeleton className="h-9 w-36" /></div></CardContent></Card></main>;
}

function ConsentError({ message }: { message: string }) {
  return (
    <main className="grid min-h-svh place-items-center bg-muted/30 p-4">
      <Card className="w-full max-w-lg">
        <CardHeader>
          <span className="grid size-11 place-items-center rounded-xl bg-destructive/10 text-destructive"><AlertCircle aria-hidden="true" className="size-5" /></span>
          <CardTitle>Não foi possível conectar</CardTitle>
          <CardDescription>{message}</CardDescription>
        </CardHeader>
        <CardContent><Link className={buttonVariants({ variant: "outline" })} href="/">Voltar ao início</Link></CardContent>
      </Card>
    </main>
  );
}
