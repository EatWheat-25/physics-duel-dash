
import { createClient } from '@supabase/supabase-js'
import * as dotenv from 'dotenv'

dotenv.config()

const SUPABASE_URL = process.env.SUPABASE_URL
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY

if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
    console.error("Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY");
    process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

const question = {
    title: "Integration by Parts – Choose u Correctly",
    subject: "math",
    chapter: "Integration",
    level: "A2",
    difficulty: "medium",
    rank_tier: "gold",
    stem: "We want to evaluate the integral ∫ ln(x) / x³ dx using integration by parts (∫u dv = uv − ∫v du). Answer the following steps in order.",
    total_marks: 5,
    topic_tags: ['integration', 'by-parts', 'ln(x)/x^3'],
    steps: [
        {
            id: "step_0",
            index: 0,
            type: "mcq",
            title: "Step 1: Choose u",
            prompt: "In integration by parts (∫u dv = uv − ∫v du), which part should be u?",
            options: [
                "u = ln(x)",
                "u = x³",
                "u = 1/x³",
                "u = x"
            ],
            correctAnswer: 0,
            timeLimitSeconds: 15,
            marks: 1,
            explanation: "We follow LIATE rule. Logarithmic functions (L) come before Algebraic (A). So u = ln(x)."
        },
        {
            id: "step_1",
            index: 1,
            type: "mcq",
            title: "Step 2: Choose dv",
            prompt: "Given your choice of u, which expression should be dv?",
            options: [
                "dv = ln(x) dx",
                "dv = x³ dx",
                "dv = x⁻³ dx",
                "dv = (1/x) dx"
            ],
            correctAnswer: 2,
            timeLimitSeconds: 15,
            marks: 1,
            explanation: "If u = ln(x), then everything else is dv. So dv = (1/x³) dx = x⁻³ dx."
        },
        {
            id: "step_2",
            index: 2,
            type: "mcq",
            title: "Step 3: Compute du",
            prompt: "If u = ln(x), what is du?",
            options: [
                "du = dx",
                "du = (1/x) dx",
                "du = x dx",
                "du = x³ dx"
            ],
            correctAnswer: 1,
            timeLimitSeconds: 15,
            marks: 1,
            explanation: "The derivative of ln(x) is 1/x. So du = (1/x) dx."
        },
        {
            id: "step_3",
            index: 3,
            type: "mcq",
            title: "Step 4: Compute v",
            prompt: "If dv = x⁻³ dx, what is v?",
            options: [
                "v = -1/(2x²)",
                "v = -1/(3x²)",
                "v = -1/(2x³)",
                "v = -1/(3x³)"
            ],
            correctAnswer: 0,
            timeLimitSeconds: 15,
            marks: 1,
            explanation: "Integrate x⁻³: (x⁻²)/(-2) = -1/(2x²)."
        },
        {
            id: "step_4",
            index: 4,
            type: "mcq",
            title: "Step 5: Write the IBP setup",
            prompt: "Which of the following correctly sets up ∫ ln(x)/x³ dx using integration by parts with your u and v?",
            options: [
                "uv - ∫v du = ln(x)(-1/2x²) - ∫(-1/2x²)(1/x) dx",
                "uv - ∫v du = ln(x)(1/2x²) - ∫(1/2x²)(1/x) dx",
                "uv - ∫v du = ln(x)(-1/3x³) - ∫(-1/3x³)(1/x) dx",
                "uv - ∫v du = ln(x)(x⁻³) - ∫(x⁻³)(1/x) dx"
            ],
            correctAnswer: 0,
            timeLimitSeconds: 15,
            marks: 1,
            explanation: "Apply formula uv - ∫v du."
        }
    ]
};

async function seed() {
    console.log("Seeding Integration by Parts question...");

    // Check if it exists to avoid duplicates
    const { data: existing } = await supabase
        .from('questions_v2')
        .select('id')
        .eq('title', question.title)
        .single();

    if (existing) {
        console.log("Question already exists, updating...");
        const { error } = await supabase
            .from('questions_v2')
            .update(question)
            .eq('id', existing.id);

        if (error) console.error("Error updating:", error);
        else console.log("Updated successfully.");
    } else {
        console.log("Creating new question...");
        const { error } = await supabase
            .from('questions_v2')
            .insert(question);

        if (error) console.error("Error inserting:", error);
        else console.log("Inserted successfully.");
    }
}

seed();
