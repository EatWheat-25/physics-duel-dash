/**
 * DEBUG PAGE - Verify questions can be fetched from database
 *
 * Navigate to /debug/questions to see if questions are being loaded correctly
 */

import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Loader2, ArrowLeft, Database, CheckCircle, XCircle } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { getAllMathsQuestions, getA1Questions, getA2Questions, getStepMathQuestions } from '@/data/stepMathQuestions';
import { StepBasedQuestion } from '@/types/questions';
import { supabase } from '@/integrations/supabase/client';
import { MathText } from '@/components/math/MathText';

export default function DebugQuestions() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [questions, setQuestions] = useState<StepBasedQuestion[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [dbCount, setDbCount] = useState<number | null>(null);
  const [testResults, setTestResults] = useState<Record<string, boolean>>({});

  // Check database connection and question count
  useEffect(() => {
    const checkDatabase = async () => {
      try {
        const { count, error } = await (supabase as any)
          .from('questions_v2')
          .select('*', { count: 'exact', head: true });

        if (error) {
          console.error('DB check error:', error);
          setError(error.message);
        } else {
          setDbCount(count);
        }
      } catch (err: any) {
        console.error('DB check exception:', err);
        setError(err.message);
      }
    };

    checkDatabase();
  }, []);

  const testFetch = async (name: string, fetcher: () => Promise<StepBasedQuestion[]>) => {
    setLoading(true);
    setError(null);
    try {
      const result = await fetcher();
      setQuestions(result);
      setTestResults(prev => ({ ...prev, [name]: result.length > 0 }));

      if (result.length === 0) {
        setError(`No questions returned from ${name}`);
      }
    } catch (err: any) {
      console.error(`Error in ${name}:`, err);
      setError(err.message || String(err));
      setTestResults(prev => ({ ...prev, [name]: false }));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-gray-950 via-gray-900 to-black p-8">
      <div className="max-w-4xl mx-auto">
        <Button
          variant="ghost"
          onClick={() => navigate(-1)}
          className="mb-6"
        >
          <ArrowLeft className="mr-2" /> Back
        </Button>

        <Card className="mb-6 border-blue-500/20">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Database className="w-6 h-6 text-blue-400" />
              Questions System Debug Panel
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* Database Status */}
            <div className="p-4 bg-gray-900 rounded-lg border border-gray-700">
              <h3 className="font-semibold mb-2 flex items-center gap-2">
                {dbCount !== null ? (
                  <CheckCircle className="w-5 h-5 text-green-400" />
                ) : (
                  <XCircle className="w-5 h-5 text-red-400" />
                )}
                Database Connection
              </h3>
              <p className="text-sm text-gray-400">
                {dbCount !== null ? (
                  <>
                    <span className="text-green-400">✓ Connected</span>
                    <br />
                    Total questions in database: <span className="text-white font-mono">{dbCount}</span>
                  </>
                ) : (
                  <span className="text-red-400">✗ Connection failed or checking...</span>
                )}
              </p>
              {error && (
                <p className="text-sm text-red-400 mt-2 font-mono">
                  Error: {error}
                </p>
              )}
            </div>

            {/* Test Buttons */}
            <div className="space-y-2">
              <h3 className="font-semibold mb-2">Test Question Fetchers</h3>
              <div className="grid grid-cols-2 gap-2">
                <Button
                  onClick={() => testFetch('getAllMathsQuestions', () => getAllMathsQuestions(5))}
                  disabled={loading}
                  variant={testResults['getAllMathsQuestions'] === true ? 'default' : 'outline'}
                >
                  {loading ? <Loader2 className="mr-2 animate-spin" /> : null}
                  All Maths (Mix)
                  {testResults['getAllMathsQuestions'] === true && ' ✓'}
                  {testResults['getAllMathsQuestions'] === false && ' ✗'}
                </Button>

                <Button
                  onClick={() => testFetch('getA1Questions', () => getA1Questions(5))}
                  disabled={loading}
                  variant={testResults['getA1Questions'] === true ? 'default' : 'outline'}
                >
                  {loading ? <Loader2 className="mr-2 animate-spin" /> : null}
                  A1 Only
                  {testResults['getA1Questions'] === true && ' ✓'}
                  {testResults['getA1Questions'] === false && ' ✗'}
                </Button>

                <Button
                  onClick={() => testFetch('getA2Questions', () => getA2Questions(5))}
                  disabled={loading}
                  variant={testResults['getA2Questions'] === true ? 'default' : 'outline'}
                >
                  {loading ? <Loader2 className="mr-2 animate-spin" /> : null}
                  A2 Only
                  {testResults['getA2Questions'] === true && ' ✓'}
                  {testResults['getA2Questions'] === false && ' ✗'}
                </Button>

                <Button
                  onClick={() => testFetch('getStepMathQuestions (no filters)', () =>
                    getStepMathQuestions({ subject: 'math', limit: 10 })
                  )}
                  disabled={loading}
                  variant={testResults['getStepMathQuestions (no filters)'] === true ? 'default' : 'outline'}
                >
                  {loading ? <Loader2 className="mr-2 animate-spin" /> : null}
                  Any Math Q
                  {testResults['getStepMathQuestions (no filters)'] === true && ' ✓'}
                  {testResults['getStepMathQuestions (no filters)'] === false && ' ✗'}
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Results Display */}
        {questions.length > 0 && (
          <Card className="border-green-500/20">
            <CardHeader>
              <CardTitle className="text-green-400">
                ✓ Fetched {questions.length} Questions
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {questions.map((q, index) => (
                <div key={q.id} className="p-4 bg-gray-900 rounded-lg border border-gray-700">
                  <h4 className="font-semibold text-lg mb-2">
                    {index + 1}. {q.title}
                  </h4>
                  <div className="text-sm text-gray-400 space-y-1">
                    <p><span className="text-gray-500">ID:</span> <span className="font-mono">{q.id}</span></p>
                    <p><span className="text-gray-500">Subject:</span> {q.subject}</p>
                    <p><span className="text-gray-500">Level:</span> {q.level}</p>
                    <p><span className="text-gray-500">Chapter:</span> {q.chapter}</p>
                    <p><span className="text-gray-500">Difficulty:</span> {q.difficulty}</p>
                    <p><span className="text-gray-500">Total Marks:</span> {q.totalMarks}</p>
                    <p><span className="text-gray-500">Steps:</span> {q.steps?.length || 0}</p>
                  </div>
                  <div className="mt-3 p-3 bg-gray-800 rounded border border-gray-600">
                    <p className="text-sm font-semibold text-gray-300 mb-1">Question Text:</p>
                    <p className="text-sm text-gray-400">
                      <MathText text={q.questionText} />
                    </p>
                  </div>
                  {q.steps && q.steps.length > 0 && (
                    <div className="mt-3 p-3 bg-gray-800 rounded border border-gray-600">
                      <p className="text-sm font-semibold text-gray-300 mb-2">First Step:</p>
                      <p className="text-sm text-gray-400 mb-2">
                        <MathText text={q.steps[0].question} />
                      </p>
                      <div className="space-y-1">
                        {q.steps[0].options.map((opt, i) => (
                          <div
                            key={i}
                            className={`text-sm p-2 rounded ${
                              i === q.steps[0].correctAnswer
                                ? 'bg-green-900/30 text-green-300 border border-green-600'
                                : 'bg-gray-900 text-gray-400'
                            }`}
                          >
                            {String.fromCharCode(65 + i)}. <MathText text={opt} />
                            {i === q.steps[0].correctAnswer && ' ✓ (Correct)'}
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              ))}
            </CardContent>
          </Card>
        )}

        {/* Instructions */}
        <Card className="mt-6 border-yellow-500/20">
          <CardHeader>
            <CardTitle className="text-yellow-400">Instructions</CardTitle>
          </CardHeader>
          <CardContent className="text-sm text-gray-400 space-y-2">
            <p>1. Click any test button above to fetch questions from the database</p>
            <p>2. If you see "0 questions in database", run: <code className="bg-gray-800 px-2 py-1 rounded">npm run seed:questions</code></p>
            <p>3. If questions display correctly here, the database and fetchers work!</p>
            <p>4. If online 1v1 still doesn't show questions, the issue is in the WebSocket/game-ws flow</p>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
