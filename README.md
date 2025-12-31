# Welcome to your Lovable project
Test change from my PC.


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

## Instant Matching Architecture

### Prerequisites
- Node.js 18+
- Supabase project (hosted)

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

3. **Start dev server:**
   ```bash
   npm run dev
   ```

### Instant Matchmaking (Current Implementation)

Users click **Start Battle** → `enqueue` tries to pair instantly; otherwise `matchmaker_tick` (2s) pairs waiting players. The client listens to **Realtime INSERT** on `public.matches_new` for the current user (two filters: `player1_id` and `player2_id`), then navigates immediately to `/battle/:matchId`. In battle, both clients connect to `game-ws`, send `ready`, receive `game_start`, and play with live `score_update` and `match_end`.

**Detailed Flow:**

```
Player clicks "Start Battle"
  ↓
Client calls enqueue Edge Function
  ↓
enqueue checks queue table for waiting opponent (same subject/chapter)
  ↓
IF OPPONENT FOUND (instant match):
  - Creates matches_new row immediately
  - Removes both players from queue
  - Returns match_id to calling player
  - Other player receives INSERT via Realtime subscription
  - Both navigate to /battle/:matchId (0-200ms)
  ↓
ELSE (no opponent):
  - Player added to queue
  - Client starts 5s heartbeat loop
  - Client subscribes to Realtime for matches_new INSERT
  - matchmaker_tick cron runs every 2 seconds
  - When cron finds match → creates matches_new row
  - Both players receive INSERT via Realtime
  - Both navigate to /battle/:matchId (0-2s worst case)
  ↓
Both players connect to WebSocket (game-ws)
  ↓
Both send ready signal
  ↓
Server broadcasts game_start when both ready
  ↓
Battle begins with live score updates via WebSocket
```

**Key Timings:**
- Best case (opponent waiting): 0-200ms
- Worst case (waiting for cron pairing): 0-2 seconds
- matchmaker_tick cron interval: **2 seconds**
- Heartbeat interval: 5 seconds
- Queue cleanup: 30 seconds (removes stale entries)

**Database Tables:**
- `queue` - Active matchmaking queue (UNIQUE constraint on player_id)
- `matches_new` - Match records (Realtime enabled)
- `players` - Player profiles with MMR
- `match_events` - WebSocket event log

**Realtime Configuration:**
- Realtime enabled for `public.matches_new`
- Client subscribes with TWO filters (p1 and p2) to handle OR limitation
- RLS policy: users can only see matches where they are p1 or p2

**Concurrency Safety:**
- UNIQUE constraint on queue.player_id prevents duplicate entries
- Client-side navigation lock prevents duplicate navigations
- Heartbeat failures (3 consecutive) auto-remove from queue

### 5-Minute Test

1. Open two browsers, log into different accounts
2. Queue both on same mode → both navigate ≤2s
3. See `game_start` → answer a few questions → see live scores → end screen

If navigation stalls, verify realtime publication + RLS policy on `matches_new`.

**Detailed Test Steps:**

```bash
# Terminal: Start dev server
npm run dev
```

**Browser Window 1:**
1. Open http://localhost:5173
2. Sign in as user1@test.com
3. Navigate to Battle Queue (select Physics or Math)
4. Select "A1-Only" mode from dropdown
5. Click "Start Battle" button
6. See "Searching for opponent..." with timer

**Browser Window 2 (Incognito):**
1. Open http://localhost:5173 in incognito
2. Sign in as user2@test.com
3. Navigate to Battle Queue (same subject as Window 1)
4. Select "A1-Only" mode from dropdown
5. Click "Start Battle" button

**Expected Results:**
- Both windows navigate to `/battle/:matchId` within 0-2 seconds
- Both see "Waiting for players to ready up..." screen
- After both ready: countdown "3...2...1...START!"
- Both see timer, scores, and "Battle System Active" message
- Real-time score updates via WebSocket (WS connected)

**Console Breadcrumbs to Verify:**
- Window 1: "QUEUE: Joined successfully, starting heartbeat loop"
- Window 2: "REALTIME: Match INSERT detected, matchId=..."
- Both: "WS: Connected successfully"
- Both: "WS: Received game_start"

**Troubleshooting:**

| Issue | Solution |
|-------|----------|
| No match after 10s | Check matchmaker_tick cron is running (Supabase Dashboard → Database → Cron Jobs) |
| Navigation doesn't happen | Verify Realtime enabled for matches_new (Dashboard → Database → Publications) |
| WebSocket fails to connect | Check JWT token is valid (inspect Network tab for WS upgrade) |
| "Connection lost" toast | Check heartbeat edge function is deployed and accessible |
