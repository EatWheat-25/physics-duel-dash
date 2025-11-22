
import { createClient } from '@supabase/supabase-js';

// Hardcoded credentials from .env check
const supabaseUrl = "https://qvunaswogfwhixecjpcn.supabase.co";
const supabaseAnonKey = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InF2dW5hc3dvZ2Z3aGl4ZWNqcGNuIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTc5NDIyNDAsImV4cCI6MjA3MzUxODI0MH0.mNFMhdalJrFdpQNbORIC4FZVRNSHrrTEqx63zVILqlg";

if (!supabaseUrl || !supabaseAnonKey) {
    console.error('Missing VITE_SUPABASE_URL or VITE_SUPABASE_ANON_KEY');
    process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseAnonKey);

const QUESTION_ID = 'a96fed04-acdc-4c7a-91bf-e07034f8a75b';

const NEW_STEPS = [
    {
        id: "step1_method",
        type: "mcq",
        title: "Choose the method",
        timeLimitSeconds: 15,
        question: "For the integral I = ∫ (ln x / x^3) dx, which method is the most appropriate to start with?",
        options: [
            "Use the power rule directly on ln x.",
            "Use the substitution u = ln x.",
            "Use integration by parts with ln x as one part.",
            "Use partial fractions."
        ],
        correctAnswer: 2,
        marks: 1,
        explanation: "Integration by parts is standard for ∫ x^n ln x dx forms."
    },
    {
        id: "step2_parts_choice",
        type: "mcq",
        title: "Choose u and dv",
        timeLimitSeconds: 15,
        question: "You decide to start with integration by parts. How should you choose u and dv for I = ∫ ln x · x⁻³ dx?",
        options: [
            "u = ln x,           dv = x⁻³ dx",
            "u = x⁻³,            dv = ln x dx",
            "u = 1,              dv = ln x · x⁻³ dx",
            "u = ln x · x⁻³,     dv = dx"
        ],
        correctAnswer: 0,
        marks: 1,
        explanation: "Choose u = ln x (Logarithmic) and dv = x^-3 dx (Algebraic) following LIATE."
    },
    {
        id: "step3_ibp_line",
        type: "mcq",
        title: "Next working step",
        timeLimitSeconds: 15,
        question: "After choosing u = ln x and dv = x⁻³ dx, what is the correct expression for I after applying the formula I = ∫u dv = uv − ∫v du?",
        options: [
            "I = −(ln x)/(2x²) + (1/2) ∫ x⁻³ dx",
            "I = −(ln x)/(2x²) − (1/2) ∫ x³ dx",
            "I =  (ln x)/(2x²) − (1/2) ∫ x⁻³ dx",
            "I = −(ln x)/(2x²) + ∫ x⁻³ dx"
        ],
        correctAnswer: 0,
        marks: 1,
        explanation: "v = -1/(2x^2), du = 1/x dx. So uv - ∫v du = -(ln x)/(2x^2) - ∫(-1/(2x^2))(1/x)dx = -(ln x)/(2x^2) + 1/2 ∫x^-3 dx."
    },
    {
        id: "step4_final_answer",
        type: "mcq",
        title: "Final answer",
        timeLimitSeconds: 15,
        question: "What is the final value of I = ∫ (ln x / x³) dx ?",
        options: [
            "I = (ln x)/(2x²) + 1/(4x²) + C",
            "I = −(ln x)/(2x²) − 1/(4x²) + C",
            "I = −(ln x)/(x²)   − 1/(2x²) + C",
            "I = −(ln x)/(2x²) + 1/(4x²) + C"
        ],
        correctAnswer: 1,
        marks: 1,
        explanation: "Integrate +1/2 x^-3 to get -1/(4x^2). Combine terms."
    }
];

async function updateQuestion() {
    console.log(`Updating question ${QUESTION_ID}...`);

    const { data, error } = await supabase
        .from('questions')
        .update({ steps: NEW_STEPS })
        .eq('id', QUESTION_ID)
        .select();

    if (error) {
        console.error('Error updating question:', error);
    } else {
        console.log('Success! Updated question:', data);
    }
}

updateQuestion();
