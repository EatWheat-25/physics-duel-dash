/**
 * Seed 4-Step Integration Question to questions_v2
 * 
 * This script adds a proper 4-step question that will be visible in the admin panel.
 * The question tests integration by parts with multiple steps.
 */

import { createClient } from '@supabase/supabase-js';
import fs from 'fs';
import path from 'path';

// Load .env file manually
try {
    const envPath = path.resolve(process.cwd(), '.env');
    if (fs.existsSync(envPath)) {
        const envConfig = fs.readFileSync(envPath, 'utf8');
        const lines = envConfig.split(/\r?\n/);
        lines.forEach(line => {
            const trimmed = line.trim();
            if (!trimmed || trimmed.startsWith('#')) return;

            const eqIdx = trimmed.indexOf('=');
            if (eqIdx > 0) {
                const key = trimmed.substring(0, eqIdx).trim();
                let value = trimmed.substring(eqIdx + 1).trim();
                if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
                    value = value.slice(1, -1);
                }
                process.env[key] = value;
            }
        });
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
    title: 'Integration by Parts: ln x / x^3',
    subject: 'math',
    chapter: 'Integration by Parts',
    level: 'A2',
    difficulty: 'hard',
    rank_tier: 'Silver',
    stem: 'Evaluate the integral I = ∫ (ln x / x³) dx for x > 0 using integration by parts.',
    total_marks: 4,
    topic_tags: ['integration', 'calculus', 'by-parts'],
    steps: [
        {
            id: 'ibp-lnx/x3-step-1',
            index: 0,
            type: 'mcq',
            title: 'Step 1: Choose u and dv',
            prompt: 'For ∫ ln(x) / x^3 dx, which choice of u and dv/dx is most suitable for integration by parts?',
            options: [
                'u = 1/x^3, dv/dx = ln x',
                'u = ln x, dv/dx = x^(-3)',
                'u = x^(-3), dv/dx = ln x',
                'u = ln x, dv/dx = 1/x^2'
            ],
            correct_answer: { correctIndex: 1 },
            marks: 1,
            time_limit_seconds: 15,
            explanation: 'Take u = ln x (easy to differentiate) and dv/dx = x^(-3) (easy to integrate).'
        },
        {
            id: 'ibp-lnx/x3-step-2',
            index: 1,
            type: 'mcq',
            title: 'Step 2: Compute du and v',
            prompt: 'Given u = ln x and dv/dx = x^(-3), what are du/dx and v?',
            options: [
                'du/dx = 1/x, v = -1/(2x^2)',
                'du/dx = 1/x^2, v = -1/(2x^2)',
                'du/dx = 1/x, v = 1/(2x^2)',
                'du/dx = 1/x^2, v = 1/(2x^2)'
            ],
            correct_answer: { correctIndex: 0 },
            marks: 1,
            time_limit_seconds: 15,
            explanation: 'du/dx = 1/x and ∫ x^(-3) dx = x^(-2)/(-2) = -1/(2x^2).'
        },
        {
            id: 'ibp-lnx/x3-step-3',
            index: 2,
            type: 'mcq',
            title: 'Step 3: Apply IBP formula',
            prompt: 'Using ∫u dv = uv − ∫v du, which expression is correct for ∫ ln(x) / x^3 dx?',
            options: [
                '∫ ln(x) / x^3 dx = -ln x/(2x^2) + ∫ 1/(2x^3) dx',
                '∫ ln(x) / x^3 dx = -ln x/(2x^2) − ∫ 1/(2x^3) dx',
                '∫ ln(x) / x^3 dx = ln x/(2x^2) − ∫ 1/(2x^3) dx',
                '∫ ln(x) / x^3 dx = ln x/(2x^2) + ∫ 1/(2x^3) dx'
            ],
            correct_answer: { correctIndex: 1 },
            marks: 1,
            time_limit_seconds: 15,
            explanation: 'uv = ln x · (−1/(2x^2)); v du = (−1/(2x^2))·(1/x) = −1/(2x^3), so the integral is uv − ∫vdu = −ln x/(2x^2) − ∫ 1/(2x^3) dx.'
        },
        {
            id: 'ibp-lnx/x3-step-4',
            index: 3,
            type: 'mcq',
            title: 'Step 4: Final answer',
            prompt: 'Evaluate the remaining integral and simplify. Which is the correct antiderivative?',
            options: [
                '−ln x/(2x^2) + 1/(4x^2) + C',
                '−ln x/(2x^2) − 1/(4x^2) + C',
                'ln x/(2x^2) − 1/(4x^2) + C',
                'ln x/(2x^2) + 1/(4x^2) + C'
            ],
            correct_answer: { correctIndex: 1 },
            marks: 1,
            time_limit_seconds: 15,
            explanation: '∫ 1/(2x^3) dx = 1/2 · x^(−2)/(-2) = −1/(4x^2), so the result is −ln x/(2x^2) − 1/(4x^2) + C.'
        }
    ]
};

async function seed() {
    console.log('🌱 Seeding 4-step Integration question to questions_v2...\n');

    try {
        // Check if question already exists
        const { data: existing } = await supabase
            .from('questions_v2')
            .select('id')
            .eq('title', question.title)
            .maybeSingle();

        if (existing) {
            console.log('📝 Question already exists, updating...');
            const { error: updateError } = await supabase
                .from('questions_v2')
                .update({
                    ...question,
                    updated_at: new Date().toISOString()
                })
                .eq('id', existing.id);

            if (updateError) {
                console.error('❌ Error updating question:', updateError);
                process.exit(1);
            }

            console.log('✅ Question updated successfully!');
            console.log(`   ID: ${existing.id}`);
            console.log(`   Title: ${question.title}`);
            console.log(`   Steps: ${question.steps.length}`);
        } else {
            console.log('📥 Inserting new question...');
            const { data: inserted, error: insertError } = await supabase
                .from('questions_v2')
                .insert(question)
                .select('id')
                .single();

            if (insertError) {
                console.error('❌ Error inserting question:', insertError);
                process.exit(1);
            }

            console.log('✅ Question inserted successfully!');
            console.log(`   ID: ${inserted.id}`);
            console.log(`   Title: ${question.title}`);
            console.log(`   Steps: ${question.steps.length}`);
        }

        console.log('\n🎉 4-step question is now in the database!');
        console.log('   You can view it in the Admin Panel at /admin/questions');
        console.log('   Filter by: math / A2 / hard / Silver');

    } catch (error: any) {
        console.error('💥 Fatal error:', error);
        process.exit(1);
    }
}

seed();

