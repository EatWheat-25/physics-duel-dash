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
          subject,
          level,
          created_at: new Date().toISOString()
        }, {
          onConflict: 'player_id'
        })

      if (queueError) {
        console.error(`[MATCHMAKER] Error adding to queue:`, {
          code: queueError.code,
          message: queueError.message,
          details: queueError.details,
          hint: queueError.hint,
          fullError: queueError
        })
        return new Response(JSON.stringify({ 
          error: 'Failed to join queue',
          details: queueError.message,
          hint: queueError.hint || 'Make sure database migrations have been applied (subject/level columns)'
        }), {
          status: 500,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        })
      }
    } else {
      // Update subject/level if player is already in queue (in case they changed selection)
      const { error: updateError } = await supabase
        .from('matchmaking_queue')
        .update({ subject, level })
        .eq('player_id', user.id)
      
      if (updateError) {
        console.error(`[MATCHMAKER] Error updating queue entry:`, updateError)
        // Continue anyway - the player is already in queue
      } else {
        console.log(`[MATCHMAKER] Player ${user.id} already in queue, updated subject/level`)
      }
    }

    console.log(`[MM] Queued player ${user.id}`)

    // Step 2: Find and atomically claim an opponent
    // Strategy: Find the earliest waiting opponent with same subject/level, then atomically update their status
    // This prevents both players from creating matches with each other
    const { data: waitingPlayers, error: searchError } = await supabase
      .from('matchmaking_queue')
      .select('*')
      .eq('status', 'waiting')
      .eq('subject', subject)
      .eq('level', level)
      .neq('player_id', user.id)
      .order('created_at', { ascending: true })
      .limit(1)

    if (searchError) {
      console.error(`[MM] Error searching queue:`, searchError)
      return new Response(JSON.stringify({
        matched: false,
        queued: true
      }), {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      })
    }

    // No opponent available - player stays in queue
    if (!waitingPlayers || waitingPlayers.length === 0) {
      console.log(`[MM] No opponent found, player ${user.id} is waiting`)
      return new Response(JSON.stringify({
        matched: false,
        queued: true
      }), {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      })
    }

    const opponent = waitingPlayers[0]
    const opponentId = opponent.player_id

    // Safety check: ensure we're not matching a player with themselves
    if (opponentId === user.id) {
      console.error(`[MM] ❌ CRITICAL: Attempted to match player ${user.id} with themselves!`)
      return new Response(JSON.stringify({
        matched: false,
        queued: true,
        error: 'Matchmaking error: cannot match with self'
      }), {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      })
    }

    // Atomically claim the opponent by updating their status
    // Only update if they're still 'waiting' (prevents double-matching)
    const { data: claimedOpponent, error: claimError } = await supabase
      .from('matchmaking_queue')
      .update({ status: 'matched' })
      .eq('player_id', opponentId)
      .eq('status', 'waiting')
      .select()
      .maybeSingle()

    if (claimError) {
      console.error(`[MM] Error claiming opponent:`, claimError)
      return new Response(JSON.stringify({
        matched: false,
        queued: true
      }), {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      })
    }

    // If update returned no rows, opponent was already claimed by another request
    if (!claimedOpponent) {
      console.log(`[MM] Opponent ${opponentId} was already claimed, player ${user.id} continues waiting`)
      return new Response(JSON.stringify({
        matched: false,
        queued: true
      }), {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      })
    }

    // Successfully claimed opponent!
    console.log(`[MM] Claimed opponent ${opponentId} for player ${user.id}`)

    // Step 3: Create match with consistent player ordering
    // Convention: player1_id = earlier queued player, player2_id = later queued player
    // This ensures both players get the same match row regardless of who called first
    const userQueueEntry = existingEntry || { created_at: new Date().toISOString() }
    const userQueueTime = userQueueEntry.created_at
    const opponentQueueTime = claimedOpponent.created_at
    
    const player1Id = userQueueTime < opponentQueueTime ? user.id : opponentId
    const player2Id = userQueueTime < opponentQueueTime ? opponentId : user.id

    console.log(`[MM] Creating match: player1=${player1Id} (queued ${player1Id === user.id ? userQueueTime : opponentQueueTime}), player2=${player2Id}`)
    
    const { data: newMatch, error: matchError } = await supabase
      .from('matches')
      .insert({
        player1_id: player1Id,
        player2_id: player2Id,
        subject,
        mode: level,
        status: 'pending',
        target_rounds_to_win: 3,
        max_rounds: 3,  // Set to 3 for testing
        target_points: 5  // Explicitly set target points
        // created_at has DEFAULT now(), so we don't need to specify it
      })
      .select()
      .single()

    if (matchError) {
      console.error(`[MM] ❌ Error creating match:`, {
        code: matchError.code,
        message: matchError.message,
        details: matchError.details,
        hint: matchError.hint,
        fullError: matchError
      })
      // Reset opponent's status back to waiting on error
      await supabase
        .from('matchmaking_queue')
        .update({ status: 'waiting' })
        .eq('player_id', opponentId)
      return new Response(JSON.stringify({ 
        error: 'Failed to create match',
        details: matchError.message,
        code: matchError.code
      }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      })
    }

    // Step 4: Remove both players from queue (match created successfully)
    await supabase
      .from('matchmaking_queue')
      .delete()
      .in('player_id', [user.id, opponentId])

    console.log(`[MM] ✅ Created match ${newMatch.id} for players ${player1Id}/${player2Id}`)

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
