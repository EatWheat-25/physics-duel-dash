
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = "https://qvunaswogfwhixecjpcn.supabase.co";
const supabaseServiceKey = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InF2dW5hc3dvZ2Z3aGl4ZWNqcGNuIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc1Nzk0MjI0MCwiZXhwIjoyMDczNTE4MjQwfQ.fake_key_placeholder";
// WAIT, I shouldn't use the ANON key for seeding if I need to write to tables that might be protected?
// The previous script used ANON key.
// "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InF2dW5hc3dvZ2Z3aGl4ZWNqcGNuIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTc5NDIyNDAsImV4cCI6MjA3MzUxODI0MH0.mNFMhdalJrFdpQNbORIC4FZVRNSHrrTEqx63zVILqlg"
// This is the ANON key.
// If RLS allows anon to write (unlikely for questions), I need SERVICE_ROLE key.
// The user's previous script used ANON key. Maybe RLS is open or it's just for testing?
// Or maybe the user didn't provide the service key.
// I'll check the previous script content again.
// It used `supabaseAnonKey`.
// I'll use the same key. If it fails, I'll tell the user.

const supabaseKey = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InF2dW5hc3dvZ2Z3aGl4ZWNqcGNuIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc1Nzk0MjI0MCwiZXhwIjoyMDczNTE4MjQwfQ.AkDsAqKERcAdiH5n4HI6iwpSBiYYsX6uNxd-z7X4WPs";

const supabase = createClient(supabaseUrl, supabaseKey);

const QUESTIONS = [
    {
        id: 'a96fed04-acdc-4c7a-91bf-e07034f8a75b',
        title: 'Integration by Parts: ln x / x^3',
        subject: 'math',
        chapter: 'Integration P3',
        level: 'A2',
        difficulty: 'hard',
        question_text: 'Find the integral of ln(x) / x^3 with respect to x.',
        total_marks: 8,
        rank_tier: 'Silver',
        topic_tags: ['integration', 'calculus', 'by-parts'],
        steps: [
            {
                step_index: 0,
                step_type: 'mcq',
                title: 'Choose the method',
                prompt: 'For the integral I = ∫ (ln x / x^3) dx, which method is the most appropriate to start with?',
                options: [
                    "Use the power rule directly on ln x.",
                    "Use the substitution u = ln x.",
                    "Use integration by parts with ln x as one part.",
                    "Use partial fractions."
                ],
                correct_answer: { correctIndex: 2 },
                marks: 2,
                time_limit_seconds: 15
            },
            {
                step_index: 1,
                step_type: 'mcq',
                title: 'Choose u and dv',
                prompt: 'You decide to start with integration by parts. How should you choose u and dv for I = ∫ ln x · x⁻³ dx?',
                options: [
                    "u = ln x,           dv = x⁻³ dx",
                    "u = x⁻³,            dv = ln x dx",
                    "u = 1,              dv = ln x · x⁻³ dx",
                    "u = ln x · x⁻³,     dv = dx"
                ],
                correct_answer: { correctIndex: 0 },
                marks: 2,
                time_limit_seconds: 15
            },
            {
                step_index: 2,
                step_type: 'mcq',
                title: 'Next working step',
                prompt: 'After choosing u = ln x and dv = x⁻³ dx, what is the correct expression for I after applying the formula I = ∫u dv = uv − ∫v du?',
                options: [
                    "I = −(ln x)/(2x²) + (1/2) ∫ x⁻³ dx",
                    "I = −(ln x)/(2x²) − (1/2) ∫ x³ dx",
                    "I =  (ln x)/(2x²) − (1/2) ∫ x⁻³ dx",
                    "I = −(ln x)/(2x²) + ∫ x⁻³ dx"
                ],
                correct_answer: { correctIndex: 0 },
                marks: 2,
                time_limit_seconds: 15
            },
            {
                step_index: 3,
                step_type: 'mcq',
                title: 'Final answer',
                prompt: 'What is the final value of I = ∫ (ln x / x³) dx ?',
                options: [
                    "I = (ln x)/(2x²) + 1/(4x²) + C",
                    "I = −(ln x)/(2x²) − 1/(4x²) + C",
                    "I = −(ln x)/(x²)   − 1/(2x²) + C",
                    "I = −(ln x)/(2x²) + 1/(4x²) + C"
                ],
                correct_answer: { correctIndex: 1 },
                marks: 2,
                time_limit_seconds: 15
            }
        ]
    },
    {
        id: 'b22fed04-acdc-4c7a-91bf-e07034f8a75c',
        title: 'Derivative of sin(x)',
        subject: 'math',
        chapter: 'Differentiation P1',
        level: 'AS',
        difficulty: 'easy',
        question_text: 'What is the derivative of sin(x)?',
        total_marks: 2,
        rank_tier: 'Bronze',
        topic_tags: ['differentiation', 'trigonometry'],
        steps: [
            {
                step_index: 0,
                step_type: 'mcq',
                title: 'Derivative',
                prompt: 'What is d/dx(sin(x))?',
                options: [
                    "cos(x)",
                    "-cos(x)",
                    "sin(x)",
                    "-sin(x)"
                ],
                correct_answer: { correctIndex: 0 },
                marks: 2,
                time_limit_seconds: 15
            }
        ]
    }
];

async function seed() {
    console.log('Seeding questions...');

    for (const q of QUESTIONS) {
        console.log(`Processing question: ${q.title}`);

        // 1. Upsert Question
        const { error: qError } = await supabase
            .from('questions_v2')
            .upsert({
                id: q.id,
                title: q.title,
                subject: q.subject,
                chapter: q.chapter,
                level: q.level,
                difficulty: q.difficulty,
                question_text: q.question_text,
                total_marks: q.total_marks,
                rank_tier: q.rank_tier,
                topic_tags: q.topic_tags,
            });

        if (qError) {
            console.error('Error upserting question:', qError);
            continue;
        }

        // 2. Delete existing steps
        const { error: delError } = await supabase
            .from('question_steps')
            .delete()
            .eq('question_id', q.id);

        if (delError) {
            console.error('Error deleting old steps:', delError);
        }

        // 3. Insert new steps
        const stepsToInsert = q.steps.map(s => ({
            question_id: q.id,
            step_index: s.step_index,
            step_type: s.step_type,
            title: s.title,
            prompt: s.prompt,
            options: s.options,
            correct_answer: s.correct_answer,
            marks: s.marks,
            time_limit_seconds: s.time_limit_seconds
        }));

        const { error: stepsError } = await supabase
            .from('question_steps')
            .insert(stepsToInsert);

        if (stepsError) {
            console.error('Error inserting steps:', stepsError);
        } else {
            console.log(`Inserted ${stepsToInsert.length} steps for ${q.title}`);
        }
    }

    console.log('Seeding complete.');
}

seed();
