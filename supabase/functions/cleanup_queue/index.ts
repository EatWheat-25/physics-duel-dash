import { createClient } from 'npm:@supabase/supabase-js@2.57.4'
import { corsHeaders } from '../_shared/cors.ts'
import { getSecretKey, isElevatedAuthHeader } from '../_shared/keys.ts'

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }

  try {
    // Allow calls from cron jobs (shared secret header) or with an elevated key
    const authHeader = req.headers.get('Authorization')

    // Cron calls must present the shared secret header (User-Agent is spoofable).
    const cronSecret = Deno.env.get('CRON_SECRET')
    const isCronJob = !!cronSecret && req.headers.get('x-cron-secret') === cronSecret
    const hasServiceRole = isElevatedAuthHeader(authHeader)

    if (!isCronJob && !hasServiceRole) {
      console.log('Unauthorized cleanup attempt')
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      getSecretKey()
    )

    console.log('Running queue cleanup...')

    // Delete entries where last_heartbeat is older than 45 seconds
    const cutoffTime = new Date(Date.now() - 45000).toISOString()

    const { data: deletedEntries, error: deleteError } = await supabase
      .from('queue')
      .delete()
      .lt('last_heartbeat', cutoffTime)
      .select('player_id')

    if (deleteError) {
      console.error('Cleanup error:', deleteError)
      return new Response(JSON.stringify({ error: 'Cleanup failed' }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const removedCount = deletedEntries?.length || 0
    console.log(`Queue cleanup complete. Removed ${removedCount} stale entries`)

    return new Response(JSON.stringify({ removed: removedCount }), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  } catch (error) {
    console.error('Error in cleanup_queue:', error)
    return new Response(JSON.stringify({ error: (error as Error).message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }
})
