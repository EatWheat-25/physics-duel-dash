import { createClient } from 'npm:@supabase/supabase-js@2.57.4'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Client-Info, Apikey',
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }

  try {
    const authHeader = req.headers.get('Authorization')
    if (!authHeader) {
      return new Response(JSON.stringify({ error: 'Missing authorization header' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const supabaseUser = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
      { global: { headers: { Authorization: authHeader } } }
    )

    const { data: { user }, error: userError } = await supabaseUser.auth.getUser()
    if (userError || !user) {
      console.error('Auth error:', userError)
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const requestBody = await req.json()
    const { subject, chapter, region } = requestBody

    // Validate input
    if (!subject || typeof subject !== 'string') {
      return new Response(JSON.stringify({ error: 'Invalid subject' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    if (!['math', 'physics', 'chemistry'].includes(subject)) {
      return new Response(JSON.stringify({ error: 'Subject must be math, physics, or chemistry' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    if (!chapter || typeof chapter !== 'string' || chapter.trim().length === 0) {
      return new Response(JSON.stringify({ error: 'Invalid chapter' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }
    if (!subject || !chapter) {
      return new Response(JSON.stringify({ error: 'Missing subject or chapter' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    console.log(`Player ${user.id} enqueueing for ${subject}/${chapter}`)

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    )

    const { data: profile } = await supabase
      .from('profiles')
      .select('username')
      .eq('id', user.id)
      .maybeSingle()

    const displayName = profile?.username || user.email?.split('@')[0] || 'Player'

    await supabase.from('players').upsert({
      id: user.id,
      display_name: displayName,
      region: region || null,
    })

    const { data: player } = await supabase
      .from('players')
      .select('mmr')
      .eq('id', user.id)
      .maybeSingle()

    const mmr = player?.mmr || 1000

    // Try to find an opponent waiting in queue
    const { data: waitingPlayers } = await supabase
      .from('queue')
      .select('*')
      .eq('subject', subject)
      .eq('chapter', chapter)
      .neq('player_id', user.id)
      .order('enqueued_at', { ascending: true })
      .limit(1)

    if (waitingPlayers && waitingPlayers.length > 0) {
      const opponent = waitingPlayers[0]

      // Get opponent's display name
      const { data: opponentPlayer } = await supabase
        .from('players')
        .select('display_name')
        .eq('id', opponent.player_id)
        .maybeSingle()

      // Create the match
      const { data: newMatch, error: matchError } = await supabase
        .from('matches')
        .insert({
          player1_id: user.id,
          player2_id: opponent.player_id,
          status: 'pending'
        })
        .select()
        .single()

      if (matchError) {
        console.error('Failed to create match:', matchError)
      } else {
        // Remove both players from queue
        await supabase
          .from('queue')
          .delete()
          .in('player_id', [user.id, opponent.player_id])

        console.log(`Instant match created: ${newMatch.id}`)

        return new Response(JSON.stringify({
          success: true,
          matched: true,
          match: newMatch,
          match_id: newMatch.id,
          opponent_name: opponentPlayer?.display_name || 'Opponent',
          match_quality: 100,
        }), {
          status: 200,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        })
      }
    }

    const { error: queueError } = await supabase.from('queue').upsert({
      player_id: user.id,
      subject,
      chapter,
      mmr,
      region: region || null,
      last_heartbeat: new Date().toISOString(),
    })

    if (queueError) {
      console.error('Queue error:', queueError)
      return new Response(JSON.stringify({ error: 'Failed to join queue', details: queueError.message }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    console.log(`Player ${user.id} added to queue, waiting for opponent`)

    return new Response(JSON.stringify({
      success: true,
      matched: false,
      mmr
    }), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  } catch (error) {
    console.error('Error in enqueue:', error)
    return new Response(JSON.stringify({ error: (error as Error).message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }
})
