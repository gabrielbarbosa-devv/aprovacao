import { z } from "zod";

export const starterPlanSchema = z.object({
  startDate: z.iso.date("Escolha uma data válida."),
});

export const startBlockSchema = z.object({
  blockId: z.uuid("Bloco inválido."),
});
