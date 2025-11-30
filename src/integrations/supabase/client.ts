// src/integrations/supabase/client.ts

import { createClient } from '@supabase/supabase-js';
import type { Database } from './types';

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL || 'https://pwsgotzkeflizgfgqfbd.supabase.co';
const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InB3c2dvdHprZWZsaXpnZmdxZmJkIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjI0OTE0ODIsImV4cCI6MjA3ODA2NzQ4Mn0.wTd5kPhXD1oX9upZwbhn7uoZxNay1aVbWxnTIrgsPbE';

console.log('✅ Supabase client initialized:', SUPABASE_URL);

export const supabase = createClient<Database>(SUPABASE_URL, SUPABASE_ANON_KEY, {
  auth: {
    storage: localStorage,
    persistSession: true,
    autoRefreshToken: true,
  }
});
