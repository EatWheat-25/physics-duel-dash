-- 20251217000001_single_active_round_main_steps.sql
-- Fix existing duplicates where multiple match_rounds are simultaneously active
-- (status in ('main','steps')), then enforce "one active round per match" going forward.

begin;

do $$
begin
  if exists (
    select 1
    from information_schema.tables
    where table_schema = 'public'
      and table_name = 'match_rounds'
  ) then
    -- 1) Demote extra active rounds (keep matches.current_round_id if it's active, else keep newest active)
    with active as (
      select
        mr.id,
        mr.match_id,
        mr.created_at,
        mr.round_number,
        m.current_round_id,
        case when m.current_round_id = mr.id then 1 else 0 end as is_current
      from public.match_rounds mr
      join public.matches m on m.id = mr.match_id
      where mr.status in ('main','steps')
    ),
    keep as (
      select distinct on (match_id)
        match_id,
        id as keep_round_id
      from active
      order by match_id, is_current desc, created_at desc
    ),
    demote as (
      select a.id
      from active a
      join keep k on k.match_id = a.match_id
      where a.id <> k.keep_round_id
    )
    update public.match_rounds
    set
      status = 'done',
      step_ends_at = null,
      main_question_ends_at = null
    where id in (select id from demote);

    -- 2) Realign matches.current_round_id/current_round_number to the kept active round if needed
    with active as (
      select
        mr.id,
        mr.match_id,
        mr.created_at,
        mr.round_number,
        m.current_round_id,
        case when m.current_round_id = mr.id then 1 else 0 end as is_current
      from public.match_rounds mr
      join public.matches m on m.id = mr.match_id
      where mr.status in ('main','steps')
    ),
    keep as (
      select distinct on (match_id)
        match_id,
        id as keep_round_id
      from active
      order by match_id, is_current desc, created_at desc
    )
    update public.matches m
    set
      current_round_id = k.keep_round_id,
      current_round_number = coalesce(r.round_number, m.current_round_number)
    from keep k
    join public.match_rounds r on r.id = k.keep_round_id
    where m.id = k.match_id
      and (m.current_round_id is distinct from k.keep_round_id);

    -- 3) Replace obsolete partial unique index (status='active') with correct one (status in ('main','steps'))
    if exists (
      select 1
      from pg_indexes
      where schemaname = 'public'
        and indexname = 'idx_match_rounds_match_active'
    ) then
      execute 'drop index public.idx_match_rounds_match_active';
    end if;

    create unique index if not exists idx_match_rounds_match_active
      on public.match_rounds(match_id)
      where status in ('main','steps');
  end if;
end $$;

commit;




