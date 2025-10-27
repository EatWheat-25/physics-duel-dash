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
      console.log('Unauthorized matchmaker tick attempt')
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      serviceRoleKey ?? ''
    )

    console.log('Running matchmaker tick...')

    // Get all queue entries grouped by subject and chapter
    const { data: queueEntries, error: queueError } = await supabase
      .from('queue')
      .select('*, players(display_name, region)')
      .order('enqueued_at', { ascending: true })

    if (queueError || !queueEntries || queueEntries.length === 0) {
      console.log('No players in queue or error:', queueError)
      return new Response(JSON.stringify({ matched: 0 }), {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    console.log(`Found ${queueEntries.length} players in queue`)

    // Group by subject and chapter
    const groups: { [key: string]: any[] } = {}
    queueEntries.forEach((entry) => {
      const key = `${entry.subject}:${entry.chapter}`
      if (!groups[key]) groups[key] = []
      groups[key].push(entry)
    })

    let matchesMade = 0

    // Try to match players in each group
    for (const [groupKey, players] of Object.entries(groups)) {
      if (players.length < 2) continue

      console.log(`Attempting matches for ${groupKey} with ${players.length} players`)

      // Sort by wait time (oldest first)
      players.sort((a, b) => new Date(a.enqueued_at).getTime() - new Date(b.enqueued_at).getTime())

      const matched = new Set<string>()

      for (let i = 0; i < players.length; i++) {
        if (matched.has(players[i].player_id)) continue

        const p1 = players[i]
        const waitTime = Date.now() - new Date(p1.enqueued_at).getTime()
        const mmrWindow = Math.min(150 + Math.floor(waitTime / 10000) * 50, 500) // Widen window over time

        // Find best match
        let bestMatch = null
        let bestScore = Infinity

        for (let j = i + 1; j < players.length; j++) {
          if (matched.has(players[j].player_id)) continue

          const p2 = players[j]
          const mmrDiff = Math.abs(p1.mmr - p2.mmr)

          if (mmrDiff <= mmrWindow) {
            // Score based on MMR difference and region match
            const regionBonus = p1.region === p2.region ? -50 : 0
            const score = mmrDiff + regionBonus

            if (score < bestScore) {
              bestScore = score
              bestMatch = p2
            }
          }
        }

        if (bestMatch) {
          console.log(`Matching ${p1.player_id} (MMR: ${p1.mmr}) with ${bestMatch.player_id} (MMR: ${bestMatch.mmr})`)

          // Fetch random questions for this match
          const { data: questions } = await supabase
            .from('questions')
            .select('*')
            .eq('subject', p1.subject)
            .eq('chapter', p1.chapter)
            .limit(5)

          // Create match
          const { data: newMatch, error: matchError } = await supabase
            .from('matches_new')
            .insert({
              p1: p1.player_id,
              p2: bestMatch.player_id,
              subject: p1.subject,
              chapter: p1.chapter,
              state: 'pending',
            })
            .select()
            .single()

          if (matchError) {
            console.error('Error creating match:', matchError)
            continue
          }

          // Remove both players from queue
          await supabase.from('queue').delete().in('player_id', [p1.player_id, bestMatch.player_id])

          // Broadcast match found to both players via Realtime
          const serverWsUrl = `wss://${Deno.env.get('SUPABASE_URL')?.split('//')[1]}/functions/v1/game-ws`

          await supabase.channel(`user_${p1.player_id}`).send({
            type: 'broadcast',
            event: 'match_found',
            payload: {
              match_id: newMatch.id,
              opponent_display: bestMatch.players?.display_name || 'Opponent',
              server_ws_url: serverWsUrl,
            },
          })

          await supabase.channel(`user_${bestMatch.player_id}`).send({
            type: 'broadcast',
            event: 'match_found',
            payload: {
              match_id: newMatch.id,
              opponent_display: p1.players?.display_name || 'Opponent',
              server_ws_url: serverWsUrl,
            },
          })

          matched.add(p1.player_id)
          matched.add(bestMatch.player_id)
          matchesMade++
        }
      }
    }

    console.log(`Matchmaker tick complete. Made ${matchesMade} matches`)

    return new Response(JSON.stringify({ matched: matchesMade }), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  } catch (error) {
    console.error('Error in matchmaker_tick:', error)
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }
})
