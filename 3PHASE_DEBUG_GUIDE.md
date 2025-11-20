# 3-Phase System Debug Guide

## What Should Happen

### Server-Side (game-ws Edge Function)
1. Match starts → Both players ready
2. Server sends **ROUND_START** with:
   - `type: "ROUND_START"`
   - `phase: "thinking"`
   - `thinkingEndsAt: "2024-..."` (ISO timestamp)
   - `question: { ... }` (full question object)

3. After 20 seconds → Server sends **PHASE_CHANGE** with:
   - `type: "PHASE_CHANGE"`
   - `phase: "choosing"`
   - `choosingEndsAt: "2024-..."` (ISO timestamp)
   - `options: [{ id: 0, text: "..." }, ...]` (3 options)

4. After 10 seconds OR both answer → Server sends **ROUND_RESULT** with:
   - `type: "ROUND_RESULT"`
   - `correctOptionId: 1`
   - Player results, scores, etc.

5. Repeat for 5 rounds, then **MATCH_END**

### Client-Side (OnlineBattle.tsx)

#### Console Logs to Watch For

**When ROUND_START arrives:**
```
[OnlineBattle] ✅ ROUND_START received { ... }
[OnlineBattle] Phase: thinking Deadline: 2024-11-20T...
[OnlineBattle] State updated - currentPhase: thinking phaseDeadline: Wed Nov 20...
[OnlineBattle] Phase state: { currentPhase: "thinking", phaseDeadline: "2024-...", hasPhaseDeadline: true, roundOptions: 0 }
[OnlineBattle] Starting timer tick for phase: thinking
[OnlineBattle] Render check - Timer visible? { currentPhase: "thinking", hasDeadline: true }
```

**When PHASE_CHANGE arrives:**
```
[OnlineBattle] ✅ PHASE_CHANGE received { ... }
[OnlineBattle] New phase: choosing
[OnlineBattle] Choosing phase - Options: 3 Deadline: 2024-11-20T...
[OnlineBattle] State updated - roundOptions: 3
[OnlineBattle] Phase state: { currentPhase: "choosing", phaseDeadline: "2024-...", hasPhaseDeadline: true, roundOptions: 3 }
[OnlineBattle] Stopping timer tick
[OnlineBattle] Starting timer tick for phase: choosing
[OnlineBattle] Render check - Timer visible? { currentPhase: "choosing", hasDeadline: true }
```

## UI Should Show

### THINKING Phase (20s)
- **Timer Badge**: Blue badge saying "THINKING"
- **Countdown**: Large "20s", "19s", "18s"... counting down
- **Message**: "Read the question"
- **Question**: Visible
- **Options**: Gray box with clock icon: "Options will appear soon"

### CHOOSING Phase (10s)
- **Timer Badge**: Amber badge saying "CHOOSING"
- **Countdown**: Resets to "10s", "9s", "8s"... counting down
- **Message**: "Select your answer!"
- **Question**: Still visible
- **Options**: 3 clickable buttons (A, B, C)
- **Submit Button**: Enabled when an option is selected

### RESULT Phase (3s)
- **Timer Badge**: Green badge saying "RESULT"
- **Message**: "Calculating..."
- **Options**: Correct answer highlighted green, wrong answer (if selected) highlighted red
- **Scores**: Updated
- **Tug-of-war**: Moves left/right

## Debugging Steps

### If Timer Not Visible

1. **Check State Is Set**
   Look for this log:
   ```
   [OnlineBattle] Phase state: { currentPhase: "thinking", phaseDeadline: "2024-...", hasPhaseDeadline: true, ... }
   ```

   - If `currentPhase` is `null` → Event not received or not setting state
   - If `hasPhaseDeadline` is `false` → Deadline not being set or is invalid date

2. **Check Timer Tick Started**
   Look for:
   ```
   [OnlineBattle] Starting timer tick for phase: thinking
   ```

   - If you see "Timer not starting - missing:" → State not set properly
   - If interval starts but timer not visible → React render issue

3. **Check Render Condition**
   Look for:
   ```
   [OnlineBattle] Render check - Timer visible? { currentPhase: "thinking", hasDeadline: true }
   ```

   - If both are true but timer not visible → CSS/DOM issue
   - If one is false → State issue

### If Options Never Appear

1. **Check PHASE_CHANGE Received**
   Look for:
   ```
   [OnlineBattle] ✅ PHASE_CHANGE received
   [OnlineBattle] Choosing phase - Options: 3
   ```

   - If not received → Server not sending event (check Edge Function logs)
   - If received but options: 0 → Server not including options in event

2. **Check State Updated**
   Look for:
   ```
   [OnlineBattle] Phase state: { currentPhase: "choosing", ..., roundOptions: 3 }
   ```

   - If `roundOptions: 0` → State not being set
   - If `roundOptions: 3` but not visible → QuestionViewer issue

3. **Check QuestionViewer Props**
   Look for:
   ```
   📖 QuestionViewer: Phase: choosing Options: 3
   ```

   - If Phase is correct but Options: 0 → Props not passed correctly
   - If Options: 3 → Check `shouldShowOptions` logic in QuestionViewer

### If Server Not Sending Events

1. **Check Edge Function Logs** (Supabase Dashboard → Edge Functions → game-ws → Logs)

   Look for:
   ```
   [game-ws] ROUND_START { matchId: "...", roundIndex: 0, thinkingEndsAt: "..." }
   [match-id] Thinking time expired, transitioning to choosing
   [game-ws] PHASE_CHANGE → choosing { matchId: "...", roundIndex: 0, choosingEndsAt: "...", optionsCount: 3 }
   ```

2. **If No Logs Appear**
   - Edge Function not deployed or crashed
   - WebSocket connection not established
   - Match not starting properly

3. **If Logs Appear But Client Not Receiving**
   - WebSocket connection dropped
   - Client event handlers not registered
   - JSON parse error

## Expected Timeline

```
T=0s:    Match starts, both players ready
T=0s:    ROUND_START sent
T=0-20s: THINKING phase - Read question
T=20s:   PHASE_CHANGE → choosing
T=20-30s: CHOOSING phase - Select answer
T=30s:   ROUND_RESULT (or earlier if both answered)
T=30-33s: RESULT phase - Show correct answer
T=33s:   Next ROUND_START (round 2)
...
After 5 rounds: MATCH_END
```

## Quick Test

1. Open two browser windows
2. Queue both players for 1v1
3. Wait for match
4. **Immediately check console for:**
   - `[OnlineBattle] ✅ ROUND_START received`
   - `[OnlineBattle] Phase state:` with `currentPhase: "thinking"`
   - `[OnlineBattle] Render check - Timer visible?` with both true
5. **Look at UI:**
   - Blue "THINKING" badge at top
   - Countdown showing ~20s
   - Question visible
   - "Options will appear soon" placeholder
6. **Wait 20 seconds:**
   - Should see `[OnlineBattle] ✅ PHASE_CHANGE received`
   - Badge changes to amber "CHOOSING"
   - Countdown resets to ~10s
   - 3 option buttons appear
7. **Select and submit:**
   - Should see `[OnlineBattle] Round result received`
   - Correct answer highlighted
   - Scores update

## Common Issues

### Timer Shows 0s Immediately
- `phaseDeadline` is in the past
- Server clock vs client clock mismatch
- Deadline calculation wrong

### Options Always Visible
- `currentPhase` stuck at "choosing"
- `shouldShowOptions` logic incorrect
- Practice mode props leaking into online mode

### Timer Never Appears
- `currentPhase` is null
- `phaseDeadline` is null
- Render condition failing
- CSS hiding element (check z-index, display, opacity)

### Phase Stuck at "thinking"
- Server heartbeat not running
- PHASE_CHANGE not being sent
- Client not receiving event
- State not updating on PHASE_CHANGE
