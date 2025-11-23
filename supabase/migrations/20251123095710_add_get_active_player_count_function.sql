/*
  # Add get_active_player_count function

  1. New Function
    - `get_active_player_count()` - Returns count of players with recent heartbeats

  2. Purpose
    - Used by frontend to display "Players online: X" counter
    - Counts queue entries with heartbeat within last 30 seconds
*/

CREATE OR REPLACE FUNCTION public.get_active_player_count()
RETURNS INTEGER AS $$
BEGIN
  RETURN (
    SELECT COUNT(DISTINCT player_id)
    FROM public.queue
    WHERE last_heartbeat > NOW() - INTERVAL '30 seconds'
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER STABLE;
