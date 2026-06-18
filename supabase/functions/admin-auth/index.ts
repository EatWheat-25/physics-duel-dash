import { createClient } from 'npm:@supabase/supabase-js@2.57.4'
import { corsHeaders } from '../_shared/cors.ts'
import { getPublishableKey, getSecretKey } from '../_shared/keys.ts'

// Brute-force protection for ADMIN_CODE: max attempts per rolling window.
const MAX_ATTEMPTS_PER_WINDOW = 5
const WINDOW_MS = 15 * 60 * 1000

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }

  try {
    const authHeader = req.headers.get('Authorization')
    if (!authHeader) {
      return new Response(JSON.stringify({ error: 'No authorization header' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      getPublishableKey(),
      { global: { headers: { Authorization: authHeader } } }
    )

    const { data: { user }, error: userError } = await supabaseClient.auth.getUser()
    if (userError || !user) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const { adminCode } = await req.json()
    const ADMIN_CODE = Deno.env.get('ADMIN_CODE')

    if (!ADMIN_CODE) {
      return new Response(JSON.stringify({ error: 'Admin system not configured' }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    // Use elevated key for rate-limit bookkeeping and role assignment
    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      getSecretKey()
    )

    // Rate limit: max MAX_ATTEMPTS_PER_WINDOW code attempts per WINDOW_MS per user
    const now = Date.now()
    const { data: attemptRow } = await supabaseAdmin
      .from('admin_code_attempts')
      .select('attempt_count, window_started_at')
      .eq('user_id', user.id)
      .maybeSingle()

    const windowStartedAt = attemptRow?.window_started_at ? new Date(attemptRow.window_started_at as string).getTime() : 0
    const windowActive = now - windowStartedAt < WINDOW_MS
    const attemptCount = windowActive ? Number(attemptRow?.attempt_count ?? 0) : 0

    if (attemptCount >= MAX_ATTEMPTS_PER_WINDOW) {
      return new Response(JSON.stringify({ error: 'Too many attempts. Try again later.' }), {
        status: 429,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    await supabaseAdmin
      .from('admin_code_attempts')
      .upsert({
        user_id: user.id,
        attempt_count: attemptCount + 1,
        window_started_at: windowActive && attemptRow?.window_started_at
          ? attemptRow.window_started_at
          : new Date(now).toISOString(),
        last_attempt_at: new Date(now).toISOString(),
      })

    if (adminCode !== ADMIN_CODE) {
      return new Response(JSON.stringify({ error: 'Invalid admin code' }), {
        status: 403,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    // Correct code: clear the attempt counter
    await supabaseAdmin
      .from('admin_code_attempts')
      .delete()
      .eq('user_id', user.id)

    const { error: insertError } = await supabaseAdmin
      .from('user_roles')
      .insert({ user_id: user.id, role: 'admin' })
      .select()
      .single()

    if (insertError) {
      if (insertError.code === '23505') {
        return new Response(JSON.stringify({ success: true, message: 'Already admin' }), {
          status: 200,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        })
      }
      throw insertError
    }

    return new Response(JSON.stringify({ success: true, message: 'Admin access granted' }), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  } catch (error) {
    return new Response(JSON.stringify({ error: (error as Error).message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }
})
