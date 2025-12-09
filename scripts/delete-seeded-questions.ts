/**
 * Delete the 5 seeded questions to allow re-seeding with correct structure
 */

import { createClient } from '@supabase/supabase-js';
import fs from 'fs';
import path from 'path';

// Load .env file
try {
  const envPath = path.resolve(process.cwd(), '.env');
  if (fs.existsSync(envPath)) {
    const envConfig = fs.readFileSync(envPath, 'utf8');
    const lines = envConfig.split(/\r?\n/);
    lines.forEach(line => {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith('#')) return;
      const eqIdx = trimmed.indexOf('=');
      if (eqIdx > 0) {
        const key = trimmed.substring(0, eqIdx).trim();
        let value = trimmed.substring(eqIdx + 1).trim();
        if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
          value = value.slice(1, -1);
        }
        process.env[key] = value;
      }
    });
  }
} catch (err) {
  console.warn('⚠️ Could not load .env file:', err);
}

const SUPABASE_URL = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
  console.error('❌ Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY');
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

async function main() {
  console.log('🗑️  Deleting seeded questions...\n');
  
  // Delete questions with these titles
  const titles = [
    'Basic Addition',
    'Quadratic Equation',
    'Newton\'s First Law',
    'Kinetic Energy',
    'Atomic Structure'
  ];
  
  for (const title of titles) {
    const { error } = await supabase
      .from('questions_v2')
      .delete()
      .eq('title', title);
    
    if (error) {
      console.error(`❌ Failed to delete "${title}":`, error.message);
    } else {
      console.log(`✅ Deleted "${title}"`);
    }
  }
  
  console.log('\n✅ Cleanup complete. You can now re-seed with: npm run seed:real-questions');
}

main().catch(console.error);

