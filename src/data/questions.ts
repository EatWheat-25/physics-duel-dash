export interface Question {
  q: string;
  options: string[];
  answer: number;
}

export const physicsQuestions: Question[] = [];

export const getRandomQuestions = (count: number = 5): Question[] => {
  const shuffled = [...physicsQuestions].sort(() => 0.5 - Math.random());
  return shuffled.slice(0, Math.min(count, physicsQuestions.length));
};