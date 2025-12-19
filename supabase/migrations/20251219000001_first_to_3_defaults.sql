-- 20251219000001_first_to_3_defaults.sql
-- Make "first to 3 round wins" the default ruleset.

begin;

-- Default to 3 for new matches
alter table public.matches
  alter column target_rounds_to_win set default 3;

-- Backfill existing pending/in_progress matches (safe; finished matches keep historic value)
update public.matches
set target_rounds_to_win = 3
where status in ('pending', 'in_progress')
  and target_rounds_to_win is distinct from 3;

comment on column public.matches.target_rounds_to_win is 'Number of rounds needed to win the match (default: 3)';

-- Polling fallback: keep defaults consistent
create or replace function public.get_match_round_state_v2(
  p_match_id UUID
) returns JSONB as $$
declare
  v_match RECORD;
  v_both_answered BOOLEAN;
begin
  -- Get match and verify it exists and is in progress
  select * into v_match
  from public.matches
  where id = p_match_id
    and (player1_id = auth.uid() or player2_id = auth.uid())
    and status = 'in_progress';

  if not found then
    return jsonb_build_object(
      'both_answered', false,
      'error', 'Match not found or not accessible'
    );
  end if;

  -- Check if both answered and results are computed
  v_both_answered := (v_match.player1_answer is not null
                      and v_match.player2_answer is not null
                      and v_match.results_computed_at is not null);

  if not v_both_answered then
    return jsonb_build_object('both_answered', false);
  end if;

  -- Both answered and results computed - return full result payload
  return jsonb_build_object(
    'both_answered', true,
    'result', jsonb_build_object(
      'player1_answer', v_match.player1_answer,
      'player2_answer', v_match.player2_answer,
      'correct_answer', v_match.correct_answer,
      'player1_correct', v_match.player1_correct,
      'player2_correct', v_match.player2_correct,
      'round_winner', v_match.round_winner,
      'round_number', coalesce(v_match.round_number, 0),
      'target_rounds_to_win', coalesce(v_match.target_rounds_to_win, 3),
      'player1_round_wins', coalesce(v_match.player1_round_wins, 0),
      'player2_round_wins', coalesce(v_match.player2_round_wins, 0),
      'player_round_wins', jsonb_build_object(
        v_match.player1_id::text, coalesce(v_match.player1_round_wins, 0),
        v_match.player2_id::text, coalesce(v_match.player2_round_wins, 0)
      ),
      'match_over', (v_match.winner_id is not null or v_match.status = 'finished'),
      'match_winner_id', v_match.winner_id,
      'next_round_ready', (v_match.winner_id is null and v_match.status = 'in_progress'
                           and v_match.player1_answer is null and v_match.player2_answer is null)
    )
  );
end;
$$ language plpgsql security definer
set search_path = public;

alter function public.get_match_round_state_v2(UUID) set search_path = public;
grant execute on function public.get_match_round_state_v2(UUID) to authenticated;

commit;


