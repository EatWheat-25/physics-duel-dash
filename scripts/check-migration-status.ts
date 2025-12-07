import { createClient } from '@supabase/supabase-js'
import * as dotenv from 'dotenv'
import { resolve, dirname } from 'path'
import { fileURLToPath } from 'url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)

dotenv.config({ path: resolve(__dirname, '../.env') })

const supabaseUrl = process.env.VITE_SUPABASE_URL!
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('❌ Missing VITE_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in .env')
  process.exit(1)
}

const supabase = createClient(supabaseUrl, supabaseServiceKey)

async function checkMigrationStatus() {
  console.log('🔍 Checking migration status...\n')

  // Check if the problematic migrations were applied
  const problematicMigrations = [
    '20251130010000_fix_v2_foreign_keys',
    '20251202100001_seed_maths_a2_integration_question'
  ]

  // Check if questions_v2 table exists and has correct structure
  console.log('1️⃣ Checking questions_v2 table...')
  const { data: questions, error: qError } = await supabase
    .from('questions_v2')
    .select('id, title, subject, level')
    .limit(1)

  if (qError) {
    console.log(`   ❌ Error querying questions_v2: ${qError.message}`)
  } else {
    console.log(`   ✅ questions_v2 table exists`)
    if (questions && questions.length > 0) {
      console.log(`   📊 Sample question: ${questions[0].title} (${questions[0].subject}, ${questions[0].level})`)
    }
  }

  // Check for the specific problematic question ID
  console.log('\n2️⃣ Checking for problematic question ID...')
  const { data: problemQuestion, error: pError } = await supabase
    .from('questions_v2')
    .select('*')
    .eq('id', '3f4f0350-ccac-43b2-a1c3-b1ba62519c00')
    .maybeSingle()

  if (pError) {
    console.log(`   ❌ Error: ${pError.message}`)
  } else if (problemQuestion) {
    console.log(`   ⚠️  Found question with problematic ID:`)
    console.log(`      Title: ${problemQuestion.title}`)
    console.log(`      Subject: ${problemQuestion.subject}`)
    console.log(`      Level: ${problemQuestion.level}`)
    
    // Check if it has invalid values
    if (problemQuestion.subject === 'maths' || problemQuestion.level === 'a2') {
      console.log(`   ❌ Has invalid values! Subject: "${problemQuestion.subject}", Level: "${problemQuestion.level}"`)
      console.log(`   💡 Will need to delete and re-insert with correct values`)
    } else {
      console.log(`   ✅ Values look correct`)
    }
  } else {
    console.log(`   ✅ No problematic question found (good - can be inserted fresh)`)
  }

  // Check match_rounds foreign key constraint
  console.log('\n3️⃣ Checking match_rounds table for orphaned data...')
  let orphanedRounds: any[] = []
  let orphanError: any = null
  
  try {
    // Try manual check
    const { data: allRounds } = await supabase
      .from('match_rounds')
      .select('question_id')
      .limit(100)
    
    if (!allRounds || allRounds.length === 0) {
      orphanedRounds = []
    } else {
      const { data: validQuestions } = await supabase
        .from('questions_v2')
        .select('id')
        .in('id', allRounds.map(r => r.question_id).filter(Boolean))

      const validIds = new Set(validQuestions?.map(q => q.id) || [])
      orphanedRounds = allRounds.filter(r => r.question_id && !validIds.has(r.question_id))
    }
  } catch (err: any) {
    orphanError = err
  }

  if (orphanError) {
    console.log(`   ⚠️  Could not check (table might not exist or no access): ${orphanError.message}`)
  } else {
    const count = Array.isArray(orphanedRounds) ? orphanedRounds.length : 0
    if (count > 0) {
      console.log(`   ❌ Found ${count} orphaned match_rounds records`)
      console.log(`   💡 Migration cleanup should handle this`)
    } else {
      console.log(`   ✅ No orphaned data found`)
    }
  }

  // Check if connection tracking columns exist
  console.log('\n4️⃣ Checking matches table for connection tracking columns...')
  const { data: matchSample, error: mError } = await supabase
    .from('matches')
    .select('id, player1_id, player2_id, player1_connected_at, player2_connected_at')
    .limit(1)

  if (mError) {
    console.log(`   ❌ Error: ${mError.message}`)
  } else if (matchSample && matchSample.length > 0) {
    const match = matchSample[0]
    const hasConnTracking = 'player1_connected_at' in match || 'player2_connected_at' in match
    if (hasConnTracking) {
      console.log(`   ✅ Connection tracking columns exist`)
    } else {
      console.log(`   ⚠️  Connection tracking columns missing (migration not applied yet)`)
    }
  } else {
    console.log(`   ℹ️  No matches found (can't verify columns, but migration can still be applied)`)
  }

  console.log('\n✅ Status check complete!\n')
}

checkMigrationStatus()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error('❌ Error:', error)
    process.exit(1)
  })

