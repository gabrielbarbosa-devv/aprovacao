"use client";

import { useActionState, useState } from "react";
import { KeyRound, LoaderCircle, Mail } from "lucide-react";
import { loginAction, signupAction, type AuthActionResult } from "@/features/auth/actions";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

const initialState: AuthActionResult = { status: "idle", message: "" };

export function AuthForm({ returnTo = "/" }: { returnTo?: string }) {
  const [signup, setSignup] = useState(false);
  const action = signup ? signupAction : loginAction;
  const [result, formAction, pending] = useActionState<AuthActionResult, FormData>(action, initialState);

  return (
    <form action={formAction} className="space-y-5">
      <input type="hidden" name="returnTo" value={returnTo} />
      <div className="space-y-2">
        <Label htmlFor="email">E-mail</Label>
        <div className="relative">
          <Mail aria-hidden="true" className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input id="email" name="email" type="email" autoComplete="email" required className="pl-9" />
        </div>
      </div>
      <div className="space-y-2">
        <Label htmlFor="password">Senha</Label>
        <div className="relative">
          <KeyRound aria-hidden="true" className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input id="password" name="password" type="password" autoComplete={signup ? "new-password" : "current-password"} required className="pl-9" />
        </div>
        {signup ? <p className="text-xs text-muted-foreground">Use pelo menos 8 caracteres.</p> : null}
      </div>
      {result.message ? (
        <Alert variant={result.status === "error" ? "destructive" : "default"} aria-live="polite">
          <AlertDescription>{result.message}</AlertDescription>
        </Alert>
      ) : null}
      <Button type="submit" className="w-full" disabled={pending}>
        {pending ? <LoaderCircle aria-hidden="true" className="size-4 animate-spin" /> : null}
        {signup ? "Criar conta" : "Entrar"}
      </Button>
      <p className="text-center text-sm text-muted-foreground">
        {signup ? "Já tem conta?" : "Ainda não tem conta?"}{" "}
        <Button type="button" variant="link" onClick={() => setSignup((value) => !value)} className="h-auto p-0 font-medium">
          {signup ? "Entrar" : "Criar conta"}
        </Button>
      </p>
    </form>
  );
}
