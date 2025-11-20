// src/integrations/supabase/client.ts

import { createClient as createSupabaseClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  console.error(
    '[supabase/client] Missing VITE_SUPABASE_URL or VITE_SUPABASE_ANON_KEY in .env'
  );
  throw new Error('Supabase env vars are missing');
}

export const supabase = createSupabaseClient(supabaseUrl, supabaseAnonKey);

// (optional) type alias if other files use it
export type SupabaseClient = typeof supabase;
