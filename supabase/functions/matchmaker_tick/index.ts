import { createClient } from 'npm:@supabase/supabase-js@2.57.4'
import { corsHeaders } from '../_shared/cors.ts'

interface MatchResult {
  matched: boolean
  match_id?: string
  opponent_id?: string
  match_quality?: number
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }

  try {
    const authHeader = req.headers.get('Authorization')
    const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')
    const userAgent = req.headers.get('User-Agent') || ''

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

    console.log('🔄 Running matchmaker tick...')

    const { data: queueEntries, error: queueError } = await supabase
      .from('matchmaking_queue')
      .select('*')
      .order('created_at', { ascending: true })

    if (queueError || !queueEntries || queueEntries.length === 0) {
      console.log('No players in matchmaking_queue or error:', queueError)
      return new Response(JSON.stringify({ matched: 0, message: 'No players in queue' }), {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    console.log(`📋 Found ${queueEntries.length} active players in queue`)

    let matchesMade = 0
    const processedPlayers = new Set<string>()

    for (const player of queueEntries) {
      if (processedPlayers.has(player.user_id)) {
        continue
      }

      const waitSeconds = Math.floor((Date.now() - new Date(player.created_at).getTime()) / 1000)

      console.log(`⏳ Trying to match player ${player.user_id} (mode: ${player.mode}, waited: ${waitSeconds}s)`)

      const { data: matchResult, error: matchError } = await supabase
        .rpc('try_match_player_enhanced', {
          p_player_id: player.user_id,
          p_subject: player.subject,
          p_chapter: player.mode,
          p_mmr: 1000,
          p_wait_seconds: waitSeconds,
        })
        .maybeSingle() as { data: MatchResult | null, error: any }

      if (matchError) {
        console.error(`❌ Match error for player ${player.player_id}:`, matchError)
        continue
      }

      if (matchResult && matchResult.matched && matchResult.opponent_id) {
        console.log(`✅ Match created: ${matchResult.match_id}`)
        console.log(`   Player 1: ${player.user_id}`)
        console.log(`   Player 2: ${matchResult.opponent_id}`)
        console.log(`   Quality: ${matchResult.match_quality}/100`)

        processedPlayers.add(player.user_id)
        processedPlayers.add(matchResult.opponent_id)
        matchesMade++

        await supabase.from('player_activity').upsert([
          { player_id: player.user_id, last_seen: new Date().toISOString() },
          { player_id: matchResult.opponent_id, last_seen: new Date().toISOString() }
        ], {
          onConflict: 'player_id',
          ignoreDuplicates: false
        })
      } else {
        console.log(`⏸️  No suitable match found for player ${player.user_id}`)
      }
    }

    const cleanupResult = await supabase.rpc('cleanup_stale_queue_entries')

    console.log(`🏁 Matchmaker tick complete`)
    console.log(`   Matches made: ${matchesMade}`)
    console.log(`   Stale entries cleaned: ${cleanupResult.data || 0}`)

    return new Response(JSON.stringify({
      matched: matchesMade,
      cleaned: cleanupResult.data || 0,
      queue_size: queueEntries.length - (matchesMade * 2)
    }), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  } catch (error) {
    console.error('Error in matchmaker_tick:', error)
    return new Response(JSON.stringify({ error: (error as Error).message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }
})
