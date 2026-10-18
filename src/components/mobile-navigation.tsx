"use client";

import { Menu } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { Sidebar } from "@/components/sidebar";

export function MobileNavigation({ email, activeItem }: { email: string; activeItem?: "hoje" | "planejamento" | "materias" | "revisoes" | "concursos" | "registros" | "caderno-de-erros" | "meu-progresso" }) {
  return (
    <Sheet>
      <SheetTrigger render={<Button variant="outline" size="icon" aria-label="Abrir navegação" className="lg:hidden" />}>
        <Menu aria-hidden="true" />
      </SheetTrigger>
      <SheetContent side="left" className="p-0">
        <SheetTitle className="sr-only">Navegação</SheetTitle>
        <Sidebar email={email} activeItem={activeItem} />
      </SheetContent>
    </Sheet>
  );
}
