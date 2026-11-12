-- 20260603000002_question_diagrams_admin_rls_v1.sql
-- question_diagrams policies checked JWT user_metadata.role, which users can
-- set on themselves (and which real admins, granted via user_roles, don't
-- have). Authorize via public.has_role() like questions_v2 does since
-- 20260601000004. Reads are admin-only too: the table is only used by the
-- admin diagram library; questions reference diagrams by public storage URL.

begin;

drop policy if exists "anyone_can_read_question_diagrams" on public.question_diagrams;
drop policy if exists "admins_can_read_question_diagrams" on public.question_diagrams;
drop policy if exists "admins_can_insert_question_diagrams" on public.question_diagrams;
drop policy if exists "admins_can_update_question_diagrams" on public.question_diagrams;
drop policy if exists "admins_can_delete_question_diagrams" on public.question_diagrams;

create policy "admins_can_read_question_diagrams"
  on public.question_diagrams
  for select
  to authenticated
  using (public.has_role(auth.uid(), 'admin'));

create policy "admins_can_insert_question_diagrams"
  on public.question_diagrams
  for insert
  to authenticated
  with check (public.has_role(auth.uid(), 'admin'));

create policy "admins_can_update_question_diagrams"
  on public.question_diagrams
  for update
  to authenticated
  using (public.has_role(auth.uid(), 'admin'))
  with check (public.has_role(auth.uid(), 'admin'));

create policy "admins_can_delete_question_diagrams"
  on public.question_diagrams
  for delete
  to authenticated
  using (public.has_role(auth.uid(), 'admin'));

commit;
