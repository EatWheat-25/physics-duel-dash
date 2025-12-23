# Questions System - Production-Ready Implementation

## Overview

The questions system is now fully integrated with Supabase as the **single source of truth**. All questions are stored in the `public.questions` table and used consistently across:

- **Admin Panel** - Create, edit, delete questions with validation
- **Step-Battle Modes** - A1-Only, A2-Only, All-Maths pull from DB
- **Online 1v1 Matchmaking** - WebSocket game uses `pick_next_question_v2` RPC
- **Seed Script** - Production-ready seeding with validation

---

## Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                    QUESTIONS DATA FLOW                      │
└─────────────────────────────────────────────────────────────┘

        Admin UI / Seed Script
                │
                ├─ Validation (src/utils/questionMapper.ts)
                ├─ Type Conversion (DB ↔ App)
                │
                ▼
      Supabase public.questions table
                │
                ├─────────────────┬─────────────────┐
                │                 │                 │
                ▼                 ▼                 ▼
        Step-Battle Modes    Admin List      Online 1v1
        (A1/A2/All-Maths)   (View/Edit)    (WebSocket)
                │                               │
                ▼                               ▼
        getStepMathQuestions()     pick_next_question_v2()
                │                               │
                └───────────┬───────────────────┘
                            │
                            ▼
                   questionMapper
                   (dbRowToQuestion)
                            │
                            ▼
                   StepBasedQuestion
```

---

## Key Files

### 1. Types (Single Source of Truth)
**`src/types/questions.ts`**
- `QuestionStep` - Individual step structure
- `StepBasedQuestion` - Complete question structure
- `QuestionDBRow` - Database row shape (snake_case)
- `QuestionInput` - For creating/updating questions
- `QuestionFilters` - Query filters

**DO NOT create duplicate types elsewhere!**

### 2. Question Mapper (Centralized Conversion)
**`src/utils/questionMapper.ts`**
- `dbRowToQuestion()` - Convert DB row → StepBasedQuestion
- `questionToDBRow()` - Convert StepBasedQuestion → DB row
- `validateQuestion()` - Frontend validation
- `dbRowsToQuestions()` - Batch conversion

### 3. Seed Script (Production-Ready)
**`scripts/seed-questions.ts`**
- Validates all questions before seeding
- Uses stable IDs for idempotent upserts
- Reports success/failure counts
- Comprehensive error messages

### 4. Step-Battle Fetcher
**`src/data/stepMathQuestions.ts`**
- `getStepMathQuestions()` - Flexible query with filters
- `getA1Questions()` - Convenience for A1-Only mode
- `getA2Questions()` - Convenience for A2-Only mode
- `getAllMathsQuestions()` - Mix of A1 + A2

### 5. React Query Hooks
**`src/hooks/useQuestions.tsx`**
- `useQuestions()` - Fetch with filters
- `useAddQuestion()` - Create new question
- `useUpdateQuestion()` - Update existing question
- `useDeleteQuestion()` - Delete question

---

## Database Schema

**Table: `public.questions`**

| Column         | Type      | Description                                    |
|----------------|-----------|------------------------------------------------|
| id             | uuid      | Primary key                                    |
| title          | text      | Short description                              |
| subject        | text      | 'math', 'physics', or 'chemistry'             |
| chapter        | text      | Chapter name                                   |
| level          | text      | 'A1' or 'A2'                                   |
| difficulty     | text      | 'easy', 'medium', or 'hard'                   |
| rank_tier      | text      | 'Bronze', 'Silver', 'Gold', etc. (optional)   |
| question_text  | text      | Full question text                             |
| total_marks    | int       | Total marks (sum of step marks)               |
| topic_tags     | text[]    | Array of tags                                  |
| steps          | jsonb     | Array of QuestionStep objects                  |
| image_url      | text      | Optional image URL                             |
| created_at     | timestamp | Auto-generated                                 |
| updated_at     | timestamp | Auto-updated via trigger                       |

**Indexes:**
- `q_subject_chapter_idx` on (subject, chapter)
- `q_rank_idx` on (rank_tier)
- `q_level_difficulty_idx` on (level, difficulty)

**RLS Policies:**
- Anyone (authenticated) can SELECT questions
- Only admins can INSERT/UPDATE/DELETE questions

---

## How to Use

### 1. Seed Initial Questions

```bash
# Set environment variables
export VITE_SUPABASE_URL="https://your-project.supabase.co"
export SUPABASE_SERVICE_ROLE_KEY="your-service-role-key"

# Run seed script
npm run seed:questions
```

**Output:**
```
🔍 Validating questions...
✓ All 8 questions validated successfully

📤 Seeding questions to Supabase...
   ✓ math-a2-functions-domain-001
   ✓ math-a2-logs-001
   ✓ math-a2-quad-roots-001
   ...

📊 Summary:
   ✓ Success: 8
   ❌ Failed: 0
   📝 Total: 8

🎉 All questions seeded successfully!
```

### 2. Add Questions via Admin UI

1. Navigate to `/admin/questions` (requires admin role)
2. Click "Add Question"
3. Fill in metadata (subject, level, chapter, etc.)
4. Add steps (each with 4 options, correct answer, marks)
5. Submit - validation runs automatically

**Validation Rules:**
- Title, subject, level, difficulty required
- At least 1 step required
- Each step must have exactly 4 options
- `correctAnswer` must be 0, 1, 2, or 3
- `marks` must be positive
- `total_marks` must equal sum of step marks

### 3. Fetch Questions in Step-Battle

```typescript
import { getA1Questions, getA2Questions, getAllMathsQuestions } from '@/data/stepMathQuestions';

// A1-Only mode
const a1Questions = await getA1Questions(5);

// A2-Only mode
const a2Questions = await getA2Questions(5);

// All-Maths mode (mix of A1 and A2)
const allQuestions = await getAllMathsQuestions(6);

// Custom filters
import { getStepMathQuestions } from '@/data/stepMathQuestions';

const questions = await getStepMathQuestions({
  subject: 'math',
  level: 'A2',
  chapter: 'Quadratics',
  difficulty: 'easy',
  limit: 3,
});
```

### 4. Fetch Questions in Admin UI

```typescript
import { useQuestions } from '@/hooks/useQuestions';

function AdminQuestionsList() {
  const { data: questions, isLoading } = useQuestions({
    subject: 'math',
    level: 'A2',
  });

  if (isLoading) return <div>Loading...</div>;

  return (
    <ul>
      {questions?.map(q => (
        <li key={q.id}>{q.title}</li>
      ))}
    </ul>
  );
}
```

### 5. Online 1v1 Matchmaking

Questions are fetched automatically via the `pick_next_question_v2` RPC function in the WebSocket game flow:

**Backend (Supabase Edge Function):**
```typescript
// game-ws WebSocket handler calls:
const { data } = await supabase.rpc('pick_next_question_v2', {
  p_match_id: matchId,
});

// Returns question JSON with steps
```

**Frontend (OnlineBattle component):**
```typescript
// WebSocket event handler
case 'next_question':
  const question = event.question; // Already in StepBasedQuestion format
  setQuestions([...questions, question]);
  break;
```

---

## Testing

### Manual Testing Steps

**1. Test Seed Script**
```bash
npm run seed:questions
# Verify 8 questions inserted successfully
```

**2. Test Admin UI**
- Go to `/admin/questions`
- Create a new question
- Try to submit with missing fields → Should show validation errors
- Try to submit with invalid step data → Should show errors
- Submit valid question → Should succeed
- Edit an existing question → Should succeed
- Delete a question → Should succeed

**3. Test Step-Battle Modes**
- Go to battle mode selector
- Choose "A1-Only" → Should fetch A1 questions from DB
- Choose "A2-Only" → Should fetch A2 questions from DB
- Choose "All-Maths" → Should fetch mix of A1 and A2
- If no questions available → Should show "No questions available" message

**4. Test Online 1v1**
- Queue for a match
- Once matched, WebSocket should fetch questions via `pick_next_question_v2`
- Questions should display correctly with steps
- Answer submission should work
- Score should update correctly

---

## Troubleshooting

### "No questions found for filters"
**Problem:** `getStepMathQuestions()` returns empty array.

**Solutions:**
1. Check if questions exist in DB: `select * from questions where subject = 'math';`
2. Run seed script: `npm run seed:questions`
3. Check filters match question data (e.g., chapter names must match exactly)

### "Validation failed: Step X: Must have exactly 4 options"
**Problem:** Question step has wrong number of options.

**Solution:** Ensure each step has EXACTLY 4 options in the array.

### "Total marks doesn't match sum of step marks"
**Problem:** `total_marks` field doesn't equal the sum of all step marks.

**Solution:** Calculate `total_marks` as: `steps.reduce((sum, s) => sum + s.marks, 0)`

### WebSocket game not fetching questions
**Problem:** `pick_next_question_v2` RPC not working.

**Solutions:**
1. Check migration `20251115044021_questions_mvp_integration.sql` is applied
2. Verify RPC exists: `select * from pg_proc where proname = 'pick_next_question_v2';`
3. Check RLS policies allow authenticated users to read questions
4. Inspect WebSocket logs for errors

---

## Adding New Questions

### Via Seed Script (Bulk)

1. Open `scripts/seed-questions.ts`
2. Add to the `questions` array:

```typescript
{
  id: 'math-a2-trig-001', // Stable, unique ID
  title: 'Solve sin²θ + cos²θ = 1',
  subject: 'math',
  chapter: 'Trigonometry',
  level: 'A2',
  difficulty: 'easy',
  rank_tier: 'Bronze',
  question_text: 'Prove that sin²θ + cos²θ = 1 for all θ',
  total_marks: 2,
  topic_tags: ['trigonometric identities'],
  steps: [
    {
      id: 'step-1',
      question: 'What is the Pythagorean identity?',
      options: ['sin²θ + cos²θ = 1', 'sin²θ - cos²θ = 1', 'tan²θ + 1 = sec²θ', 'None'],
      correctAnswer: 0,
      marks: 1,
      explanation: 'The Pythagorean identity states sin²θ + cos²θ = 1',
    },
    {
      id: 'step-2',
      question: 'Is this true for all θ?',
      options: ['Yes', 'No', 'Only for 0° ≤ θ ≤ 90°', 'Only for special angles'],
      correctAnswer: 0,
      marks: 1,
      explanation: 'This identity holds for ALL real values of θ',
    },
  ],
},
```

3. Run: `npm run seed:questions`

### Via Admin UI (Individual)

1. Go to `/admin/questions`
2. Click "Add Question"
3. Fill in all fields
4. Add steps with 4 options each
5. Submit

---

## Best Practices

1. **Always use stable IDs** - Format: `{subject}-{level}-{topic}-{number}` (e.g., `math-a2-logs-001`)
2. **Validate before seeding** - The seed script does this automatically
3. **Keep questions in DB** - Never hardcode question arrays in the codebase
4. **Use questionMapper** - Always use `dbRowToQuestion()` and `questionToDBRow()` for conversions
5. **Test on staging first** - Test new questions in development before production
6. **Backup before bulk changes** - Export questions table before running mass updates
7. **Use RLS policies** - Ensure only admins can modify questions

---

## Migration from Hardcoded Questions

### Old Approach (Deprecated)
```typescript
// ❌ DON'T DO THIS
const A2_ONLY_QUESTIONS = [
  { id: 'q1', title: '...', steps: [...] },
  { id: 'q2', title: '...', steps: [...] },
];
```

### New Approach (Correct)
```typescript
// ✅ DO THIS
import { getA2Questions } from '@/data/stepMathQuestions';

const questions = await getA2Questions(5);
```

### Migration Steps

1. Copy hardcoded questions to seed script
2. Add stable IDs to each question
3. Run seed script to populate DB
4. Update components to fetch from DB
5. Delete hardcoded arrays
6. Test thoroughly

---

## Future Enhancements

### Short-term
- [ ] Add question difficulty rating system (user votes)
- [ ] Add question usage statistics (how many times used)
- [ ] Add question performance metrics (average score)
- [ ] Bulk import/export via CSV

### Long-term
- [ ] Question versioning system
- [ ] Collaborative question authoring
- [ ] AI-generated question variations
- [ ] Multi-language support
- [x] LaTeX rendering for complex math ✅ (Implemented with KaTeX)

---

## Support

For issues or questions:
1. Check this README first
2. Check Supabase dashboard logs
3. Inspect browser console for errors
4. Review WebSocket logs in game-ws edge function

**Common Issues:**
- Missing env vars → Check `.env` file
- RLS policy errors → Verify user is admin
- Type errors → Ensure using canonical types from `src/types/questions.ts`
- Validation errors → Check question structure matches schema

---

## Summary

The questions system is now **production-ready** with:

✅ Single source of truth (Supabase DB)
✅ Type-safe conversions (questionMapper)
✅ Centralized validation
✅ Production seed script
✅ Admin UI with CRUD
✅ Step-battle integration
✅ Online 1v1 integration
✅ Comprehensive error handling
✅ Clear documentation

**Data Flow:** Admin/Seed → DB → Fetcher → Mapper → UI

All components use the same types and mapper for consistency!
