
import { createClient } from '@supabase/supabase-js';
import * as fs from 'fs';
import * as path from 'path';

const envPath = path.resolve(process.cwd(), '.env');
let supabaseUrl = '';
let supabaseKey = '';

if (fs.existsSync(envPath)) {
    const envConfig = fs.readFileSync(envPath, 'utf-8');
    envConfig.split('\n').forEach(line => {
        const [key, value] = line.split('=');
        if (key && value) {
            if (key.trim() === 'VITE_SUPABASE_URL') supabaseUrl = value.trim();
            if (key.trim() === 'VITE_SUPABASE_ANON_KEY') supabaseKey = value.trim();
        }
    });
}

if (!supabaseUrl || !supabaseKey) {
    console.error('Missing Supabase credentials in .env');
    process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function checkQuestion() {
    console.log('Checking for question: "Integration by Parts: ln x / x^3"');

    const { data, error } = await supabase
        .from('questions_v2')
        .select('*')
        .ilike('title', '%Integration by Parts: ln x / x^3%')
        .maybeSingle();

    if (error) {
        console.error('Error fetching question:', error);
        return;
    }

    if (!data) {
        console.log('Question not found!');
        return;
    }

    console.log('Question found:', data.title);
    console.log('ID:', data.id);
    console.log('Steps:', JSON.stringify(data.steps, null, 2));

    if (Array.isArray(data.steps)) {
        console.log('Number of steps:', data.steps.length);
    } else {
        console.log('Steps is not an array');
    }
}

checkQuestion();
