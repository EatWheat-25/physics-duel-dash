import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.57.4'
import { corsHeaders } from '../_shared/cors.ts'

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

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
      { global: { headers: { Authorization: authHeader } } }
    )

    // Verify user is authenticated
    const { data: { user }, error: userError } = await supabase.auth.getUser()
    if (userError || !user) {
      console.error('Auth error:', userError)
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    // Parse request body
    const { subject, chapter, region } = await req.json()
    if (!subject || !chapter) {
      return new Response(JSON.stringify({ error: 'Missing subject or chapter' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    console.log(`Player ${user.id} enqueueing for ${subject}/${chapter}`)

    // Upsert player profile if needed
    const { data: profile } = await supabase
      .from('profiles')
      .select('username')
      .eq('id', user.id)
      .single()

    const displayName = profile?.username || user.email?.split('@')[0] || 'Player'

    await supabase.from('players').upsert({
      id: user.id,
      display_name: displayName,
      region: region || null,
    })

    // Get player's current MMR
    const { data: player } = await supabase
      .from('players')
      .select('mmr')
      .eq('id', user.id)
      .single()

    const mmr = player?.mmr || 1000

    // Upsert into queue
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
      return new Response(JSON.stringify({ error: 'Failed to join queue' }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    console.log(`Player ${user.id} successfully enqueued with MMR ${mmr}`)

    return new Response(JSON.stringify({ success: true, mmr }), {
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
