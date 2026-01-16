import { createClient } from 'npm:@supabase/supabase-js@2.57.4'
import { corsHeaders } from '../_shared/cors.ts'

/**
 * Simple Matchmaker
 *
 * Takes a player_id and tries to pair them with another waiting player.
 * Returns either an instant match or queued status.
 */

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }

  try {
    // Verify authentication
    const authHeader = req.headers.get('Authorization')
    if (!authHeader) {
      return new Response(JSON.stringify({ error: 'Missing authorization' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      })
    }

    const supabaseUser = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
      { global: { headers: { Authorization: authHeader } } }
    )

    const { data: { user }, error: userError } = await supabaseUser.auth.getUser()
    if (userError || !user) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      })
    }

    // Read subject and level from request body
    const body = (await req.json().catch(() => ({}))) as {
      subject?: string
      level?: string
      forceNew?: boolean
    }

    let subject = body.subject ?? 'math'
    let level = body.level ?? 'A2'

    // Normalize subject: 'maths' → 'math'
    if (subject === 'maths') subject = 'math'

    // Normalize level: ensure uppercase 'A1' or 'A2'
    if (level.toLowerCase() === 'a1') level = 'A1'
    if (level.toLowerCase() === 'a2') level = 'A2'

    console.log(`[MM] Normalized subject/level:`, subject, level)
    console.log(`[MATCHMAKER] Player ${user.id} requesting match (subject: ${subject}, level: ${level})`)

    // Use service role for database operations
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    )

    const { data: result, error: rpcError } = await supabase.rpc('matchmake_simple_v1', {
      p_player_id: user.id,
      p_subject: subject,
      p_level: level,
      p_force_new: Boolean(body.forceNew)
    })

    if (rpcError) {
      console.error('[MM] ❌ matchmake_simple_v1 failed:', rpcError)
      return new Response(JSON.stringify({
        error: 'Matchmaking failed',
        details: rpcError.message,
        hint: rpcError.hint
      }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      })
    }

    return new Response(JSON.stringify(result ?? { matched: false, queued: true }), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    })

  } catch (error) {
    console.error('[MATCHMAKER] Fatal error:', error)
    return new Response(JSON.stringify({ error: (error as Error).message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    })
  }
})
