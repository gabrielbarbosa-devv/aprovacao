import { z } from "zod";

export const loginCredentialsSchema = z.object({
  email: z.string().trim().toLowerCase().pipe(z.email("Informe um e-mail válido.")),
  password: z.string().min(1, "Informe sua senha."),
});

export const signupCredentialsSchema = loginCredentialsSchema.extend({
  password: z.string().min(8, "A senha deve ter pelo menos 8 caracteres."),
});
