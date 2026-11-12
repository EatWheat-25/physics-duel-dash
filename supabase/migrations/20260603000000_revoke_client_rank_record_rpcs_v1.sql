-- 20260603000000_revoke_client_rank_record_rpcs_v1.sql
-- record_solo_challenge_v1 / record_campaign_challenge_v1 accept a
-- client-supplied score, so any logged-in user could call them directly with
-- 10/10 and farm rank points. Clients now go through grade_solo_attempt_v1,
-- which re-grades the answers server-side and calls these internally (it is
-- SECURITY DEFINER, so it keeps working after the revoke).

begin;

revoke all on function public.record_solo_challenge_v1(uuid, text, text, int, int) from public;
revoke all on function public.record_solo_challenge_v1(uuid, text, text, int, int) from anon;
revoke all on function public.record_solo_challenge_v1(uuid, text, text, int, int) from authenticated;
grant execute on function public.record_solo_challenge_v1(uuid, text, text, int, int) to service_role;

revoke all on function public.record_campaign_challenge_v1(uuid, text, text, text, text, text, int, int) from public;
revoke all on function public.record_campaign_challenge_v1(uuid, text, text, text, text, text, int, int) from anon;
revoke all on function public.record_campaign_challenge_v1(uuid, text, text, text, text, text, int, int) from authenticated;
grant execute on function public.record_campaign_challenge_v1(uuid, text, text, text, text, text, int, int) to service_role;

commit;
