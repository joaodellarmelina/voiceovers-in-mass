-- Cover the (project_id, row_id) foreign key; it also serves "all takes of a project" lookups.
drop index if exists public.takes_project_id_idx;
create index takes_project_id_row_id_idx on public.takes (project_id, row_id);

comment on table public.drive_connections is
  'Google Drive refresh token per user. Server-only on purpose: RLS enabled with no policies and no grants for anon/authenticated; read only with the secret key.';
