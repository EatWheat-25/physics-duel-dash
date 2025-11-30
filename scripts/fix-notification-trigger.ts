/**
 * Fix the match notification trigger to handle both regular and self-play matches
 */

import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
import { resolve } from 'path';
import { fileURLToPath } from 'url';
import { dirname } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

dotenv.config({ path: resolve(__dirname, '../.env') });

const supabase = createClient(
    process.env.VITE_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
);

async function fixTrigger() {
    console.log('🔧 Updating match notification trigger...');

    const sql = `
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
    `;

    const { error } = await supabase.rpc('query', { query_text: sql }) as any;

    if (error) {
        console.error('❌ RPC failed, running direct SQL...');

        // Try direct approach
        const directResult = await fetch(
            `${process.env.VITE_SUPABASE_URL}/rest/v1/rpc/query`,
            {
                method: 'POST',
                headers: {
                    'apikey': process.env.SUPABASE_SERVICE_ROLE_KEY!,
                    'Authorization': `Bearer ${process.env.SUPABASE_SERVICE_ROLE_KEY!}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ query_text: sql })
            }
        );

        if (!directResult.ok) {
            console.error('❌ Failed to update trigger function');
            console.log('\n📝 Please run this SQL manually in Supabase SQL Editor:');
            console.log('\n' + sql);
            process.exit(1);
        }
    }

    console.log('✅ Trigger function updated successfully!');
    console.log('Now both regular 1v1 matches and self-play matches should work.');
}

fixTrigger().catch(console.error);
