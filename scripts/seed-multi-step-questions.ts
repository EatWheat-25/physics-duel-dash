/**
 * Seed Multi-Step Questions
 *
 * This script seeds high-quality multi-step math questions into the database.
 * Each question tests a complete problem-solving workflow across multiple steps.
 */

import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_ANON_KEY

if (!supabaseUrl || !supabaseKey) {
  console.error('❌ Missing environment variables')
  console.error('   Required: VITE_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY')
  process.exit(1)
}

const supabase = createClient(supabaseUrl, supabaseKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false
  }
})

interface QuestionStep {
  step_index: number
  step_type: string
  title: string
  prompt: string
  options: string[]
  correct_answer: { correctIndex: number }
  time_limit_seconds: number | null
  marks: number
  explanation: string | null
}

interface Question {
  id: string
  title: string
  subject: string
  chapter: string
  level: string
  difficulty: string
  rank_tier: string
  question_text: string
  total_marks: number
  topic_tags: string[]
  steps: QuestionStep[]
}

const questions: Question[] = [
  {
    id: '550e8400-e29b-41d4-a716-446655440001',
    title: 'Integration by Parts: ∫ ln(x)/x³ dx',
    subject: 'math',
    chapter: 'Integration',
    level: 'A2',
    difficulty: 'hard',
    rank_tier: 'Gold',
    question_text: 'Find the integral of ln(x) / x³ with respect to x using integration by parts.',
    total_marks: 8,
    topic_tags: ['integration', 'calculus', 'by-parts'],
    steps: [
      {
        step_index: 0,
        step_type: 'mcq',
        title: 'Choose u and dv/dx',
        prompt: 'Which choice of u and dv/dx is most suitable for integration by parts?',
        options: [
          'u = 1/x³, dv/dx = ln(x)',
          'u = ln(x), dv/dx = x⁻³',
          'u = x⁻³, dv/dx = ln(x)',
          'u = ln(x), dv/dx = 1/x²'
        ],
        correct_answer: { correctIndex: 1 },
        time_limit_seconds: 60,
        marks: 2,
        explanation: 'Choose u = ln(x) because it simplifies when differentiated, and dv/dx = x⁻³ because it can be easily integrated.'
      },
      {
        step_index: 1,
        step_type: 'mcq',
        title: 'Find du/dx and v',
        prompt: 'Calculate du/dx and v based on your choice.',
        options: [
          'du/dx = 1/x, v = -1/(2x²)',
          'du/dx = 1/x, v = -2/x²',
          'du/dx = x, v = -1/(2x²)',
          'du/dx = 1/x, v = 1/(2x²)'
        ],
        correct_answer: { correctIndex: 0 },
        time_limit_seconds: 60,
        marks: 2,
        explanation: 'du/dx = 1/x (derivative of ln(x)) and v = -1/(2x²) (integral of x⁻³ = -x⁻²/2)'
      },
      {
        step_index: 2,
        step_type: 'mcq',
        title: 'Apply the Formula',
        prompt: 'Substitute into the formula: uv - ∫ v(du/dx) dx',
        options: [
          '-ln(x)/(2x²) - ∫ -1/(2x³) dx',
          '-ln(x)/(2x²) - ∫ 1/(2x³) dx',
          '-ln(x)/x² - ∫ -1/(2x³) dx',
          'ln(x)/(2x²) - ∫ -1/(2x³) dx'
        ],
        correct_answer: { correctIndex: 0 },
        time_limit_seconds: 60,
        marks: 2,
        explanation: 'uv = ln(x) × (-1/(2x²)) = -ln(x)/(2x²), and v(du/dx) = (-1/(2x²)) × (1/x) = -1/(2x³)'
      },
      {
        step_index: 3,
        step_type: 'mcq',
        title: 'Final Answer',
        prompt: 'Evaluate the remaining integral and simplify.',
        options: [
          '-ln(x)/(2x²) - 1/(4x²) + C',
          '-ln(x)/(2x²) + 1/(4x²) + C',
          '-ln(x)/(2x²) - 1/(2x²) + C',
          '-ln(x)/(2x²) + 1/(2x²) + C'
        ],
        correct_answer: { correctIndex: 0 },
        time_limit_seconds: 60,
        marks: 2,
        explanation: '∫ -1/(2x³) dx = -1/2 × (-x⁻²/2) = 1/(4x²). Final answer: -ln(x)/(2x²) - 1/(4x²) + C'
      }
    ]
  },
  {
    id: '550e8400-e29b-41d4-a716-446655440002',
    title: 'Quadratic Equation: Solve x² - 5x + 6 = 0',
    subject: 'math',
    chapter: 'Algebra',
    level: 'A1',
    difficulty: 'easy',
    rank_tier: 'Bronze',
    question_text: 'Solve the quadratic equation x² - 5x + 6 = 0',
    total_marks: 6,
    topic_tags: ['algebra', 'quadratic', 'factoring'],
    steps: [
      {
        step_index: 0,
        step_type: 'mcq',
        title: 'Identify Coefficients',
        prompt: 'What are the values of a, b, and c in ax² + bx + c = 0?',
        options: [
          'a=1, b=-5, c=6',
          'a=1, b=5, c=6',
          'a=-1, b=-5, c=6',
          'a=1, b=-5, c=-6'
        ],
        correct_answer: { correctIndex: 0 },
        time_limit_seconds: 30,
        marks: 2,
        explanation: 'In x² - 5x + 6 = 0, a=1 (coefficient of x²), b=-5 (coefficient of x), c=6 (constant)'
      },
      {
        step_index: 1,
        step_type: 'mcq',
        title: 'Factor the Quadratic',
        prompt: 'Which factorization is correct?',
        options: [
          '(x - 2)(x - 3) = 0',
          '(x + 2)(x + 3) = 0',
          '(x - 1)(x - 6) = 0',
          '(x + 1)(x + 6) = 0'
        ],
        correct_answer: { correctIndex: 0 },
        time_limit_seconds: 45,
        marks: 2,
        explanation: 'We need two numbers that multiply to 6 and add to -5: -2 and -3. So (x-2)(x-3)=0'
      },
      {
        step_index: 2,
        step_type: 'mcq',
        title: 'Find Solutions',
        prompt: 'What are the solutions to the equation?',
        options: [
          'x = 2 or x = 3',
          'x = -2 or x = -3',
          'x = 1 or x = 6',
          'x = -1 or x = -6'
        ],
        correct_answer: { correctIndex: 0 },
        time_limit_seconds: 30,
        marks: 2,
        explanation: 'From (x-2)(x-3)=0, either x-2=0 giving x=2, or x-3=0 giving x=3'
      }
    ]
  },
  {
    id: '550e8400-e29b-41d4-a716-446655440003',
    title: 'Differentiation: Chain Rule with e^(2x)',
    subject: 'math',
    chapter: 'Differentiation',
    level: 'A2',
    difficulty: 'medium',
    rank_tier: 'Silver',
    question_text: 'Find the derivative of y = e^(2x) × sin(x)',
    total_marks: 6,
    topic_tags: ['differentiation', 'chain-rule', 'product-rule'],
    steps: [
      {
        step_index: 0,
        step_type: 'mcq',
        title: 'Identify the Rule',
        prompt: 'Which differentiation rule(s) do we need to use?',
        options: [
          'Product rule only',
          'Chain rule only',
          'Product rule and chain rule',
          'Quotient rule'
        ],
        correct_answer: { correctIndex: 2 },
        time_limit_seconds: 45,
        marks: 2,
        explanation: 'We have a product of two functions (e^(2x) and sin(x)), and e^(2x) requires the chain rule'
      },
      {
        step_index: 1,
        step_type: 'mcq',
        title: 'Apply Product Rule',
        prompt: 'Using product rule d(uv)/dx = u(dv/dx) + v(du/dx), what is du/dx where u = e^(2x)?',
        options: [
          '2e^(2x)',
          'e^(2x)',
          '2e^x',
          'e^(2x)/2'
        ],
        correct_answer: { correctIndex: 0 },
        time_limit_seconds: 45,
        marks: 2,
        explanation: 'Using chain rule: d/dx[e^(2x)] = e^(2x) × d/dx[2x] = e^(2x) × 2 = 2e^(2x)'
      },
      {
        step_index: 2,
        step_type: 'mcq',
        title: 'Complete the Derivative',
        prompt: 'What is dy/dx = ?',
        options: [
          '2e^(2x)sin(x) + e^(2x)cos(x)',
          'e^(2x)sin(x) + 2e^(2x)cos(x)',
          '2e^(2x)cos(x) + e^(2x)sin(x)',
          'e^(2x)(2sin(x) - cos(x))'
        ],
        correct_answer: { correctIndex: 0 },
        time_limit_seconds: 60,
        marks: 2,
        explanation: 'dy/dx = u(dv/dx) + v(du/dx) = e^(2x)×cos(x) + sin(x)×2e^(2x) = 2e^(2x)sin(x) + e^(2x)cos(x)'
      }
    ]
  }
]

async function seedQuestions() {
  console.log('🌱 Starting multi-step questions seed...\n')

  for (const question of questions) {
    try {
      console.log(`📝 Seeding: ${question.title}`)

      // Insert main question
      const { data: existingQuestion } = await supabase
        .from('questions_v2')
        .select('id')
        .eq('id', question.id)
        .single()

      if (existingQuestion) {
        console.log(`   ⚠️  Question already exists, updating...`)
        const { error: updateError } = await supabase
          .from('questions_v2')
          .update({
            title: question.title,
            subject: question.subject,
            chapter: question.chapter,
            level: question.level,
            difficulty: question.difficulty,
            rank_tier: question.rank_tier,
            question_text: question.question_text,
            total_marks: question.total_marks,
            topic_tags: question.topic_tags,
          })
          .eq('id', question.id)

        if (updateError) throw updateError
      } else {
        const { error: insertError } = await supabase
          .from('questions_v2')
          .insert({
            id: question.id,
            title: question.title,
            subject: question.subject,
            chapter: question.chapter,
            level: question.level,
            difficulty: question.difficulty,
            rank_tier: question.rank_tier,
            question_text: question.question_text,
            total_marks: question.total_marks,
            topic_tags: question.topic_tags,
            steps: []
          })

        if (insertError) throw insertError
      }

      // Delete existing steps
      const { error: deleteError } = await supabase
        .from('question_steps')
        .delete()
        .eq('question_id', question.id)

      if (deleteError && deleteError.code !== 'PGRST116') {
        throw deleteError
      }

      // Insert steps
      for (const step of question.steps) {
        const { error: stepError } = await supabase
          .from('question_steps')
          .insert({
            question_id: question.id,
            step_index: step.step_index,
            step_type: step.step_type,
            title: step.title,
            prompt: step.prompt,
            options: step.options,
            correct_answer: step.correct_answer,
            time_limit_seconds: step.time_limit_seconds,
            marks: step.marks,
            explanation: step.explanation
          })

        if (stepError) throw stepError
      }

      console.log(`   ✅ Success (${question.steps.length} steps)\n`)
    } catch (error) {
      console.error(`   ❌ Error seeding ${question.title}:`, error)
      throw error
    }
  }

  console.log('✨ Seed complete!\n')
  console.log(`📊 Summary:`)
  console.log(`   - ${questions.length} questions seeded`)
  console.log(`   - ${questions.reduce((sum, q) => sum + q.steps.length, 0)} total steps`)
  console.log(`   - ${questions.reduce((sum, q) => sum + q.total_marks, 0)} total marks available`)
}

seedQuestions()
  .then(() => {
    console.log('\n✅ All done!')
    process.exit(0)
  })
  .catch((error) => {
    console.error('\n❌ Seed failed:', error)
    process.exit(1)
  })
