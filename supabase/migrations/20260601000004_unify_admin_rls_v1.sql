-- 20260601000004_unify_admin_rls_v1.sql
-- Security hardening, phase 3:
--   * questions_v2 write policies: authorize via public.has_role(auth.uid(), 'admin')
--     (the user_roles table) instead of the client-influenced JWT user_metadata.
--   * admin_code_attempts: rate-limit bookkeeping for the admin-auth edge
--     function (service_role access only).

begin;

-- ----------------------------------------------------------------------------
-- questions_v2 write policies → has_role()
-- ----------------------------------------------------------------------------
drop policy if exists "admins_can_insert_questions_v2" on public.questions_v2;
drop policy if exists "admins_can_update_questions_v2" on public.questions_v2;
drop policy if exists "admins_can_delete_questions_v2" on public.questions_v2;

create policy "admins_can_insert_questions_v2"
  on public.questions_v2
  for insert
  to authenticated
  with check (public.has_role(auth.uid(), 'admin'));

create policy "admins_can_update_questions_v2"
  on public.questions_v2
  for update
  to authenticated
  using (public.has_role(auth.uid(), 'admin'))
  with check (public.has_role(auth.uid(), 'admin'));

create policy "admins_can_delete_questions_v2"
  on public.questions_v2
  for delete
  to authenticated
  using (public.has_role(auth.uid(), 'admin'));

-- ----------------------------------------------------------------------------
-- Rate-limit bookkeeping for admin-auth (ADMIN_CODE brute-force protection).
-- No client policies: only service_role (which bypasses RLS) touches this.
-- ----------------------------------------------------------------------------
create table if not exists public.admin_code_attempts (
  user_id uuid primary key references auth.users(id) on delete cascade,
  attempt_count int not null default 0,
  window_started_at timestamptz not null default now(),
  last_attempt_at timestamptz not null default now()
);

alter table public.admin_code_attempts enable row level security;

commit;
