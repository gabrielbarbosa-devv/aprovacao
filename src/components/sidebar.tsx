import Link from "next/link";
import {
  BookOpen,
  CalendarDays,
  CircleDot,
  Home,
  RefreshCw,
  Settings,
  Trophy,
} from "lucide-react";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { SignOutButton } from "@/components/sign-out-button";

type SidebarProps = {
  email: string;
  activeItem?: "hoje" | "planejamento" | "materias";
};

const unavailableItems = [
  { label: "Revisões", icon: RefreshCw },
  { label: "Concursos", icon: Trophy },
] as const;

function getInitials(email: string): string {
  const name = email.split("@")[0] ?? email;
  const initials = name.split(/[._-]+/).filter(Boolean).slice(0, 2).map((part) => part[0]);
  return initials.join("").toLocaleUpperCase("pt-BR") || "OA";
}

export function Sidebar({ email, activeItem = "hoje" }: SidebarProps) {
  const activeClass = "bg-primary/10 text-primary";
  return (
    <aside className="flex h-full min-h-0 w-full flex-col bg-background p-4 lg:sticky lg:top-0 lg:h-svh lg:w-auto lg:border-r lg:p-5">
      <Link href="/" className="mb-8 flex shrink-0 items-center gap-3 px-2" aria-label="Operação Aprovação, Hoje">
        <span className="grid size-10 place-items-center rounded-xl bg-primary text-primary-foreground">
          <CircleDot aria-hidden="true" className="size-5" />
        </span>
        <span className="leading-tight">
          <span className="block text-sm font-bold tracking-tight">Operação Aprovação</span>
          <span className="mt-1 block text-xs text-muted-foreground">Seu espaço de estudos</span>
        </span>
      </Link>

      <p className="mb-2 px-3 text-[10px] font-semibold uppercase tracking-[0.16em] text-muted-foreground">Organização</p>
      <nav aria-label="Navegação principal" className="flex flex-col gap-1">
        <Link
          href="/"
          aria-current={activeItem === "hoje" ? "page" : undefined}
          className={`flex h-11 items-center gap-3 rounded-lg px-3 text-sm font-semibold outline-none focus-visible:ring-2 focus-visible:ring-ring ${activeItem === "hoje" ? activeClass : "text-muted-foreground hover:bg-muted"}`}
        >
          <Home aria-hidden="true" className="size-4" />
          Hoje
          {activeItem === "hoje" ? <span aria-hidden="true" className="ml-auto size-1.5 rounded-full bg-primary" /> : null}
        </Link>
        <Link
          href="/planejamento"
          aria-current={activeItem === "planejamento" ? "page" : undefined}
          className={`flex h-11 items-center gap-3 rounded-lg px-3 text-sm font-semibold outline-none focus-visible:ring-2 focus-visible:ring-ring ${activeItem === "planejamento" ? activeClass : "text-muted-foreground hover:bg-muted"}`}
        >
          <CalendarDays aria-hidden="true" className="size-4" />
          Planejamento
          {activeItem === "planejamento" ? <span aria-hidden="true" className="ml-auto size-1.5 rounded-full bg-primary" /> : null}
        </Link>
        <Link
          href="/materias"
          aria-current={activeItem === "materias" ? "page" : undefined}
          className={`flex h-11 items-center gap-3 rounded-lg px-3 text-sm font-semibold outline-none focus-visible:ring-2 focus-visible:ring-ring ${activeItem === "materias" ? activeClass : "text-muted-foreground hover:bg-muted"}`}
        >
          <BookOpen aria-hidden="true" className="size-4" />
          Matérias
          {activeItem === "materias" ? <span aria-hidden="true" className="ml-auto size-1.5 rounded-full bg-primary" /> : null}
        </Link>
        {unavailableItems.map(({ label, icon: Icon }) => (
          <Button
            key={label}
            type="button"
            variant="ghost"
            disabled
            title={`${label}: disponível em uma próxima etapa.`}
            className="h-11 justify-start gap-3 px-3 text-sm font-medium text-muted-foreground"
          >
            <Icon aria-hidden="true" className="size-4" />
            <span>{label}</span>
            <span className="ml-auto text-[10px] font-medium">Em breve</span>
          </Button>
        ))}
      </nav>

      <div className="mt-auto pt-6">
        <Separator className="mb-4" />
        <Button
          type="button"
          variant="ghost"
          disabled
          title="Configurações: disponível em uma próxima etapa."
          className="h-11 w-full justify-start gap-3 px-3 text-sm font-medium text-muted-foreground"
        >
          <Settings aria-hidden="true" className="size-4" />
          Configurações
          <span className="ml-auto text-[10px] font-medium">Em breve</span>
        </Button>
        <div className="mt-3 flex items-center gap-3 px-2">
          <Avatar className="size-9">
            <AvatarFallback className="bg-secondary text-xs font-bold text-secondary-foreground">{getInitials(email)}</AvatarFallback>
          </Avatar>
          <div className="min-w-0 flex-1">
            <p className="truncate text-xs font-semibold">{email}</p>
            <p className="mt-0.5 text-[11px] text-muted-foreground">Conta autenticada</p>
          </div>
        </div>
        <div className="mt-2"><SignOutButton /></div>
      </div>
    </aside>
  );
}
