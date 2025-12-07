
import { createClient } from '@supabase/supabase-js';
import fs from 'fs';
import path from 'path';

// Load .env file manually since tsx doesn't do it by default
try {
    const envPath = path.resolve(process.cwd(), '.env');
    if (fs.existsSync(envPath)) {
        const envConfig = fs.readFileSync(envPath, 'utf8');
        const lines = envConfig.split(/\r?\n/);
        console.log(`Read ${lines.length} lines from .env`);
        lines.forEach(line => {
            const trimmed = line.trim();
            if (!trimmed || trimmed.startsWith('#')) return;

            const eqIdx = trimmed.indexOf('=');
            if (eqIdx > 0) {
                const key = trimmed.substring(0, eqIdx).trim();
                let value = trimmed.substring(eqIdx + 1).trim();
                // Remove quotes if present
                if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
                    value = value.slice(1, -1);
                }
                process.env[key] = value;
            }
        });
        console.log('✅ Loaded .env file');
        console.log('Keys found:', Object.keys(process.env).filter(k => k.includes('SUPABASE')));
    }
} catch (e) {
    console.warn('⚠️ Could not load .env file:', e);
}

const SUPABASE_URL = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
    console.error('❌ Missing environment variables:');
    console.error('   VITE_SUPABASE_URL (or SUPABASE_URL)');
    console.error('   SUPABASE_SERVICE_ROLE_KEY');
    process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
    auth: {
        autoRefreshToken: false,
        persistSession: false,
    },
});

const question = {
    // id: 'int_ln_x_over_x3_p3_v1', // Let DB generate UUID
    title: 'Integration by Parts: ln x / x^3',
    subject: 'math',
    chapter: 'Integration P3',
    level: 'A2',
    difficulty: 'hard',
    rank_tier: 'Bronze',
    question_text: 'Evaluate the integral I = ∫ (ln x / x^3) dx for x > 0.',
    total_marks: 4, // 1 mark per step
    topic_tags: ['integration', 'integration by parts', 'logarithms'],
    steps: [
        {
            id: 'step1_method',
            question: 'For the integral I = ∫ (ln x / x^3) dx, which method is the most appropriate to start with?',
            options: [
                'Use the power rule directly on ln x.',
                'Use the substitution u = ln x.',
                'Use integration by parts with ln x as one part.',
                'Use partial fractions.'
            ],
            correctAnswer: 2,
            marks: 1,
            explanation: 'Integration by parts is standard for integrals of the form x^n ln x.'
        },
        {
            id: 'step2_parts_choice',
            question: 'You decide to use integration by parts on I = ∫ ln x · x⁻³ dx. Which choice of u and dv is correct?',
            options: [
                'u = ln x,           dv = x⁻³ dx',
                'u = x⁻³,            dv = ln x dx',
                'u = 1,              dv = ln x · x⁻³ dx',
                'u = ln x · x⁻³,     dv = dx'
            ],
            correctAnswer: 0,
            marks: 1,
            explanation: 'We choose u = ln x because it simplifies when differentiated, and dv = x⁻³ dx is easy to integrate.'
        },
        {
            id: 'step3_ibp_line',
            question: 'With u = ln x and dv = x⁻³ dx, which expression for I is correct after applying the formula I = ∫u dv = uv − ∫v du?',
            options: [
                'I = −(ln x)/(2x²) + (1/2) ∫ x⁻³ dx',
                'I = −(ln x)/(2x²) − (1/2) ∫ x³ dx',
                'I =  (ln x)/(2x²) − (1/2) ∫ x⁻³ dx',
                'I = −(ln x)/(2x²) + ∫ x⁻³ dx'
            ],
            correctAnswer: 0,
            marks: 1,
            explanation: 'v = ∫x⁻³ dx = x⁻²/-2 = -1/(2x²). du = (1/x)dx. So uv - ∫v du = -(ln x)/(2x²) - ∫(-1/(2x²))(1/x)dx = -(ln x)/(2x²) + 1/2 ∫x⁻³ dx.'
        },
        {
            id: 'step4_final_answer',
            question: 'What is the final value of I = ∫ (ln x / x³) dx ?',
            options: [
                'I = (ln x)/(2x²) + 1/(4x²) + C',
                'I = −(ln x)/(2x²) − 1/(4x²) + C',
                'I = −(ln x)/(x²)   − 1/(2x²) + C',
                'I = −(ln x)/(2x²) + 1/(4x²) + C'
            ],
            correctAnswer: 1,
            marks: 1,
            explanation: '∫x⁻³ dx = x⁻²/-2 = -1/(2x²). So the term +1/2 ∫x⁻³ dx becomes +1/2 * (-1/(2x²)) = -1/(4x²). Total: -(ln x)/(2x²) - 1/(4x²) + C.'
        }
    ]
};

async function main() {
    console.log('🗑️  Deleting existing questions...');

    // 1. Delete from match_questions (junction table) if it exists
    // We try to delete, ignoring error if table doesn't exist, but logging other errors
    const { error: matchQError } = await supabase.from('match_questions').delete().neq('question_id', '00000000-0000-0000-0000-000000000000'); // Delete all
    if (matchQError) {
        if (matchQError.code === '42P01') { // undefined_table
            console.log('   (match_questions table does not exist, skipping)');
        } else {
            console.warn('   ⚠️ Error deleting from match_questions (might be empty or permission issue):', matchQError.message);
        }
    } else {
        console.log('   ✓ Cleared match_questions');
    }

    // 2. Delete all questions
    const { error: qError, count } = await supabase.from('questions_v2').delete().neq('id', '00000000-0000-0000-0000-000000000000'); // Delete all
    if (qError) {
        console.error('❌ Error deleting questions:', qError.message);
        process.exit(1);
    }
    console.log(`   ✓ Deleted existing questions`);

    // 3. Insert new question
    console.log('📥 Inserting new question...');
    const { error: insertError } = await supabase.from('questions_v2').insert(question);

    if (insertError) {
        console.error('❌ Error inserting question:', insertError.message);
        process.exit(1);
    }

    console.log('   ✓ Inserted new question');
    console.log('\n🎉 Database reset complete!');
}

main().catch(err => {
    console.error('💥 Fatal error:', err);
    process.exit(1);
});
