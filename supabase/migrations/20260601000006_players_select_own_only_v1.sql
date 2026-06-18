-- Players: own-row reads only.
--
-- "Service role can read all players" (added in 20251107061022) had
-- USING (true) with no role restriction, so ANY signed-in user could dump
-- every player's name/MMR/rank points from the browser console.
--
-- Dropping it loses nothing:
--   * service_role / sb_secret keys bypass RLS entirely, so edge functions
--     keep full read access.
--   * Clients keep "Users can read their own player profile"
--     (USING auth.uid() = id) for their own row.
--   * Opponent rank display uses the SECURITY DEFINER RPC
--     get_players_rank_public_v1, which is unaffected by this policy.

drop policy if exists "Service role can read all players" on public.players;
