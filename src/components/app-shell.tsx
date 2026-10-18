import type { ReactNode } from "react";
import { Header } from "@/components/header";
import { Sidebar } from "@/components/sidebar";
import { Sidebar as ShadcnSidebar, SidebarInset, SidebarProvider } from "@/components/ui/sidebar";
import { TooltipProvider } from "@/components/ui/tooltip";

export function AppShell({ children, email, activeItem }: { children: ReactNode; email: string; activeItem?: import("@/components/sidebar").SidebarItem }) {
  return (
    <TooltipProvider>
      <SidebarProvider>
        <ShadcnSidebar collapsible="icon" className="border-sidebar-border">
          <Sidebar email={email} activeItem={activeItem} />
        </ShadcnSidebar>
        <SidebarInset className="min-h-svh min-w-0 bg-muted/30">
          <Header email={email} />
          {children}
        </SidebarInset>
      </SidebarProvider>
    </TooltipProvider>
  );
}
