# Fix CLI Authentication and Push Migrations

## Option A: Set Password Environment Variable

**Windows PowerShell:**
```powershell
# Get password from Supabase Dashboard → Project Settings → Database → Database Password
$env:SUPABASE_DB_PASSWORD = "your-password-here"
supabase db push
```

**Permanent (add to .env file):**
```
SUPABASE_DB_PASSWORD=your-password-here
```

## Option B: Link with Password Flag

```powershell
supabase link --project-ref qvunaswogfwhixecjpcn --password "your-password-here"
supabase db push
```

## Option C: Use Connection String Directly

```powershell
supabase db push --db-url "postgresql://postgres:[PASSWORD]@aws-1-ap-southeast-1.pooler.supabase.com:5432/postgres"
```

Replace `[PASSWORD]` with URL-encoded password (use % encoding for special chars).

## Get Your Database Password

1. Go to Supabase Dashboard
2. Project Settings → Database
3. Scroll to "Database Password"
4. Click "Reset database password" if you don't know it
5. Copy the password (you'll only see it once)

## After Migrations Applied

Verify everything worked:
```sql
-- Check new columns exist
SELECT column_name 
FROM information_schema.columns 
WHERE table_name = 'matches' 
AND column_name IN ('current_round_id', 'results_round_id', 'results_version', 'results_payload');

-- Check functions exist
SELECT routine_name 
FROM information_schema.routines 
WHERE routine_name IN ('submit_round_answer_v2', 'clear_round_results');
```













