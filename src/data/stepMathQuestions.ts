import { StepBasedQuestion } from '@/types/stepQuestion';

// CAIE-style step-by-step math questions with authentic marking schemes
export const STEP_MATH_QUESTIONS: StepBasedQuestion[] = [];

// Function to get step-based questions filtered by chapter and level
export const getStepMathQuestions = (
  chapter?: string, 
  level?: 'A1' | 'A2', 
  count: number = 3
): StepBasedQuestion[] => {
  let filtered = STEP_MATH_QUESTIONS;
  
  if (chapter) {
    filtered = filtered.filter(q => q.chapter === chapter);
  }
  
  if (level) {
    filtered = filtered.filter(q => q.level === level);
  }
  
  // Shuffle and return requested count
  const shuffled = [...filtered].sort(() => 0.5 - Math.random());
  return shuffled.slice(0, Math.min(count, shuffled.length));
};

// Get questions based on difficulty and total marks
export const getStepMathQuestionsByDifficulty = (
  difficulty: 'easy' | 'medium' | 'hard',
  totalMarksRange: [number, number] = [0, 20],
  count: number = 3
): StepBasedQuestion[] => {
  const filtered = STEP_MATH_QUESTIONS.filter(q => 
    q.difficulty === difficulty && 
    q.totalMarks >= totalMarksRange[0] && 
    q.totalMarks <= totalMarksRange[1]
  );
  
  const shuffled = [...filtered].sort(() => 0.5 - Math.random());
  return shuffled.slice(0, Math.min(count, shuffled.length));
};