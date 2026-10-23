import Link from "next/link";
import {
  ArrowLeft,
  BookOpen,
  CalendarDays,
  ChartNoAxesCombined,
  CircleDot,
  ClipboardList,
  Home,
  NotebookPen,
  RefreshCw,
  Settings,
  Trophy,
} from "lucide-react";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import {
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarSeparator,
} from "@/components/ui/sidebar";
import { SignOutButton } from "@/components/sign-out-button";

export type SidebarItem =
  | "hoje"
  | "planejamento"
  | "materias"
  | "revisoes"
  | "concursos"
  | "registros"
  | "caderno-de-erros"
  | "meu-progresso"
  | "configuracoes";

type SidebarProps = {
  email: string;
  activeItem?: SidebarItem;
};

const navigationItems = [
  { id: "hoje", label: "Hoje", href: "/hoje", icon: Home },
  { id: "planejamento", label: "Planejamento", href: "/planejamento", icon: CalendarDays },
  { id: "materias", label: "Matérias", href: "/materias", icon: BookOpen },
  { id: "revisoes", label: "Revisões", href: "/revisoes", icon: RefreshCw },
  { id: "concursos", label: "Concursos", href: "/concursos", icon: Trophy },
  { id: "registros", label: "Registros", href: "/registros", icon: ClipboardList },
  { id: "caderno-de-erros", label: "Caderno de erros", href: "/caderno-de-erros", icon: NotebookPen },
  { id: "meu-progresso", label: "Meu progresso", href: "/meu-progresso", icon: ChartNoAxesCombined },
] as const;

function getInitials(email: string): string {
  const name = email.split("@")[0] ?? email;
  const initials = name.split(/[._-]+/).filter(Boolean).slice(0, 2).map((part) => part[0]);
  return initials.join("").toLocaleUpperCase("pt-BR") || "OA";
}

export function Sidebar({ email, activeItem = "hoje" }: SidebarProps) {
  return (
    <>
      <SidebarHeader className="px-4 pb-5 pt-5">
        <Link href="/hoje" className="flex min-w-0 items-center gap-3" aria-label="Operação Aprovação, Hoje">
          <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-primary text-primary-foreground">
            <CircleDot aria-hidden="true" className="size-5" />
          </span>
          <span className="min-w-0 leading-tight">
            <span className="block truncate text-sm font-bold tracking-tight">Operação Aprovação</span>
            <span className="mt-1 block truncate text-xs text-muted-foreground">Seu espaço de estudos</span>
          </span>
        </Link>
      </SidebarHeader>

      <SidebarContent>
        <SidebarGroup className="px-3 py-1">
          <SidebarGroupLabel className="px-2 text-[10px] font-semibold uppercase tracking-[0.16em]">
            Organização
          </SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu className="gap-1">
              {navigationItems.map(({ id, label, href, icon: Icon }) => {
                const isActive = activeItem === id;
                return (
                  <SidebarMenuItem key={id}>
                    <SidebarMenuButton
                      render={<Link href={href} aria-current={isActive ? "page" : undefined} />}
                      isActive={isActive}
                      tooltip={label}
                      className="h-11 px-3 font-semibold"
                    >
                      <Icon aria-hidden="true" />
                      <span>{label}</span>
                      {isActive ? <span aria-hidden="true" className="ml-auto size-1.5 rounded-full bg-primary" /> : null}
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                );
              })}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>

      <SidebarFooter className="gap-2 px-3 pb-4">
        <SidebarSeparator className="mb-1" />
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton
              render={<Link href="/" aria-label="Voltar à escolha de módulos" />}
              tooltip="Voltar à escolha de módulos"
              className="h-11 px-3 font-semibold"
            >
              <ArrowLeft aria-hidden="true" />
              <span>Voltar aos módulos</span>
            </SidebarMenuButton>
          </SidebarMenuItem>
          <SidebarMenuItem>
            <SidebarMenuButton
              render={<Link href="/configuracoes" aria-current={activeItem === "configuracoes" ? "page" : undefined} />}
              isActive={activeItem === "configuracoes"}
              tooltip="Configurações"
              className="h-11 px-3 font-semibold"
            >
              <Settings aria-hidden="true" />
              <span>Configurações</span>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
        <div className="flex min-w-0 items-center gap-3 px-2 py-1 group-data-[collapsible=icon]:justify-center group-data-[collapsible=icon]:px-0">
          <Avatar className="size-9 shrink-0">
            <AvatarFallback className="bg-secondary text-xs font-bold text-secondary-foreground">
              {getInitials(email)}
            </AvatarFallback>
          </Avatar>
          <div className="min-w-0 flex-1 group-data-[collapsible=icon]:hidden">
            <p className="truncate text-xs font-semibold">{email}</p>
            <p className="mt-0.5 text-[11px] text-muted-foreground">Conta autenticada</p>
          </div>
        </div>
        <div className="group-data-[collapsible=icon]:hidden">
          <SignOutButton />
        </div>
      </SidebarFooter>
    </>
  );
}
