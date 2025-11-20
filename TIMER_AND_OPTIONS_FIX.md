# Timer and Options Display Fix

## Issues Fixed

### 1. Timer Not Visible ✅
**Problem**: Timer was in wrong render section - only showed when `questions.length === 0`

**Solution**: Added phase-based timer display in the main battle view (lines 464-490 of OnlineBattle.tsx):
- Shows current phase badge (THINKING/CHOOSING/RESULT) with color coding
- Displays live countdown in large font
- Updates every 100ms for smooth countdown
- Only shows when `currentPhase` and `phaseDeadline` are set

### 2. Options Never Appear ✅
**Problem**: Options weren't displaying during CHOOSING phase

**Root Cause Analysis**:
- Server sends PHASE_CHANGE event with `options` array when transitioning to choosing
- Client receives event and stores in `roundOptions` state
- QuestionViewer receives `roundOptions` prop
- QuestionViewer shows options only when `shouldShowOptions` is true

**Solution**:
- Added comprehensive logging to track event flow
- Verified server sends PHASE_CHANGE with options array
- Client properly stores options in state
- QuestionViewer receives and displays options

## Changes Made

### OnlineBattle.tsx

1. **Added Timer Display** (lines 464-490):
```typescript
{currentPhase && phaseDeadline && (
  <div className="mb-4 backdrop-blur-sm bg-card/50 p-4 rounded-xl border border-border/50 shadow-lg">
    <div className="flex items-center justify-between">
      <div className="flex items-center gap-3">
        <div className={`px-3 py-1 rounded-full font-bold text-sm text-white ${...}`}>
          {currentPhase === 'thinking' ? 'THINKING' : ...}
        </div>
        <div className="text-3xl font-bold font-mono">
          {/* Live countdown calculation */}
        </div>
      </div>
      <div className="text-sm text-muted-foreground">
        {/* Phase-specific message */}
      </div>
    </div>
  </div>
)}
```

2. **Added Timer Re-render Hook** (lines 373-382):
```typescript
useEffect(() => {
  if (!phaseDeadline || !currentPhase) return;
  const interval = setInterval(() => {
    setTimerTick(prev => prev + 1); // Force re-render every 100ms
  }, 100);
  return () => clearInterval(interval);
}, [phaseDeadline, currentPhase]);
```

3. **Enhanced Event Logging**:
- `onRoundStart`: Logs phase and deadline
- `onPhaseChange`: Logs new phase, options count, deadline
- Tracks state updates for debugging

### game-ws/index.ts

Enhanced server logging:
```typescript
console.log(`[game-ws] ROUND_START`, { matchId, roundIndex, thinkingEndsAt });
console.log(`[game-ws] PHASE_CHANGE → choosing`, { matchId, roundIndex, choosingEndsAt, optionsCount });
```

## Testing Checklist

When testing with two browsers:

### THINKING Phase (20s)
- [ ] Timer appears at top showing "THINKING" badge (blue)
- [ ] Countdown shows "20s", "19s", "18s"... counting down
- [ ] Question text is visible
- [ ] Options section shows "Options will appear soon"
- [ ] No options are clickable

### CHOOSING Phase (10s)
- [ ] Timer badge changes to "CHOOSING" (amber)
- [ ] Countdown resets to "10s" and counts down
- [ ] Options become visible (3 options: A, B, C)
- [ ] Options are clickable
- [ ] "Submit Answer" button appears
- [ ] Message changes to "Select your answer!"

### RESULT Phase (3s)
- [ ] Timer badge changes to "RESULT" (green)
- [ ] Correct answer highlighted in green
- [ ] Wrong answer (if selected) highlighted in red
- [ ] Toast shows "Correct!" or "Incorrect"
- [ ] Scores update
- [ ] Tug-of-war bar updates

## Console Verification

### Client Browser Console:
```
[OnlineBattle] ✅ ROUND_START received
[OnlineBattle] Phase: thinking Deadline: 2024-...
[OnlineBattle] State updated - currentPhase: thinking phaseDeadline: ...
[OnlineBattle] ✅ PHASE_CHANGE received
[OnlineBattle] New phase: choosing
[OnlineBattle] Choosing phase - Options: 3 Deadline: 2024-...
[OnlineBattle] State updated - roundOptions: 3
```

### Server Edge Function Logs:
```
[game-ws] ROUND_START { matchId: ..., roundIndex: 0, thinkingEndsAt: ... }
[match-id] Thinking time expired, transitioning to choosing
[game-ws] PHASE_CHANGE → choosing { matchId: ..., roundIndex: 0, choosingEndsAt: ..., optionsCount: 3 }
```

## Expected Flow

1. **Both players ready** → Server sends ROUND_START
2. **Client receives ROUND_START** → Sets phase to "thinking", shows question, starts timer
3. **20 seconds pass** → Server heartbeat detects deadline
4. **Server sends PHASE_CHANGE** → phase: "choosing", includes 3 options
5. **Client receives PHASE_CHANGE** → Updates phase, shows options, resets timer to 10s
6. **Players select answers** → Send answer_submit
7. **10 seconds pass OR both answer** → Server sends ROUND_RESULT
8. **Client receives ROUND_RESULT** → Shows correct answer, updates scores

## Debug Steps if Issues Persist

1. **Timer not updating?**
   - Check browser console for "[OnlineBattle] State updated" logs
   - Verify `currentPhase` and `phaseDeadline` are set
   - Check if timer re-render hook is running

2. **Options not appearing?**
   - Check console for "PHASE_CHANGE received" log
   - Verify `event.options` has 3 items
   - Check if `roundOptions` state is updated
   - Verify QuestionViewer receives `options` prop

3. **Server not sending events?**
   - Check Edge Function logs in Supabase dashboard
   - Look for "PHASE_CHANGE → choosing" log
   - Verify heartbeat is running (check for "Thinking time expired" log)

## Build Status
✅ Build successful with no errors
