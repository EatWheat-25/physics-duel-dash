/**
 * PRACTICE PAGE
 *
 * Main practice/play page that fetches real questions from Supabase
 * and displays them using the QuestionViewer component
 */

import { useNavigate, useSearchParams } from 'react-router-dom';
import { ArrowLeft, Loader2, AlertCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Starfield } from '@/components/Starfield';
import { QuestionViewer } from '@/components/questions/QuestionViewer';
import { useQuestions } from '@/hooks/useQuestions';
import { QuestionSubject, QuestionLevel } from '@/types/questions';

export default function Practice() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();

  // Get filters from URL params (default to math if not specified)
  const subject = (searchParams.get('subject') as QuestionSubject) || 'math';
  const level = searchParams.get('level') as QuestionLevel | undefined;

  // Fetch questions using the existing hook
  const { data: questions, isLoading, isError, error } = useQuestions({
    subject,
    level,
    limit: 10, // Fetch 10 questions for practice
  });

  const handleFinished = () => {
    // Navigate back or show completion message
    navigate('/');
  };

  return (
    <div className="relative min-h-screen overflow-hidden bg-gradient-to-b from-gray-950 via-gray-900 to-black">
      <Starfield />

      {/* Back button */}
      <div className="absolute top-4 left-4 z-20">
        <Button
          variant="ghost"
          size="sm"
          onClick={() => navigate('/')}
          className="gap-2 font-bold uppercase tracking-wider text-white"
          style={{
            background: 'rgba(255,255,255,0.05)',
            backdropFilter: 'blur(20px)',
            border: '1px solid rgba(255,255,255,0.1)',
          }}
        >
          <ArrowLeft className="w-4 h-4" />
          <span>Back</span>
        </Button>
      </div>

      <div className="relative z-10 min-h-screen pt-20 pb-12">
        {/* Header */}
        <div className="text-center mb-8 px-4">
          <h1 className="text-4xl md:text-5xl font-bold text-white mb-2">
            Practice Questions
          </h1>
          <p className="text-gray-400 text-lg">
            {subject.charAt(0).toUpperCase() + subject.slice(1)}{' '}
            {level ? `• ${level}` : '• All Levels'}
          </p>
        </div>

        {/* Loading state */}
        {isLoading && (
          <div className="flex flex-col items-center justify-center min-h-[400px] px-4">
            <Card className="w-full max-w-md border-gray-700 bg-gray-800/50 backdrop-blur">
              <CardContent className="flex flex-col items-center justify-center py-12 space-y-4">
                <Loader2 className="w-12 h-12 animate-spin text-blue-500" />
                <p className="text-lg text-gray-300 font-medium">Loading questions...</p>
                <p className="text-sm text-gray-500">Fetching from database</p>
              </CardContent>
            </Card>
          </div>
        )}

        {/* Error state */}
        {isError && (
          <div className="flex flex-col items-center justify-center min-h-[400px] px-4">
            <Card className="w-full max-w-md border-red-700 bg-red-900/20 backdrop-blur">
              <CardContent className="flex flex-col items-center justify-center py-12 space-y-4">
                <AlertCircle className="w-12 h-12 text-red-500" />
                <p className="text-lg text-red-300 font-medium text-center">
                  Failed to load questions
                </p>
                <p className="text-sm text-gray-400 text-center">
                  {error instanceof Error ? error.message : 'Please refresh the page or try again later'}
                </p>
                <Button
                  variant="outline"
                  onClick={() => window.location.reload()}
                  className="mt-4"
                >
                  Retry
                </Button>
              </CardContent>
            </Card>
          </div>
        )}

        {/* Empty state */}
        {!isLoading && !isError && (!questions || questions.length === 0) && (
          <div className="flex flex-col items-center justify-center min-h-[400px] px-4">
            <Card className="w-full max-w-md border-yellow-700 bg-yellow-900/20 backdrop-blur">
              <CardContent className="flex flex-col items-center justify-center py-12 space-y-4">
                <AlertCircle className="w-12 h-12 text-yellow-500" />
                <p className="text-lg text-yellow-300 font-medium text-center">
                  No questions found
                </p>
                <p className="text-sm text-gray-400 text-center">
                  No questions match your filters. Try selecting different options or ask an admin to seed more questions.
                </p>
                <Button variant="outline" onClick={() => navigate('/')} className="mt-4">
                  Go Back
                </Button>
              </CardContent>
            </Card>
          </div>
        )}

        {/* Question viewer */}
        {!isLoading && !isError && questions && questions.length > 0 && (
          <QuestionViewer questions={questions} onFinished={handleFinished} />
        )}
      </div>
    </div>
  );
}
