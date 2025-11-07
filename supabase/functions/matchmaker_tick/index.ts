import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.57.4'
import { corsHeaders } from '../_shared/cors.ts'

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }

  try {
    // Allow calls from cron jobs (no auth header) or with service role key
    const authHeader = req.headers.get('Authorization')
    const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')
    const userAgent = req.headers.get('User-Agent') || ''

    // Allow if: called by pg_cron (no auth but specific user agent) OR has valid service role
    const isCronJob = !authHeader && userAgent.includes('pg_net')
    const hasServiceRole = authHeader && serviceRoleKey && authHeader.includes(serviceRoleKey)

    if (!isCronJob && !hasServiceRole) {
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
              state: 'active',
              p1_score: 0,
              p2_score: 0,
            })
            .select()
            .single()

          if (matchError) {
            console.error('Error creating match:', matchError)
            continue
          }

          // Remove both players from queue
          await supabase.from('queue').delete().in('player_id', [p1.player_id, bestMatch.player_id])

          console.log(`✅ Match created: ${newMatch.id} | P1: ${p1.player_id} | P2: ${bestMatch.player_id}`)

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
