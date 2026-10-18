import { CircleDot } from "lucide-react";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { MobileNavigation } from "@/components/mobile-navigation";
import { ThemeToggle } from "@/components/theme-toggle";

function getInitials(email: string): string {
  const name = email.split("@")[0] ?? email;
  return name.split(/[._-]+/).filter(Boolean).slice(0, 2).map((part) => part[0]).join("").toLocaleUpperCase("pt-BR") || "OA";
}

export function Header({ email, activeItem }: { email: string; activeItem?: "hoje" | "planejamento" | "materias" | "revisoes" }) {
  return (
    <header className="flex h-16 shrink-0 items-center justify-between border-b bg-background px-4 sm:px-8 lg:h-[68px] lg:px-10">
      <div className="flex items-center gap-3">
        <MobileNavigation email={email} activeItem={activeItem} />
        <CircleDot aria-hidden="true" className="hidden size-4 text-muted-foreground sm:block" />
        <span className="text-sm font-medium text-muted-foreground">Preparação para concursos públicos</span>
      </div>
      <div className="flex items-center gap-2">
        <ThemeToggle />
        <Avatar className="size-9">
          <AvatarFallback className="bg-secondary text-xs font-bold text-secondary-foreground">{getInitials(email)}</AvatarFallback>
        </Avatar>
      </div>
    </header>
  );
}
