-- Fix notification trigger to handle self-play matches (p1 = p2)

CREATE OR REPLACE FUNCTION public.fn_notify_match()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  -- Insert notification for player 1
  INSERT INTO public.match_notifications (user_id, match_id)
  VALUES (NEW.p1, NEW.id);

  -- Insert notification for player 2 ONLY if different from player 1
  IF NEW.p2 != NEW.p1 THEN
    INSERT INTO public.match_notifications (user_id, match_id)
    VALUES (NEW.p2, NEW.id);
  END IF;

  RETURN NEW;
END$$;
