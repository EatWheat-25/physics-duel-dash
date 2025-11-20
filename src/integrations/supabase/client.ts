// src/integrations/supabase/client.ts

import { createClient } from '@supabase/supabase-js';
import type { Database } from './types';

const SUPABASE_URL = 'https://qvunaswogfwhixecjpcn.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InF2dW5hc3dvZ2Z3aGl4ZWNqcGNuIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTc5NDIyNDAsImV4cCI6MjA3MzUxODI0MH0.mNFMhdalJrFdpQNbORIC4FZVRNSHrrTEqx63zVILqlg';

console.log('✅ Supabase client initialized');

export const supabase = createClient<Database>(SUPABASE_URL, SUPABASE_ANON_KEY, {
  auth: {
    storage: localStorage,
    persistSession: true,
    autoRefreshToken: true,
  }
});
