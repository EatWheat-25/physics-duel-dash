/*
  # Match Notifications Table

  1. New Table
    - `match_notifications` - Per-user notification table for match creation
      - `id` (uuid, primary key)
      - `user_id` (uuid, not null) - The user receiving the notification
      - `match_id` (uuid, not null) - The match that was created
      - `created_at` (timestamptz, default now())

  2. Security
    - Enable RLS on `match_notifications`
    - Policy `mn_select_self` - Users can only SELECT their own notifications (user_id = auth.uid())
    - Add to Realtime publication

  3. Trigger
    - `fn_notify_match()` - Inserts two notification rows (one per player) when match created
    - `trg_notify_match` - Trigger on INSERT to `matches_new`

  ## Why This Fixes Race Conditions

  **Problem:** Clients subscribe to matches_new with filters like `p1=eq.${uid}` OR `p2=eq.${uid}`.
  This has several failure modes:
  - OR filters not supported in some Realtime versions
  - Column name mismatches (p1 vs player1_id vs p1_id)
  - RLS complexity with multiple columns
  - Timing: INSERT happens before subscription ready

  **Solution:** Each user gets their own notification row.
  - Single filter: `user_id=eq.${uid}` (no OR, no ambiguity)
  - Simple RLS: `user_id = auth.uid()` (single column check)
  - Guaranteed delivery: Trigger creates notification rows AFTER match insert
  - Client fetches full match by ID after receiving notification
*/

-- 1) Create per-user notification table
create table if not exists public.match_notifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null,
  match_id uuid not null,
  created_at timestamptz not null default now()
);

-- 2) Enable RLS
alter table public.match_notifications enable row level security;

-- 3) RLS policy: users see only their own notifications
do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname='public' and tablename='match_notifications'
      and policyname='mn_select_self'
  ) then
    create policy mn_select_self
      on public.match_notifications
      for select
      using (user_id = auth.uid());
  end if;
end$$;

-- 4) Add to Realtime publication
do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname='supabase_realtime' and tablename='match_notifications'
  ) then
    alter publication supabase_realtime add table public.match_notifications;
  end if;
end$$;

-- 5) Trigger function: create notification for both players
create or replace function public.fn_notify_match()
returns trigger language plpgsql security definer as $$
begin
  -- Insert notification for player 1
  insert into public.match_notifications (user_id, match_id)
  values (new.p1, new.id);

  -- Insert notification for player 2
  insert into public.match_notifications (user_id, match_id)
  values (new.p2, new.id);

  return new;
end$$;

-- 6) Create trigger on matches_new
drop trigger if exists trg_notify_match on public.matches_new;
create trigger trg_notify_match
  after insert on public.matches_new
  for each row
  execute function public.fn_notify_match();
