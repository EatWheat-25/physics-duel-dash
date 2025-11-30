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

    console.log(`[MATCHMAKER] Player ${user.id} requesting match`)

    // Use service role for database operations
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    )

    // Step 1: Add this player to queue (only if not already waiting)
    // Check if player is already in queue with status 'waiting'
    const { data: existingEntry } = await supabase
      .from('matchmaking_queue')
      .select('*')
      .eq('player_id', user.id)
      .eq('status', 'waiting')
      .maybeSingle()

    // Only insert if not already waiting (preserve original created_at for fairness)
    if (!existingEntry) {
      const { error: queueError } = await supabase
        .from('matchmaking_queue')
        .upsert({
          player_id: user.id,
          status: 'waiting',
          created_at: new Date().toISOString()
        }, {
          onConflict: 'player_id'
        })

      if (queueError) {
        console.error(`[MATCHMAKER] Error adding to queue:`, queueError)
        return new Response(JSON.stringify({ error: 'Failed to join queue' }), {
          status: 500,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        })
      }
    } else {
      console.log(`[MATCHMAKER] Player ${user.id} already in queue, preserving original timestamp`)
    }

    console.log(`[MATCHMAKER] Player ${user.id} in queue`)

    // Step 2: Look for another waiting player
    const { data: waitingPlayers, error: searchError } = await supabase
      .from('matchmaking_queue')
      .select('*')
      .eq('status', 'waiting')
      .neq('player_id', user.id)
      .order('created_at', { ascending: true })
      .limit(1)

    if (searchError) {
      console.error(`[MATCHMAKER] Error searching queue:`, searchError)
      return new Response(JSON.stringify({
        matched: false,
        queued: true
      }), {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      })
    }

    // No other players waiting
    if (!waitingPlayers || waitingPlayers.length === 0) {
      console.log(`[MATCHMAKER] No opponents found, player ${user.id} is waiting`)
      return new Response(JSON.stringify({
        matched: false,
        queued: true
      }), {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      })
    }

    // Found an opponent!
    const opponent = waitingPlayers[0]
    
    // Safety check: ensure we're not matching a player with themselves
    if (opponent.player_id === user.id) {
      console.error(`[MATCHMAKER] ❌ CRITICAL: Attempted to match player ${user.id} with themselves!`)
      return new Response(JSON.stringify({
        matched: false,
        queued: true,
        error: 'Matchmaking error: cannot match with self'
      }), {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      })
    }

    console.log(`[MATCHMAKER] Matched ${user.id} with ${opponent.player_id}`)

    // Step 3: Create match (with explicit check that players are different)
    const { data: newMatch, error: matchError } = await supabase
      .from('matches')
      .insert({
        player1_id: user.id,
        player2_id: opponent.player_id,
        status: 'pending',
        created_at: new Date().toISOString()
      })
      .select()
      .single()

    if (matchError) {
      console.error(`[MATCHMAKER] Error creating match:`, matchError)
      return new Response(JSON.stringify({ error: 'Failed to create match' }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      })
    }

    // Step 4: Delete both players' queue entries (match found, no longer in queue)
    await supabase
      .from('matchmaking_queue')
      .delete()
      .in('player_id', [user.id, opponent.player_id])

    console.log(`[MATCHMAKER] ✅ Match created: ${newMatch.id}`)

    return new Response(JSON.stringify({
      matched: true,
      match: newMatch,
      match_id: newMatch.id
    }), {
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
