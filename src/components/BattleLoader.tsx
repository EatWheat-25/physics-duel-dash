import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { getStepMathQuestions } from '@/data/stepMathQuestions';
import StepBattlePage from './StepBattlePage';
import { StepBasedQuestion } from '@/types/stepQuestion';

export default function BattleLoader() {
  const navigate = useNavigate();
  const [questions, setQuestions] = useState<StepBasedQuestion[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const loadQuestions = async () => {
      const q = await getStepMathQuestions(undefined, undefined, 3);
      setQuestions(q);
      setLoading(false);
    };
    loadQuestions();
  }, []);

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-xl">Loading questions...</div>
      </div>
    );
  }

  if (questions.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen gap-4">
        <h1 className="text-2xl font-bold">No Questions Available</h1>
        <p>Please add questions in the admin panel first.</p>
        <button onClick={() => navigate('/')}>Go Home</button>
      </div>
    );
  }

  return (
    <StepBattlePage 
      questions={questions} 
      onBattleEnd={() => {}} 
      onGoBack={() => navigate('/')} 
    />
  );
}
