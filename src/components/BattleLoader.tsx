import { useEffect, useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { getStepMathQuestions } from '@/data/stepMathQuestions';
import StepBattlePage from './StepBattlePage';
import { StepBasedQuestion } from '@/types/questions';

export default function BattleLoader() {
  const navigate = useNavigate();
  const location = useLocation();
  const [questions, setQuestions] = useState<StepBasedQuestion[]>([]);
  const [loading, setLoading] = useState(true);

  const { subject, chapter } = location.state || { subject: 'math', chapter: 'A1' };

  useEffect(() => {
    const loadQuestions = async () => {
      const q = await getStepMathQuestions({
        subject: 'math',
        chapter,
        limit: 5
      });
      setQuestions(q);
      setLoading(false);
    };
    loadQuestions();
  }, [subject, chapter]);

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-background">
        <div className="text-xl">Loading battle...</div>
      </div>
    );
  }

  if (questions.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen gap-4 bg-background">
        <h1 className="text-2xl font-bold">No Questions Available</h1>
        <p>No questions found for {subject} - {chapter}</p>
        <button
          onClick={() => navigate('/')}
          className="px-6 py-3 bg-primary text-primary-foreground rounded-lg hover:bg-primary/90"
        >
          Back to Dashboard
        </button>
      </div>
    );
  }

  return (
    <StepBattlePage
      questions={questions}
      onBattleEnd={() => navigate('/')}
      onGoBack={() => navigate('/')}
    />
  );
}
