"use client";

import { Laptop, Moon, Sun } from "lucide-react";
import { useTheme } from "next-themes";
import { Button } from "@/components/ui/button";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";

export function ThemeToggle() {
  return <DropdownMenu>
    <DropdownMenuTrigger render={<Button variant="ghost" size="icon" aria-label="Alterar tema" title="Alterar tema" />}>
      <Sun aria-hidden="true" className="size-4 dark:hidden" />
      <Moon aria-hidden="true" className="hidden size-4 dark:block" />
    </DropdownMenuTrigger>
    <DropdownMenuContent align="end">
      <ThemeItem theme="light" icon={Sun} label="Claro" />
      <ThemeItem theme="dark" icon={Moon} label="Escuro" />
      <ThemeItem theme="system" icon={Laptop} label="Sistema" />
    </DropdownMenuContent>
  </DropdownMenu>;
}

function ThemeItem({ theme, icon: Icon, label }: { theme: "light" | "dark" | "system"; icon: typeof Sun; label: string }) {
  const { setTheme } = useTheme();
  return <DropdownMenuItem onClick={() => setTheme(theme)}><Icon aria-hidden="true" />{label}</DropdownMenuItem>;
}
