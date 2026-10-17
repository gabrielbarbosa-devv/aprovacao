# Operação Aprovação

Plataforma web para planejar, organizar e acompanhar estudos para concursos públicos. O escopo do produto é planejamento, registros de estudo e revisões; não inclui aulas nem banco de questões.

## Stack

- Next.js App Router e TypeScript
- Tailwind CSS
- shadcn/ui com componentes Base UI
- Lucide React para ícones
- Supabase Auth e Postgres
- `@supabase/ssr` para sessões em cookies no servidor e no navegador

## Desenvolvimento

```bash
pnpm dev
```

Abra [http://localhost:3000](http://localhost:3000).

## Supabase

O arquivo `.env.local` já aponta para o projeto Supabase **Operação Aprovação**. Ele contém somente o Project URL e a chave publishable, que pode ser usada pelo cliente do navegador. O arquivo é ignorado pelo Git.

Para outra máquina ou outro projeto, copie `.env.local.example` para `.env.local` e preencha `NEXT_PUBLIC_SUPABASE_URL` e `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`. Nunca coloque a secret/service-role key em variáveis `NEXT_PUBLIC_*` nem no cliente do navegador.

## Organização

- `src/app`: rotas, layout e estilos globais do App Router
- `src/components`: shell, navegação e componentes compartilhados
- `src/components/ui`: componentes shadcn/ui
- `src/features/auth`: login, criação de conta e validação de credenciais
- `src/features/today`: tela Hoje, consulta protegida, ações do plano inicial e regras de domínio
- `src/lib/auth`: autorização de usuário no servidor
- `src/lib/date`: calendário local baseado no fuso horário da conta
- `src/lib/supabase`: criação dos clientes de Supabase no servidor e no navegador
- `proxy.ts`: atualização de cookies de sessão Supabase nas requisições
- `public`: assets estáticos

As telas Hoje e Planejamento exigem autenticação Supabase e consultam registros da conta autenticada. Quando não há registros, a pessoa pode escolher uma data e confirmar explicitamente a criação do plano inicial. O Planejamento mostra a semana, permite adicionar, editar, mover, ignorar e restaurar blocos, e apresenta uma prévia antes de reorganizar pendências. As alterações são persistidas no Postgres. As demais áreas ainda não implementadas permanecem desabilitadas.

### Banco de dados

As migrations em `supabase/migrations` criam a fundação de Hoje e estendem `study_blocks` com os campos de planejamento. Também definem as funções transacionais, validações e políticas RLS. Não inserem linhas de demonstração e já foram aplicadas no projeto Supabase ligado a este repositório. Para configurar outro ambiente:

```bash
pnpm dlx supabase@latest link --project-ref mnupjnlbsjsclxwlduon
pnpm dlx supabase@latest db push
```

O comando exige que o Supabase CLI esteja vinculado ao projeto e que exista uma sessão/permissão de banco válida. Também é possível executar o conteúdo da migration pelo SQL Editor do projeto. Não use a chave service-role no app.

Validação local:

```bash
pnpm lint
pnpm exec tsc --noEmit
pnpm test
pnpm build
```
