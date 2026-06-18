// API key helpers for edge functions.
//
// Supabase injects both the new-style keys (SUPABASE_SECRET_KEYS /
// SUPABASE_PUBLISHABLE_KEYS, JSON objects keyed by key name) and the legacy
// keys (SUPABASE_SERVICE_ROLE_KEY / SUPABASE_ANON_KEY). We prefer the new
// keys so the legacy ones can be disabled, but fall back to legacy so a
// deploy before the dashboard migration completes never breaks anything.

function parseNamedKeys(envVar: string): Record<string, string> | null {
  const json = Deno.env.get(envVar)
  if (!json) return null
  try {
    const parsed = JSON.parse(json)
    return parsed && typeof parsed === 'object' ? parsed : null
  } catch {
    return null
  }
}

/** Elevated key (bypasses RLS). New sb_secret_... key, else legacy service_role. */
export function getSecretKey(): string {
  const keys = parseNamedKeys('SUPABASE_SECRET_KEYS')
  const fromNew = keys?.['default']
  if (typeof fromNew === 'string' && fromNew.length > 0) return fromNew
  return Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
}

/** Low-privilege key (respects RLS). New sb_publishable_... key, else legacy anon. */
export function getPublishableKey(): string {
  const keys = parseNamedKeys('SUPABASE_PUBLISHABLE_KEYS')
  const fromNew = keys?.['default']
  if (typeof fromNew === 'string' && fromNew.length > 0) return fromNew
  return Deno.env.get('SUPABASE_ANON_KEY') ?? ''
}

/**
 * True when the Authorization header carries an elevated key (new secret key
 * or, during migration, the legacy service_role key).
 */
export function isElevatedAuthHeader(authHeader: string | null): boolean {
  if (!authHeader) return false
  const secret = getSecretKey()
  const legacy = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
  return (secret.length > 0 && authHeader.includes(secret))
    || (legacy.length > 0 && authHeader.includes(legacy))
}
