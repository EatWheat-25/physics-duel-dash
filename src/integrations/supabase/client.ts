// src/integrations/supabase/client.ts

import { createClient } from '@supabase/supabase-js';
import type { Database } from './types';

function readSupabaseUrl(): string {
  return String(
    import.meta.env.VITE_SUPABASE_URL ||
      import.meta.env.VITE_PUBLIC_SUPABASE_URL ||
      ''
  ).trim();
}

function readSupabaseAnonKey(): string {
  return String(
    import.meta.env.VITE_SUPABASE_ANON_KEY ||
      import.meta.env.VITE_PUBLIC_SUPABASE_ANON_KEY ||
      ''
  ).trim();
}

export const SUPABASE_URL = readSupabaseUrl();
export const SUPABASE_ANON_KEY = readSupabaseAnonKey();

if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
  throw new Error(
    '[Supabase] Missing VITE_SUPABASE_URL or VITE_SUPABASE_ANON_KEY. Copy .env.example to .env and set both from Dashboard → Project Settings → API. A baked-in default URL was removed because that host no longer resolves (NXDOMAIN).'
  );
}

export const supabase = createClient<Database>(SUPABASE_URL, SUPABASE_ANON_KEY, {
  auth: {
    storage: localStorage,
    persistSession: true,
    autoRefreshToken: true,
  }
});
