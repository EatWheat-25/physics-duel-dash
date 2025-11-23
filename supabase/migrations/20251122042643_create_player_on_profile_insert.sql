/*
  # Create Player Record on Profile Insert

  1. New Trigger
    - Automatically creates a player record when a profile is created
    - Uses the user's display_name from profile
    - Sets default values for new players

  2. Purpose
    - Ensures every user has a player record for matchmaking
    - Eliminates manual player creation step
*/

CREATE OR REPLACE FUNCTION public.create_player_on_profile_insert()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.players (
    id,
    display_name,
    mmr,
    rank_tier,
    created_at,
    updated_at
  )
  VALUES (
    NEW.id,
    NEW.display_name,
    1000,
    'bronze',
    NOW(),
    NOW()
  )
  ON CONFLICT (id) DO NOTHING;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_profile_insert_create_player ON public.profiles;

CREATE TRIGGER on_profile_insert_create_player
  AFTER INSERT ON public.profiles
  FOR EACH ROW
  EXECUTE FUNCTION public.create_player_on_profile_insert();
