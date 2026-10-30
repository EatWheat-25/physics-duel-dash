# Guest authentication

Continue as Guest uses `supabase.auth.signInAnonymously()`. Supabase creates an
Auth user and session without an email or password; email confirmation settings
no longer affect guest login. There is no synthetic-email fallback.

`AuthContext` consumes the normal `SIGNED_IN` event. The auth page's existing
profile check routes incomplete/missing profiles to `/onboarding` and completed
profiles to `/`. Onboarding still upserts `profiles` by the authenticated user ID
and refreshes the context before entering the app. Anonymous sessions use the
existing persistent browser storage and refresh-token configuration.

Guest accounts cannot be recovered after signing out, losing browser storage,
or moving to another device. The auth page explains this before entry. Account
linking/upgrading and cleanup of historical `guest_*@temp.com` accounts are not
part of this change; existing sessions remain valid.

## Required Supabase setup

1. In **each hosted project used by the frontend** (`VITE_SUPABASE_URL`), enable
   **Anonymous Sign-Ins** under Authentication → Sign In / Providers. Ensure
   new user signups are allowed. Keep normal email confirmation enabled if desired.
2. The checked-in `[auth] enable_anonymous_sign_ins = true` enables local anonymous
   sign-ins only. Restart local Supabase after changing it. Committing this file,
   deploying the frontend, or applying SQL migrations does not establish that
   anonymous auth is enabled in a hosted project.
3. Review deployed policies and auth hooks before enabling the provider. Repository
   inspection cannot establish deployed settings, hooks, policy drift, or provider
   availability. No production auth requests or configuration changes were made.
4. Review Auth rate limits and abuse protection. Supabase recommends CAPTCHA for
   anonymous sign-ins. This UI does not collect a CAPTCHA token: projects requiring
   CAPTCHA must add a token-collection UI and pass `options.captchaToken` before
   expecting guest play to succeed. Until then, a CAPTCHA rejection is handled as
   an unavailable guest session and other sign-in methods remain available.

Disabled anonymous auth or disabled signup gets an actionable message offering
sign-in/account creation. Rate limiting asks the player to wait or use another
method. Network errors, CAPTCHA failures, and missing sessions allow retry and do
not deliberately navigate to onboarding. No unverifiable accounts are created
as a fallback.

## Row-level security review

Anonymous Auth users receive the **authenticated** database role and a unique
`auth.uid()`; they are distinct from an unauthenticated `anon` client. The
`is_anonymous` JWT claim is the supported way to distinguish them. Client-supplied
`user_metadata.is_guest` is unused by repository policies and is no longer sent.

| Area | Repository policy behavior for anonymous users |
| --- | --- |
| `profiles` | Original migration `20250929230203_b1e6c55d-c41f-4980-9e4d-571f88f4531b.sql` and initial-schema migration use `auth.uid() = id` for SELECT/INSERT/UPDATE. Guest onboarding upsert works on its own row and cannot access another user's profile. |
| `players`, queues, matches, notifications, progress/rank history | Ownership/participant checks use the user UUID. The June 2026 hardening retains own-row reads and server-managed ranks/match writes. No email or permanent-user claim is required. |
| Questions and administrative operations | Existing authenticated read access applies to guests. June 2026 admin policies use `has_role(auth.uid(), 'admin')`; becoming a guest does not grant an admin role. |
| Question-image storage | Existing `Authenticated users can upload question images` allows **any authenticated user**, including guests, to upload to `question-images`; reads are public. This was also available to the old synthetic guest accounts. Review this exposure before rollout; this patch does not change storage authorization. |

No RLS relaxation or database migration is needed for guest profile creation.
Run the profile regression against a disposable database with the deployed schema
to detect drift. Policies granting privileges to all authenticated users also admit
guests; permanent-only capabilities require an explicit `is_anonymous` check.

## Verification

- `npm ci` then `npm test`: focused UI regression tests for anonymous-only login,
  disabled providers/signups, rate limits, CAPTCHA rejection, thrown errors,
  incomplete responses, pending/duplicate requests, existing-profile routing,
  and onboarding profile creation without an email.
- `npm run build`.
- `npx eslint src/pages/Auth.tsx src/pages/Auth.test.tsx src/pages/Onboarding.test.tsx src/test/setup.ts vitest.config.ts`.
- On a **disposable** Supabase database with the application schema:
  `psql "$TEST_DATABASE_URL" -v ON_ERROR_STOP=1 -f supabase/tests/guest-profile-rls.sql`.
  The SQL exercises real RLS for guest upsert/reads, cross-user insert/update denial,
  permanent-user access, and unauthenticated denial, and rolls back its fixtures.

The SQL regression was also executed in isolated PostgreSQL (PGlite), applying
the original profile migration with a minimal Supabase Auth schema/roles and the
standard profile grants. This validates the checked-in profile policy behavior;
it does not validate the full migration chain or a deployed Supabase project.

Validation in the development sandbox: the build and focused lint check passed.
All 13 UI tests passed with exit code 0 using a temporary, non-repository
Node preloader for this sandbox: `/proc` is absent, so Node's
`process.memoryUsage()` throws `ENOENT: uv_resident_set_memory` inside Vitest's
worker pool. The preloader uses V8 heap counters only when that specific lookup
fails. Without it, even a minimal smoke test hangs after assertions pass.
Normal environments should run `npm test` directly. The PR also adds a Node 22
GitHub Actions test/build job.
Full-project lint reports 667 errors / 29 warnings (baseline: 669 / 29).
The application TypeScript check reports 80 diagnostics identical to the unchanged
base branch. These existing failures are outside this fix.

Before rollout, use a staging project with normal email confirmation enabled:

1. From a fresh browser session, Continue as Guest, complete onboarding, and verify
   entry into the app. Confirm the Auth user has `is_anonymous = true` and no email.
2. Reload and verify that the session/profile resumes without creating another user.
3. Verify a second guest cannot read/update the first guest's profile; run the SQL
   regression against the staging schema. Check access to required game APIs.
4. Disable anonymous sign-ins and verify the actionable error and working regular
   sign-in paths, then re-enable the provider. Also check rejected/rate-limited
   requests if those protections are configured.

## References

- https://supabase.com/docs/guides/auth/auth-anonymous
- https://supabase.com/docs/reference/javascript/auth-signinanonymously
- https://supabase.com/docs/guides/local-development/cli/config
