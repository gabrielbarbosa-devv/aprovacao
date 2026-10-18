-- Mirrors the production migration already recorded for the subjects.is_focus
-- preference. IF NOT EXISTS keeps the schema safe when applied to a database
-- where this column was created before the repository migration was synced.
alter table public.subjects
  add column if not exists is_focus boolean not null default false;

comment on column public.subjects.is_focus is
  'Preferred high-frequency subjects in user study rotation. Independent of sort_order and actual official exam weight.';
