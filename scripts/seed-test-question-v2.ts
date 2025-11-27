/**
 * Seed ONE test question into questions_v2
 * This verifies the table schema matches our contract
 */

import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
import { resolve } from 'path';

// Load environment variables
import { fileURLToPath } from 'url';
import { dirname } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

dotenv.config({ path: resolve(__dirname, '../.env') });

const supabase = createClient(
    process.env.VITE_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
);

const testQuestion = {
    title: 'Integration by Parts: ln(x)/x³',
    subject: 'math',
    chapter: 'Integration',
    level: 'A2',
    difficulty: 'medium',
    rank_tier: 'Silver',
    stem: 'Find the integral of ln(x)/x³ using integration by parts.',
    total_marks: 4,
    topic_tags: ['integration', 'by-parts', 'logarithms'],
    steps: [
        {
            id: 'step-1',
            index: 0,
            type: 'mcq',
            title: 'Choose u for substitution',
            prompt: 'In integration by parts (∫u dv = uv - ∫v du), which should be u?',
            options: ['ln(x)', 'x³', '1/x³', 'x'],
            correctAnswer: 0,
            timeLimitSeconds: 30,
            marks: 1,
            explanation: 'ln(x) simplifies when differentiated, making it the better choice for u. du = 1/x dx'
        },
        {
            id: 'step-2',
            index: 1,
            type: 'mcq',
            title: 'Identify dv',
            prompt: 'What is dv in this case?',
            options: ['ln(x) dx', 'x³ dx', '1/x³ dx', 'dx'],
            correctAnswer: 2,
            timeLimitSeconds: 30,
            marks: 1,
            explanation: 'Since u = ln(x), then dv must be 1/x³ dx (the remaining part of the integrand)'
        },
        {
            id: 'step-3',
            index: 2,
            type: 'mcq',
            title: 'Find v',
            prompt: 'What is v = ∫dv = ∫1/x³ dx?',
            options: ['-1/(2x²)', '1/(2x²)', '-1/x²', '1/x²'],
            correctAnswer: 0,
            timeLimitSeconds: 45,
            marks: 1,
            explanation: '∫x⁻³ dx = x⁻²/(-2) = -1/(2x²). You can verify this by differentiating.'
        },
        {
            id: 'step-4',
            index: 3,
            type: 'mcq',
            title: 'Final answer',
            prompt: 'What is the final result after applying ∫u dv = uv - ∫v du?',
            options: [
                '-ln(x)/(2x²) - 1/(2x²) + C',
                '-ln(x)/(2x²) + 1/(2x²) + C',
                'ln(x)/(2x²) - 1/(2x²) + C',
                'ln(x)/(2x²) + 1/(2x²) + C'
            ],
            correctAnswer: 0,
            timeLimitSeconds: 60,
            marks: 1,
            explanation: 'uv = ln(x)·(-1/(2x²)) = -ln(x)/(2x²). Then ∫v du = ∫(-1/(2x²))·(1/x)dx = -1/(2x²). Final: -ln(x)/(2x²) - 1/(2x²) + C'
        }
    ],
    image_url: null
};

async function seed() {
    console.log('🌱 Seeding test question to questions_v2...');

    // First, check if table exists
    const { data: existingQuestion, error: selectError } = await supabase
        .from('questions_v2')
        .select('id')
        .limit(1);

    if (selectError) {
        console.error('❌ Error: questions_v2 table may not exist yet');
        console.error('Run migration first: supabase db push');
        console.error('Error details:', selectError);
        process.exit(1);
    }

    // Delete existing test questions
    console.log('🧹 Cleaning existing questions...');
    await supabase.from('questions_v2').delete().neq('id', '00000000-0000-0000-0000-000000000000');

    // Insert test question
    console.log('📝 Inserting test question...');
    const { data, error } = await supabase
        .from('questions_v2')
        .insert([testQuestion])
        .select();

    if (error) {
        console.error('❌ Failed to insert question');
        console.error('Error:', error);
        process.exit(1);
    }

    console.log('✅ Success! Seeded question:');
    console.log(`   ID: ${data[0].id}`);
    console.log(`   Title: ${data[0].title}`);
    console.log(`   Steps: ${data[0].steps.length}`);
    console.log('');
    console.log('🔍 Verify at: http://localhost:8080/dev/db-test');
}

seed().catch(console.error);
