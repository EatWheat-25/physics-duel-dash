import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';

export function useActivePlayerCount() {
  const [count, setCount] = useState<number | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function fetchCount() {
      const { data, error } = await supabase.rpc('get_active_player_count');
      if (!cancelled && !error) setCount(data ?? 0);
    }

    fetchCount();
    const id = setInterval(fetchCount, 5000); // every 5s

    return () => {
      cancelled = true;
      clearInterval(id);
    };
  }, []);

  return count;
}
