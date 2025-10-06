import { StepBasedQuestion } from '@/types/stepQuestion';
import { supabase } from '@/integrations/supabase/client';

// CAIE-style step-by-step math questions - now fetched from database
export const STEP_MATH_QUESTIONS: StepBasedQuestion[] = [];

// Function to get step-based questions filtered by chapter and level from database
export const getStepMathQuestions = async (
  chapter?: string, 
  level?: 'A1' | 'A2', 
  count: number = 3
): Promise<StepBasedQuestion[]> => {
  let query = supabase.from('questions').select('*').eq('subject', 'math');
  
  if (chapter) {
    query = query.eq('chapter', chapter);
  }
  
  if (level) {
    query = query.eq('level', level);
  }
  
  const { data, error } = await query;
  
  if (error) {
    console.error('Error fetching questions:', error);
    return [];
  }
  
  const questions = (data || []).map(q => ({
    id: q.id,
    title: q.title,
    subject: q.subject as 'math' | 'physics' | 'chemistry',
    chapter: q.chapter,
    level: q.level as 'A1' | 'A2',
    difficulty: q.difficulty as 'easy' | 'medium' | 'hard',
    totalMarks: q.total_marks,
    questionText: q.question_text,
    topicTags: q.topic_tags || [],
    steps: q.steps as any
  })) as StepBasedQuestion[];
  
  // Shuffle and return requested count
  const shuffled = [...questions].sort(() => 0.5 - Math.random());
  return shuffled.slice(0, Math.min(count, shuffled.length));
};

// Get questions based on difficulty and total marks from database
export const getStepMathQuestionsByDifficulty = async (
  difficulty: 'easy' | 'medium' | 'hard',
  totalMarksRange: [number, number] = [0, 20],
  count: number = 3
): Promise<StepBasedQuestion[]> => {
  const { data, error } = await supabase
    .from('questions')
    .select('*')
    .eq('subject', 'math')
    .eq('difficulty', difficulty)
    .gte('total_marks', totalMarksRange[0])
    .lte('total_marks', totalMarksRange[1]);
  
  if (error) {
    console.error('Error fetching questions:', error);
    return [];
  }
  
  const questions = (data || []).map(q => ({
    id: q.id,
    title: q.title,
    subject: q.subject as 'math' | 'physics' | 'chemistry',
    chapter: q.chapter,
    level: q.level as 'A1' | 'A2',
    difficulty: q.difficulty as 'easy' | 'medium' | 'hard',
    totalMarks: q.total_marks,
    questionText: q.question_text,
    topicTags: q.topic_tags || [],
    steps: q.steps as any
  })) as StepBasedQuestion[];
  
  const shuffled = [...questions].sort(() => 0.5 - Math.random());
  return shuffled.slice(0, Math.min(count, shuffled.length));
};