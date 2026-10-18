import { Suspense } from "react";
import { redirect } from "next/navigation";
import { CircleDot } from "lucide-react";
import { AuthForm } from "@/features/auth/components/auth-form";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { getSafeAuthReturnTo } from "@/features/auth/return-to";

async function LoginContent({ returnTo }: { returnTo: string }) {
  const supabase = await createSupabaseServerClient();
  const { data } = await supabase.auth.getUser();
  if (data.user) redirect(returnTo);

  return (
    <main className="grid min-h-svh place-items-center bg-muted/30 p-4">
      <Card className="w-full max-w-md shadow-sm">
        <CardHeader className="space-y-4">
          <span className="grid size-11 place-items-center rounded-xl bg-primary text-primary-foreground">
            <CircleDot aria-hidden="true" className="size-6" />
          </span>
          <div className="space-y-1">
            <CardTitle className="text-2xl">Operação Aprovação</CardTitle>
            <CardDescription>Acesse seu espaço pessoal de organização dos estudos.</CardDescription>
          </div>
        </CardHeader>
        <CardContent><AuthForm returnTo={returnTo} /></CardContent>
      </Card>
    </main>
  );
}

export default async function LoginPage({ searchParams }: { searchParams: Promise<{ returnTo?: string }> }) {
  return (
    <Suspense fallback={<LoginLoading />}>
      <LoginEntry searchParams={searchParams} />
    </Suspense>
  );
}

async function LoginEntry({ searchParams }: { searchParams: Promise<{ returnTo?: string }> }) {
  const params = await searchParams;
  return <LoginContent returnTo={getSafeAuthReturnTo(params.returnTo)} />;
}

function LoginLoading() {
  return (
    <main className="grid min-h-svh place-items-center bg-muted/30 p-4" aria-label="Carregando acesso">
      <Card className="w-full max-w-md">
        <CardHeader className="space-y-4">
          <Skeleton className="size-11 rounded-xl" />
          <Skeleton className="h-7 w-52" />
          <Skeleton className="h-4 w-full" />
        </CardHeader>
        <CardContent className="space-y-5">
          <Skeleton className="h-10 w-full" />
          <Skeleton className="h-10 w-full" />
          <Skeleton className="h-10 w-full" />
        </CardContent>
      </Card>
    </main>
  );
}
