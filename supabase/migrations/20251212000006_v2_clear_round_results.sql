-- 20251212000006_v2_clear_round_results.sql
begin;

create or replace function public.clear_round_results(
  p_match_id uuid,
  p_expected_round_id uuid
) returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_match public.matches%rowtype;
begin
  select *
  into v_match
  from public.matches
  where id = p_match_id
  for update;

  if not found then
    raise exception 'match not found';
  end if;

  -- Safety: no-op if results_round_id is NULL (first round / abandoned match)
  if v_match.results_round_id is null then
    return jsonb_build_object('success', true, 'reason', 'nothing_to_clear');
  end if;

  -- Safety: only clear if we're clearing what we think we're clearing
  if v_match.results_round_id is distinct from p_expected_round_id then
    return jsonb_build_object(
      'success', false,
      'reason', 'results_round_id_mismatch',
      'results_round_id', v_match.results_round_id,
      'expected_round_id', p_expected_round_id
    );
  end if;

  update public.matches
  set results_computed_at = null,
      results_payload = null,
      results_round_id = null,
      results_version = coalesce(results_version, 0) + 1,

      -- clear per-round answer fields (simple question path)
      player1_answer = null,
      player2_answer = null,
      player1_answered_at = null,
      player2_answered_at = null,
      both_answered_at = null,
      correct_answer = null,
      player1_correct = null,
      player2_correct = null,
      round_winner = null
  where id = p_match_id;

  return jsonb_build_object('success', true);
end;
$$;

commit;
