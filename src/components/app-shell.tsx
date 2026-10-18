import type { ReactNode } from "react";
import { Header } from "@/components/header";
import { Sidebar } from "@/components/sidebar";

export function AppShell({ children, email, activeItem }: { children: ReactNode; email: string; activeItem?: "hoje" | "planejamento" | "materias" | "revisoes" | "concursos" | "registros" | "caderno-de-erros" | "meu-progresso" | "configuracoes" }) {
  return (
    <div className="min-h-svh bg-muted/30 text-foreground lg:grid lg:grid-cols-[252px_minmax(0,1fr)]">
      <div className="hidden lg:block"><Sidebar email={email} activeItem={activeItem} /></div>
      <div className="flex min-h-svh min-w-0 flex-col">
        <Header email={email} activeItem={activeItem} />
        {children}
      </div>
    </div>
  );
}
