"use client";

import { useActionState, useEffect } from "react";
import { toast } from "sonner";
import { LoaderCircle, Pause, Play } from "lucide-react";
import { pauseStudyBlockAction, startStudyBlockAction, type ActionResult } from "@/features/today/actions";
import { Button } from "@/components/ui/button";

type StudyBlockActionButtonProps = {
  blockId: string;
  action: "start" | "pause";
};

const initialState: ActionResult = { status: "idle", message: "" };

export function StudyBlockActionButton({ blockId, action }: StudyBlockActionButtonProps) {
  const serverAction = action === "pause" ? pauseStudyBlockAction : startStudyBlockAction;
  const [result, formAction, pending] = useActionState<ActionResult, FormData>(serverAction, initialState);
  const label = action === "pause" ? "Pausar estudo" : "Iniciar ou retomar";

  useEffect(() => {
    if (!result.message) return;
    if (result.status === "error") toast.error(result.message);
    if (result.status === "success") toast.success(result.message);
  }, [result]);

  return (
    <form action={formAction}>
      <input type="hidden" name="blockId" value={blockId} />
      <Button type="submit" variant="outline" disabled={pending} className="h-9 w-full gap-2 sm:w-auto">
        {pending ? <LoaderCircle aria-hidden="true" className="size-4 animate-spin" /> : action === "pause" ? <Pause aria-hidden="true" className="size-3.5" /> : <Play aria-hidden="true" className="size-3.5" />}
        {label}
      </Button>
    </form>
  );
}
