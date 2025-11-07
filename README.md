# Welcome to your Lovable project

## Project info

**URL**: https://lovable.dev/projects/c2ff71ef-17a2-4734-9ab6-17c62a0f235d

## How can I edit this code?

There are several ways of editing your application.

**Use Lovable**

Simply visit the [Lovable Project](https://lovable.dev/projects/c2ff71ef-17a2-4734-9ab6-17c62a0f235d) and start prompting.

Changes made via Lovable will be committed automatically to this repo.

**Use your preferred IDE**

If you want to work locally using your own IDE, you can clone this repo and push changes. Pushed changes will also be reflected in Lovable.

The only requirement is having Node.js & npm installed - [install with nvm](https://github.com/nvm-sh/nvm#installing-and-updating)

Follow these steps:

```sh
# Step 1: Clone the repository using the project's Git URL.
git clone <YOUR_GIT_URL>

# Step 2: Navigate to the project directory.
cd <YOUR_PROJECT_NAME>

# Step 3: Install the necessary dependencies.
npm i

# Step 4: Start the development server with auto-reloading and an instant preview.
npm run dev
```

**Edit a file directly in GitHub**

- Navigate to the desired file(s).
- Click the "Edit" button (pencil icon) at the top right of the file view.
- Make your changes and commit the changes.

**Use GitHub Codespaces**

- Navigate to the main page of your repository.
- Click on the "Code" button (green button) near the top right.
- Select the "Codespaces" tab.
- Click on "New codespace" to launch a new Codespace environment.
- Edit files directly within the Codespace and commit and push your changes once you're done.

## What technologies are used for this project?

This project is built with:

- Vite
- TypeScript
- React
- shadcn-ui
- Tailwind CSS

## How can I deploy this project?

Simply open [Lovable](https://lovable.dev/projects/c2ff71ef-17a2-4734-9ab6-17c62a0f235d) and click on Share -> Publish.

## Can I connect a custom domain to my Lovable project?

Yes, you can!

To connect a domain, navigate to Project > Settings > Domains and click Connect Domain.

Read more here: [Setting up a custom domain](https://docs.lovable.dev/tips-tricks/custom-domain#step-by-step-guide)

---

## Matchmaking System Quickstart

### Prerequisites
- Node.js 18+
- Supabase CLI (`npm i -g supabase`)
- Supabase project (local or hosted)

### Setup

1. **Install dependencies:**
   ```bash
   npm install
   ```

2. **Configure environment:**
   Create `.env` file with:
   ```bash
   VITE_SUPABASE_URL=your_supabase_url
   VITE_SUPABASE_ANON_KEY=your_anon_key
   ```

3. **Start local Supabase (optional for local dev):**
   ```bash
   supabase start
   ```

4. **Apply migrations:**
   ```bash
   supabase db reset --linked
   # OR for remote project:
   supabase db push
   ```

5. **Deploy edge functions:**
   ```bash
   supabase functions deploy find_match
   supabase functions deploy accept_offer
   supabase functions deploy decline_offer
   supabase functions deploy sweeper
   ```

6. **Schedule sweeper cron job:**

   Via Supabase Dashboard → Database → SQL Editor:
   ```sql
   SELECT cron.schedule(
     'sweeper_job',
     '10 seconds',
     $$
     SELECT net.http_post(
       url:='https://your-project-ref.supabase.co/functions/v1/sweeper',
       headers:='{"Content-Type": "application/json"}'::jsonb,
       body:='{}'::jsonb
     ) as request_id;
     $$
   );
   ```

7. **Start dev server:**
   ```bash
   npm run dev
   ```

### Testing Matchmaking Flow

**Two-player test:**

1. Open two browser windows (use incognito for second user)
2. Sign up/log in as two different users
3. Both navigate to matchmaking for the same subject
4. Both click "Find Match"
5. Within 2-5 seconds, both should see the **Match Offer Modal** with 15-second countdown
6. Both click "Accept"
7. Both are redirected to `/online-battle/:matchId`

**Expected behavior:**
- If one declines → both return to waiting/queue
- If timeout (15s) → offer expires, both requeued
- If both accept → match is created and confirmed

### Architecture Overview

**Event-Driven Flow:**

```
Player clicks "Find Match"
  ↓
Calls find_match Edge Function (with advisory lock)
  ↓
Checks queue for compatible opponent (dynamic MMR based on wait time)
  ↓
IF MATCH FOUND:
  - Creates match_offer (15s expiration)
  - Updates queue status to "offered"
  - Returns offer to both players
  ↓
Frontend shows Accept/Decline modal
  ↓
Player clicks Accept → calls accept_offer RPC
  ↓
When BOTH accept:
  - Creates matches_new row
  - Updates offer state to "confirmed"
  - Postgres_changes subscription notifies both clients
  ↓
Both navigate to battle page
```

**Sweeper (cron):**
- Runs every 10 seconds
- Finds expired pending offers
- Returns players to "waiting" status
- Allows them to be matched again

**Database Tables:**
- `queue` - Active matchmaking queue with status tracking
- `match_offers` - Pending offers with accept/decline state
- `matches_new` - Confirmed matches ready for battle
- `players` - Player profiles with MMR

**Concurrency Safety:**
- Advisory locks prevent double-matching
- `FOR UPDATE SKIP LOCKED` prevents race conditions
- Idempotent RPCs safe under retries
