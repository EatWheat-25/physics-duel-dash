-- Run against a disposable Supabase database (never production):
-- psql "$TEST_DATABASE_URL" -v ON_ERROR_STOP=1 -f supabase/tests/guest-profile-rls.sql
-- All fixtures and changes are rolled back. Any failed assertion aborts the test.
begin;

insert into auth.users (id, is_anonymous) values
  ('a1000000-0000-4000-8000-000000000001', true),
  ('a1000000-0000-4000-8000-000000000002', true),
  ('a1000000-0000-4000-8000-000000000003', false);
insert into public.profiles (id, username) values
  ('a1000000-0000-4000-8000-000000000002', 'rls_other_guest'),
  ('a1000000-0000-4000-8000-000000000003', 'rls_permanent');

set local role authenticated;
set local request.jwt.claims = '{"sub":"a1000000-0000-4000-8000-000000000001","role":"authenticated","is_anonymous":true}';

-- Exercise onboarding's upsert, including its UPDATE path.
insert into public.profiles (id, username, age, subjects, onboarding_completed)
values (auth.uid(), 'rls_current_guest', 18, '[{"subject":"math","level":"A1"}]', true)
on conflict (id) do update set onboarding_completed = excluded.onboarding_completed;
insert into public.profiles (id, username, age, subjects, onboarding_completed)
values (auth.uid(), 'rls_current_guest', 19, '[{"subject":"math","level":"A1"}]', true)
on conflict (id) do update set age = excluded.age;

do $$
begin
  if (select count(*) from public.profiles) <> 1 then
    raise exception 'Guest can read another profile or cannot read own profile';
  end if;
  if not exists (select 1 from public.profiles where id = auth.uid() and age = 19 and onboarding_completed) then
    raise exception 'Guest onboarding upsert failed';
  end if;
  update public.profiles set age = 99 where id = 'a1000000-0000-4000-8000-000000000002';
  if found then raise exception 'Guest can update another profile'; end if;
  begin
    insert into public.profiles (id, username)
    values ('a1000000-0000-4000-8000-000000000002', 'rls_spoofed');
    raise exception 'Guest can insert another profile';
  exception when insufficient_privilege then null;
  end;
end $$;

-- Permanent users retain the same ownership boundary.
set local request.jwt.claims = '{"sub":"a1000000-0000-4000-8000-000000000003","role":"authenticated","is_anonymous":false}';
do $$
begin
  if (select count(*) from public.profiles) <> 1 then
    raise exception 'Permanent user profile isolation failed';
  end if;
  update public.profiles set age = 20 where id = auth.uid();
  if not found then raise exception 'Permanent user cannot update own profile'; end if;
end $$;

-- An unauthenticated client must not gain guest privileges.
set local role anon;
set local request.jwt.claims = '{"role":"anon"}';
do $$
begin
  if exists (select 1 from public.profiles) then
    raise exception 'Unauthenticated client can read profiles';
  end if;
  begin
    insert into public.profiles (id, username)
    values ('a1000000-0000-4000-8000-000000000001', 'rls_unauthenticated');
    raise exception 'Unauthenticated client can insert profiles';
  exception when insufficient_privilege then null;
  end;
end $$;

rollback;
