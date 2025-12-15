-- 20251212000005_v2_enable_realtime_and_rls.sql
begin;

-- ===== Verify matches is in Realtime publication =====
-- (Should already be enabled per migration 20251020221836, but verify)
do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and tablename = 'matches'
  ) then
    alter publication supabase_realtime add table public.matches;
    raise notice 'Added matches to supabase_realtime publication';
  else
    raise notice 'matches already in supabase_realtime publication';
  end if;
end $$;

-- ===== Add match_rounds to Realtime publication =====
-- (Needed for Phase 2 multi-step questions, but safe to add now)
do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and tablename = 'match_rounds'
  ) then
    alter publication supabase_realtime add table public.match_rounds;
    raise notice 'Added match_rounds to supabase_realtime publication';
  else
    raise notice 'match_rounds already in supabase_realtime publication';
  end if;
end $$;

-- ===== Verify/Enforce airtight RLS for matches =====
-- Policy: Player can SELECT only where player1_id = auth.uid() OR player2_id = auth.uid()
do $$
begin
  -- Drop existing policies that might be too permissive
  drop policy if exists "Players can view their own matches" on public.matches;
  drop policy if exists "Players can update their own matches" on public.matches;
  
  -- Create strict SELECT policy
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'matches' and policyname = 'matches_select_own'
  ) then
    create policy "matches_select_own" on public.matches
      for select
      to authenticated
      using (player1_id = auth.uid() or player2_id = auth.uid());
    raise notice 'Created matches_select_own RLS policy';
  else
    raise notice 'matches_select_own RLS policy already exists';
  end if;
end $$;

-- ===== Verify/Enforce airtight RLS for match_rounds =====
-- Policy: Player can SELECT only where match_id in (player's matches)
do $$
begin
  -- Drop existing policy if it exists (will recreate with same logic)
  drop policy if exists "Players can view their match rounds" on public.match_rounds;
  
  -- Create strict SELECT policy
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'match_rounds' and policyname = 'match_rounds_select_own'
  ) then
    create policy "match_rounds_select_own" on public.match_rounds
      for select
      to authenticated
      using (
        exists (
          select 1 from public.matches m
          where m.id = match_rounds.match_id
          and (m.player1_id = auth.uid() or m.player2_id = auth.uid())
        )
      );
    raise notice 'Created match_rounds_select_own RLS policy';
  else
    raise notice 'match_rounds_select_own RLS policy already exists';
  end if;
end $$;

commit;










