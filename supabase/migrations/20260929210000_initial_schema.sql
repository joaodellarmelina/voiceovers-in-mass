-- Voiceovers em massa: per-user projects, phrases, takes and approvals, plus audio in Storage.
-- Every table carries user_id and is protected by RLS: a user only ever sees their own rows.

-- ---------------------------------------------------------------------------------------------
-- updated_at helper (SECURITY INVOKER: runs with the caller's rights, never bypasses RLS)
-- ---------------------------------------------------------------------------------------------
create or replace function public.set_updated_at()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

-- ---------------------------------------------------------------------------------------------
-- projects: one imported sheet + its generation settings
-- ---------------------------------------------------------------------------------------------
create table public.projects (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  name text not null check (char_length(name) between 1 and 200),
  export_folder text not null,
  meta_columns jsonb not null default '[]'::jsonb,
  languages jsonb not null default '[]'::jsonb,
  settings jsonb not null,
  -- Google Drive mirror (folder + uploaded file ids); written by the server-side sync.
  drive jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index projects_user_id_idx on public.projects (user_id);
create trigger projects_set_updated_at before update on public.projects
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------------------------
-- project_rows: one phrase (ID) with its text per language
-- ---------------------------------------------------------------------------------------------
create table public.project_rows (
  project_id uuid not null references public.projects (id) on delete cascade,
  id text not null,
  position integer not null,
  meta jsonb not null default '{}'::jsonb,
  texts jsonb not null default '{}'::jsonb,
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  primary key (project_id, id)
);
create index project_rows_user_id_idx on public.project_rows (user_id);

-- ---------------------------------------------------------------------------------------------
-- takes: every generated audio (all of them are kept, including discarded ones)
-- ---------------------------------------------------------------------------------------------
create table public.takes (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects (id) on delete cascade,
  row_id text not null,
  lang_key text not null,
  -- Object path in the "takes" bucket: <user_id>/<project_id>/<take_id>.<ext>
  storage_path text not null,
  seed bigint not null,
  model_id text not null,
  voice_id text not null,
  request_id text,
  character_cost integer,
  rejected boolean not null default false,
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  created_at timestamptz not null default now(),
  foreign key (project_id, row_id) references public.project_rows (project_id, id) on delete cascade
);
create index takes_project_id_idx on public.takes (project_id);
create index takes_user_id_idx on public.takes (user_id);

-- ---------------------------------------------------------------------------------------------
-- approvals: the chosen take for each phrase + language (at most one)
-- ---------------------------------------------------------------------------------------------
create table public.approvals (
  project_id uuid not null references public.projects (id) on delete cascade,
  row_id text not null,
  lang_key text not null,
  take_id uuid not null references public.takes (id) on delete cascade,
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  primary key (project_id, row_id, lang_key)
);
create index approvals_take_id_idx on public.approvals (take_id);
create index approvals_user_id_idx on public.approvals (user_id);

-- ---------------------------------------------------------------------------------------------
-- drive_connections: Google refresh token per user. Server-only: RLS on and NO policies or grants
-- for anon/authenticated, so it is unreachable from the browser; only the secret key reads it.
-- ---------------------------------------------------------------------------------------------
create table public.drive_connections (
  user_id uuid primary key references auth.users (id) on delete cascade,
  refresh_token text not null,
  email text,
  updated_at timestamptz not null default now()
);
alter table public.drive_connections enable row level security;
revoke all on public.drive_connections from anon, authenticated;

-- ---------------------------------------------------------------------------------------------
-- Row Level Security: ownership on every row. Child tables also check the parent project is
-- the user's own, so nobody can attach rows to someone else's project.
-- ---------------------------------------------------------------------------------------------
alter table public.projects enable row level security;
alter table public.project_rows enable row level security;
alter table public.takes enable row level security;
alter table public.approvals enable row level security;

create policy "projects: owner can read" on public.projects
  for select to authenticated using ((select auth.uid()) = user_id);
create policy "projects: owner can create" on public.projects
  for insert to authenticated with check ((select auth.uid()) = user_id);
create policy "projects: owner can update" on public.projects
  for update to authenticated using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
create policy "projects: owner can delete" on public.projects
  for delete to authenticated using ((select auth.uid()) = user_id);

create policy "rows: owner can read" on public.project_rows
  for select to authenticated using ((select auth.uid()) = user_id);
create policy "rows: owner can create" on public.project_rows
  for insert to authenticated with check (
    (select auth.uid()) = user_id
    and exists (select 1 from public.projects p where p.id = project_id and p.user_id = (select auth.uid()))
  );
create policy "rows: owner can update" on public.project_rows
  for update to authenticated using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
create policy "rows: owner can delete" on public.project_rows
  for delete to authenticated using ((select auth.uid()) = user_id);

create policy "takes: owner can read" on public.takes
  for select to authenticated using ((select auth.uid()) = user_id);
create policy "takes: owner can create" on public.takes
  for insert to authenticated with check (
    (select auth.uid()) = user_id
    and exists (select 1 from public.projects p where p.id = project_id and p.user_id = (select auth.uid()))
  );
create policy "takes: owner can update" on public.takes
  for update to authenticated using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
create policy "takes: owner can delete" on public.takes
  for delete to authenticated using ((select auth.uid()) = user_id);

create policy "approvals: owner can read" on public.approvals
  for select to authenticated using ((select auth.uid()) = user_id);
create policy "approvals: owner can create" on public.approvals
  for insert to authenticated with check (
    (select auth.uid()) = user_id
    and exists (select 1 from public.takes t where t.id = take_id and t.user_id = (select auth.uid()) and t.project_id = project_id)
  );
create policy "approvals: owner can update" on public.approvals
  for update to authenticated using ((select auth.uid()) = user_id) with check (
    (select auth.uid()) = user_id
    and exists (select 1 from public.takes t where t.id = take_id and t.user_id = (select auth.uid()) and t.project_id = project_id)
  );
create policy "approvals: owner can delete" on public.approvals
  for delete to authenticated using ((select auth.uid()) = user_id);

-- New tables are no longer exposed to the Data API automatically: grant explicitly (RLS still applies).
grant select, insert, update, delete on public.projects, public.project_rows, public.takes, public.approvals to authenticated;

-- ---------------------------------------------------------------------------------------------
-- Storage: private bucket for every take. Path starts with the owner's user id.
-- ---------------------------------------------------------------------------------------------
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('takes', 'takes', false, 26214400, array['audio/mpeg', 'audio/wav', 'audio/ogg', 'audio/opus'])
on conflict (id) do nothing;

-- Upsert needs INSERT + SELECT + UPDATE, so all four are granted on the user's own folder.
create policy "takes bucket: owner can read" on storage.objects
  for select to authenticated using (bucket_id = 'takes' and (storage.foldername(name))[1] = (select auth.uid())::text);
create policy "takes bucket: owner can upload" on storage.objects
  for insert to authenticated with check (bucket_id = 'takes' and (storage.foldername(name))[1] = (select auth.uid())::text);
create policy "takes bucket: owner can update" on storage.objects
  for update to authenticated using (bucket_id = 'takes' and (storage.foldername(name))[1] = (select auth.uid())::text)
  with check (bucket_id = 'takes' and (storage.foldername(name))[1] = (select auth.uid())::text);
create policy "takes bucket: owner can delete" on storage.objects
  for delete to authenticated using (bucket_id = 'takes' and (storage.foldername(name))[1] = (select auth.uid())::text);
