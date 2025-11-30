# Supabase Debug Guide

This guide shows you how to work with Supabase and share data with me (Auto) for debugging.

## Quick Commands

### Check Database Tables
```bash
# Check all tables and row counts
npm run db:check

# List matches
npm run db:matches

# List matchmaking queue
npm run db:queue

# List questions
npm run db:questions

# Get specific match
npm run db:match <match-id>
```

### Debug Connection Issues
```bash
# Debug WebSocket connection for a match
npm run debug:connection <match-id>
```

## Using the Web Debug Tool

1. **Navigate to:** `/supabase-debug` in your app
2. **Click buttons** to check tables
3. **Copy results** and share with me

## Sharing Data With Me

When you want me to help debug, you can:

1. **Run a query script** and paste the output:
   ```bash
   npm run db:matches
   ```

2. **Use the web tool** at `/supabase-debug` and tell me what you see

3. **Share specific errors** from browser console

4. **Tell me what to check**, like:
   - "Check if match X exists"
   - "Show me the matchmaking queue"
   - "Why can't I connect to game-ws?"

## Common Debugging Tasks

### Check if a match exists
```bash
npm run db:match <match-id>
```

### Check matchmaking queue
```bash
npm run db:queue
```

### Verify questions are seeded
```bash
npm run db:questions
```

### Debug connection for a match
```bash
npm run debug:connection <match-id>
```

## What I Can Help With

✅ **Query any table** - I can write queries for you to run  
✅ **Debug connection issues** - Check WebSocket, auth, matches  
✅ **Verify data** - Make sure matches/questions exist  
✅ **Check RLS policies** - Verify permissions  
✅ **Test edge functions** - Help debug matchmake-simple, game-ws  

## Example Workflow

1. You: "I'm stuck at 'Connecting to Battle...'"
2. Me: "Run `npm run db:matches` and share the output"
3. You: *pastes output*
4. Me: "I see the issue - the match has wrong field names. Let me fix it."

