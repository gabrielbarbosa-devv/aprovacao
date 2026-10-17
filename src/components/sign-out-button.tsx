import { LogOut } from "lucide-react";
import { logoutAction } from "@/features/auth/actions";
import { Button } from "@/components/ui/button";

export function SignOutButton() {
  return (
    <form action={logoutAction}>
      <Button variant="ghost" size="sm" className="w-full justify-start gap-2 text-muted-foreground">
        <LogOut aria-hidden="true" className="size-4" />
        Sair
      </Button>
    </form>
  );
}
