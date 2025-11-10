# Lobby & Matchmaking System

## Overview

The application now features a streamlined lobby system that connects to the existing matchmaking backend without any changes to the database schema or server functions.

## Flow

### 1. Subject/Mode Selection

**Entry Point**: Top-left "Select" button (visible on all main screens)

- Click "Select" button to open modal
- Choose subject (Physics/Maths)
- Choose mode:
  - **1v1 Ranked**: Competitive ranked match (requires chapter selection)
  - **Quick Match**: Fast casual battle (requires chapter selection)
  - **Study Mode**: Practice at your pace
  - **Daily Challenge**: Complete today's challenge

### 2. Lobby Page

**Route**: `/lobby?subject={subject}&mode={mode}&chapter={chapter}`

- Displays selected subject, mode, and chapter as badges
- Shows "Tap Battle! to start matchmaking" message
- Bottom navigation dock visible with Battle button

### 3. Matchmaking

**Trigger**: Click "Battle!" button in bottom dock (only active on lobby page)

**Backend Integration**:
```typescript
await supabase.functions.invoke('enqueue', {
  body: { subject, chapter, region: null },
  headers: { Authorization: `Bearer ${session.access_token}` }
});
```

**Responses**:
- `matched: true` → Instantly navigates to `/online-battle/{matchId}`
- `matched: false` → User stays in queue, polling for match updates

### 4. Queue Management

**While Queued**:
- Shows animated loader
- Displays queue time counter (MM:SS)
- "Leave Queue" button available
- Listens for match creation via Supabase realtime

**On Match Found**:
- Automatically navigates to `/online-battle/{matchId}`
- Passes opponent name via navigation state

## State Management

### Store: `src/store/useSubjectStore.ts`

```typescript
export type Subject = 'physics' | 'maths';
export type Mode = 'study' | 'daily' | 'ranked' | 'quick';
export type Chapter = string;

interface SubjectStore {
  subject: Subject;
  mode: Mode | null;
  chapter: Chapter | null;
  setSubject: (subject: Subject) => void;
  setMode: (mode: Mode | null) => void;
  setChapter: (chapter: Chapter | null) => void;
  setSelection: (subject: Subject, mode: Mode, chapter?: Chapter) => void;
}
```

**Persistence**: All state persisted to localStorage under key `academy_ui`

**Defaults**:
- `subject`: `'physics'`
- `mode`: `null`
- `chapter`: `null`

## Components

### TopLeftSelect (`src/components/TopLeftSelect.tsx`)

Compact button with modal/sheet that shows subject/mode/chapter selection.

**Features**:
- Three-step flow: Subject → Mode → Chapter (if needed)
- Back navigation between steps
- Keyboard accessible with ARIA labels
- Persists selection to store
- Navigates to `/lobby` on confirm

### Lobby (`src/routes/Lobby.tsx`)

Main lobby page where users wait before starting a match.

**Features**:
- Displays selected configuration
- Queue management (start/leave)
- Real-time match notifications
- Automatic navigation to match on found

### BottomNav (`src/components/BottomNav.tsx`)

Updated to accept optional `onBattleClick` prop.

**Behavior**:
- Default: Navigates to `/battle/queue`
- Custom: Triggers provided callback (used by Lobby to start queue)

## Backend Integration

### Edge Functions Used

1. **`enqueue`** (`supabase/functions/enqueue/index.ts`)
   - Adds player to matchmaking queue
   - Instantly matches with waiting opponent if available
   - Creates match in `matches_new` table
   - Returns `{ matched: boolean, match_id?: string }`

2. **`leave_queue`** (`supabase/functions/leave_queue/index.ts`)
   - Removes player from queue
   - Called when user clicks "Leave Queue"

3. **`heartbeat`** (`supabase/functions/heartbeat/index.ts`)
   - Keeps queue entry alive
   - Called periodically while in queue

### Database Tables

**No changes made to existing schema**:
- `queue`: Player queue entries
- `matches_new`: Active and completed matches
- `players`: Player profiles with MMR
- `player_actions`: In-match actions

### Realtime Subscriptions

Listens for new matches via Postgres changes:
```typescript
supabase
  .channel(`queue:${user.id}`)
  .on('postgres_changes', {
    event: 'INSERT',
    schema: 'public',
    table: 'matches_new',
    filter: `p1=eq.${user.id},p2=eq.${user.id}`
  }, callback)
  .subscribe();
```

## Routes

| Route | Component | Description |
|-------|-----------|-------------|
| `/` | `Home` | Hub card with mode selector |
| `/lobby` | `Lobby` | Pre-match lobby with queue |
| `/online-battle/:matchId` | `OnlineBattle` | Live match screen |

## Configuration

### Change Default Subject

Edit `src/store/useSubjectStore.ts`:
```typescript
subject: 'physics', // Change to 'maths'
```

### Add New Modes

Edit `src/components/TopLeftSelect.tsx`:
```typescript
const MODES: ModeOption[] = [
  { id: 'ranked', label: '1v1 Ranked', description: '...' },
  // Add new mode here
];
```

### Add New Chapters

Edit `src/components/TopLeftSelect.tsx`:
```typescript
const CHAPTERS = {
  physics: [
    { id: 'mechanics', name: 'Mechanics' },
    // Add new chapter
  ],
  maths: [
    // ...
  ],
};
```

## Accessibility

- All interactive elements keyboard navigable
- ARIA labels on buttons and dialogs
- Focus rings visible on all controls
- Modal has proper `role="dialog"` and `aria-modal="true"`
- Queue time announced for screen readers

## Error Handling

**No Session**:
- Logs error, prevents queue join

**Matchmaking Disabled**:
- Falls back to existing behavior (no artificial delays added)

**Queue Timeout**:
- Leave button always available
- No forced timeouts implemented

## Testing Checklist

- [ ] Click "Select" opens modal
- [ ] Subject selection advances to mode selection
- [ ] Mode selection with ranked/quick advances to chapter selection
- [ ] Mode selection with study/daily confirms immediately
- [ ] Lobby displays correct badges
- [ ] Battle button starts queue
- [ ] Queue time increments
- [ ] Leave queue button works
- [ ] Match found navigates to battle
- [ ] Refresh preserves subject/mode selection
- [ ] No console errors
- [ ] Lighthouse a11y ≥ 95

## Future Enhancements

- MMR-based matchmaking quality indicator
- Region selection for reduced latency
- Match history on lobby page
- Quick rematch after battle
- Auto-queue after match completion
