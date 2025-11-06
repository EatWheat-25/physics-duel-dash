import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.57.4'
import { corsHeaders } from '../_shared/cors.ts'

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }

  try {
    // This function should be called by a cron job with service role
    const authHeader = req.headers.get('Authorization')
    const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')
    
    if (!authHeader || !authHeader.includes(serviceRoleKey || 'invalid')) {
      console.log('Unauthorized cleanup attempt')
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      serviceRoleKey ?? ''
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
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }
})
