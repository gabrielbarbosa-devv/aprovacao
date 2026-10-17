"use client";

import { useActionState, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { CalendarDays, LoaderCircle } from "lucide-react";
import { createStarterPlanAction, type ActionResult } from "@/features/today/actions";
import { AlertDialog, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { formatStudyDate } from "@/lib/date/study-day";

const subjects = [
  "Português",
  "Matemática",
  "Raciocínio Lógico",
  "Direito Administrativo",
  "Direito Penal",
  "Direito Processual Penal",
];

export function CreateStarterPlanDialog({ today, defaultStartDate }: { today: string; defaultStartDate: string }) {
  const [open, setOpen] = useState(false);
  const [startDate, setStartDate] = useState(defaultStartDate);
  const [result, formAction, pending] = useActionState<ActionResult, FormData>(createStarterPlanAction, { status: "idle", message: "" });
  const router = useRouter();

  useEffect(() => {
    if (result.status === "error") toast.error(result.message);
    if (result.status === "success") {
      toast.success(result.message);
      router.refresh();
    }
  }, [result, router]);

  const readableDate = startDate
    ? formatStudyDate(startDate, "long")
    : "selecione uma data";

  return (
    <AlertDialog open={open && result.status !== "success"} onOpenChange={setOpen}>
      <Button onClick={() => setOpen(true)} className="mt-4 gap-2">
        <CalendarDays aria-hidden="true" className="size-4" />
        Criar meu plano inicial
      </Button>
      <AlertDialogContent className="max-w-lg">
        <form action={formAction}>
          <AlertDialogHeader>
            <AlertDialogTitle>Criar plano inicial?</AlertDialogTitle>
            <AlertDialogDescription>
              Esta ação vai cadastrar seis matérias, dois tópicos e dois blocos de 2 horas para {readableDate}. Nada será criado até você confirmar.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <div className="my-4 space-y-3">
            <Label htmlFor="starter-plan-date">Data do primeiro estudo</Label>
            <Input
              id="starter-plan-date"
              name="startDate"
              type="date"
              required
              min={today}
              value={startDate}
              onChange={(event) => setStartDate(event.currentTarget.value)}
            />
            <ul className="grid grid-cols-1 gap-1 text-sm text-muted-foreground sm:grid-cols-2" aria-label="Matérias incluídas">
              {subjects.map((subject) => <li key={subject}>• {subject}</li>)}
            </ul>
            <p className="rounded-lg bg-muted p-3 text-sm">
              <strong className="font-medium text-foreground">Blocos na data escolhida:</strong><br />
              Português · Interpretação de texto · 120 min<br />
              Direito Penal · Princípios e aplicação da lei penal · 120 min
            </p>
          </div>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={pending}>Cancelar</AlertDialogCancel>
            <Button type="submit" disabled={pending || !startDate || startDate < today}>
              {pending ? <LoaderCircle aria-hidden="true" className="size-4 animate-spin" /> : null}
              Confirmar criação
            </Button>
          </AlertDialogFooter>
        </form>
      </AlertDialogContent>
    </AlertDialog>
  );
}
