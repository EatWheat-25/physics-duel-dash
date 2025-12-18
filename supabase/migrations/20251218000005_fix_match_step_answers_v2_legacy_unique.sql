-- 20251218000005_fix_match_step_answers_v2_legacy_unique.sql
-- Fix: remove legacy unique constraint/index that ignores `segment` on match_step_answers_v2.
-- Symptom: submitting a sub-step after main step fails with:
--   duplicate key value violates unique constraint "match_step_answers_v2_match_id_round_index_player_id_questi_key"
--
-- Root cause: an older UNIQUE (match_id, round_index, player_id, question_id, step_index)
-- still exists alongside the new segmented uniqueness.

begin;

do $$
declare
  v_table regclass := 'public.match_step_answers_v2'::regclass;
  r record;
  cols5 text[] := array['match_id','player_id','question_id','round_index','step_index'];
  cols6 text[] := array['match_id','player_id','question_id','round_index','segment','step_index'];
  has_cols6_unique boolean := false;
begin
  if not exists (
    select 1
    from information_schema.tables
    where table_schema = 'public'
      and table_name = 'match_step_answers_v2'
  ) then
    return;
  end if;

  -- 1) Drop legacy UNIQUE constraints that ignore `segment` (name may vary)
  for r in
    select c.conname
    from pg_constraint c
    where c.conrelid = v_table
      and c.contype = 'u'
      and (
        select array_agg(a.attname::text order by a.attname::text)
        from unnest(c.conkey) as k(attnum)
        join pg_attribute a
          on a.attrelid = v_table
         and a.attnum = k.attnum
      ) = cols5
  loop
    execute format('alter table public.match_step_answers_v2 drop constraint %I', r.conname);
  end loop;

  -- 2) Drop legacy UNIQUE indexes that ignore `segment` (if any exist without a constraint)
  for r in
    select idx.relname as indexname
    from pg_index ix
    join pg_class idx on idx.oid = ix.indexrelid
    where ix.indrelid = v_table
      and ix.indisunique
      and (
        select array_agg(a.attname::text order by a.attname::text)
        from unnest(ix.indkey) as k(attnum)
        join pg_attribute a
          on a.attrelid = v_table
         and a.attnum = k.attnum
      ) = cols5
  loop
    execute format('drop index if exists public.%I', r.indexname);
  end loop;

  -- 3) Ensure the segmented UNIQUE exists (any name is fine; required for ON CONFLICT target)
  select exists (
    select 1
    from pg_index ix
    where ix.indrelid = v_table
      and ix.indisunique
      and (
        select array_agg(a.attname::text order by a.attname::text)
        from unnest(ix.indkey) as k(attnum)
        join pg_attribute a
          on a.attrelid = v_table
         and a.attnum = k.attnum
      ) = cols6
  )
  into has_cols6_unique;

  if not has_cols6_unique then
    -- Replace our canonical constraint name if it exists but is wrong
    if exists (
      select 1
      from pg_constraint
      where conname = 'match_step_answers_v2_unique_answer'
        and conrelid = v_table
    ) then
      alter table public.match_step_answers_v2
        drop constraint match_step_answers_v2_unique_answer;
    end if;

    alter table public.match_step_answers_v2
      add constraint match_step_answers_v2_unique_answer
      unique (match_id, round_index, player_id, question_id, step_index, segment);
  end if;
end $$;

commit;


