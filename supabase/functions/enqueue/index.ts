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

    const { subject, chapter, region } = await req.json()
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

    const { data: matchResult, error: matchError } = await supabase
      .rpc('try_match_player', {
        p_player_id: user.id,
        p_subject: subject,
        p_chapter: chapter,
        p_mmr: mmr,
      })
      .single()

    if (matchError) {
      console.error('Match error:', matchError)
    }

    if (matchResult && matchResult.matched) {
      console.log(`Player ${user.id} matched immediately with ${matchResult.opponent_id}`)
      return new Response(JSON.stringify({
        success: true,
        matched: true,
        match_id: matchResult.match_id,
        opponent_name: matchResult.opponent_name,
      }), {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
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
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }
})
