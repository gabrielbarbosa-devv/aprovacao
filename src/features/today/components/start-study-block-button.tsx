"use client";

import { useActionState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { LoaderCircle, Play } from "lucide-react";
import { startStudyBlockAction, type ActionResult } from "@/features/today/actions";
import { Button } from "@/components/ui/button";

export function StartStudyBlockButton({ blockId }: { blockId: string }) {
  const [result, formAction, pending] = useActionState<ActionResult, FormData>(startStudyBlockAction, { status: "idle", message: "" });
  const router = useRouter();

  useEffect(() => {
    if (!result.message) return;
    if (result.status === "error") toast.error(result.message);
    if (result.status === "success") {
      toast.success(result.message);
      router.refresh();
    }
  }, [result, router]);

  return (
    <form action={formAction}>
      <input type="hidden" name="blockId" value={blockId} />
      <Button type="submit" variant="outline" disabled={pending} className="h-9 w-full gap-2 sm:w-auto">
        {pending ? <LoaderCircle aria-hidden="true" className="size-4 animate-spin" /> : <Play aria-hidden="true" className="size-3.5" />}
        Marcar início
      </Button>
    </form>
  );
}
