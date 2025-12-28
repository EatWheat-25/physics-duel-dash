/**
 * DEV PAGE: Database Schema Verification
 * 
 * Verifies that questions_v2 table exists and can be queried
 * Shows if data matches the canonical contract
 * 
 * Access at: /dev/db-test
 */

import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Check, X, Loader2, AlertCircle } from 'lucide-react';
import { StepBasedQuestion, isValidStepBasedQuestion } from '@/types/question-contract';

export const DevDatabaseTest = () => {
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [rawData, setRawData] = useState<any>(null);
    const [mappedQuestion, setMappedQuestion] = useState<StepBasedQuestion | null>(null);
    const [validationPassed, setValidationPassed] = useState(false);
    const [user, setUser] = useState<any>(null);

    useEffect(() => {
        fetchTestQuestion();
        checkAuth();
    }, []);

    const checkAuth = async () => {
        const { data: { user } } = await supabase.auth.getUser();
        setUser(user);
    };

    const fetchTestQuestion = async () => {
        try {
            setLoading(true);
            setError(null);

            console.log('[DB-TEST] Fetching from questions_v2...');

            const { data, error: fetchError } = await supabase
                .from('questions_v2')
                .select('*')
                .limit(1)
                .single();

            if (fetchError) {
                throw new Error(`Database error: ${fetchError.message}`);
            }

            if (!data) {
                throw new Error('No questions found. Run seed script first.');
            }

            console.log('[DB-TEST] Raw data:', data);
            setRawData(data);

            // Map to contract type
            const mapped: StepBasedQuestion = {
                id: data.id,
                title: data.title,
                subject: data.subject as any,
                chapter: data.chapter,
                level: data.level as any,
                difficulty: data.difficulty as any,
                rankTier: data.rank_tier as any,
                stem: data.stem,
                totalMarks: data.total_marks,
                topicTags: data.topic_tags,
                steps: data.steps as any,
                imageUrl: data.image_url,
            };

            console.log('[DB-TEST] Mapped:', mapped);
            setMappedQuestion(mapped);

            // Validate against contract
            const isValid = isValidStepBasedQuestion(mapped);
            console.log('[DB-TEST] Valid?', isValid);
            setValidationPassed(isValid);

        } catch (err: any) {
            console.error('[DB-TEST] Error:', err);
            setError(err.message);
        } finally {
            setLoading(false);
        }
    };

    const createTestMatch = async () => {
        if (!user) {
            alert('Please login first!');
            return;
        }

        try {
            // Create a self-play match
            const { data, error } = await supabase
                .from('matches_new')
                .insert({
                    p1: user.id,
                    p2: user.id, // Self-play
                    state: 'pending',
                    subject: 'math',
                    chapter: 'Integration'
                })
                .select()
                .single();

            if (error) throw error;

            console.log('Match created:', data);
            // Redirect to the match
            window.location.href = `/online-battle/${data.id}`;

        } catch (e: any) {
            console.error('Error creating match:', e);
            alert('Failed to create match: ' + e.message);
        }
    };

    const testWebSocket = () => {
        console.log('[WS-TEST] Starting connection test...');
        const wsUrl = 'wss://qvunaswogfwhixecjpcn.supabase.co/functions/v1/game-ws?token=anon&match_id=test-connection';

        try {
            const ws = new WebSocket(wsUrl);

            ws.onopen = () => {
                console.log('[WS-TEST] ✅ Connected!');
                alert('WebSocket Connected Successfully!');
                ws.close();
            };

            ws.onmessage = (e) => {
                console.log('[WS-TEST] 📩 Message:', e.data);
            };

            ws.onerror = (e) => {
                console.error('[WS-TEST] ❌ Error:', e);
                alert('WebSocket Connection Failed. Check console.');
            };

            ws.onclose = (e) => {
                console.log('[WS-TEST] Closed:', e.code, e.reason);
            };

        } catch (e) {
            console.error('[WS-TEST] Exception:', e);
            alert('WebSocket Exception: ' + e);
        }
    };

    return (
        <div className="min-h-screen bg-gradient-to-br from-slate-900 via-purple-900 to-slate-900 p-8">
            <div className="max-w-4xl mx-auto space-y-6">
                <div className="text-center space-y-2">
                    <h1 className="text-4xl font-bold text-white">Database Schema Test</h1>
                    <p className="text-slate-300">Verifying questions_v2 table</p>
                </div>

                {/* Auth Status Card */}
                <Card className="bg-slate-800/50 border-slate-700">
                    <CardHeader>
                        <CardTitle className="text-white flex items-center justify-between">
                            <div className="flex items-center gap-2">
                                Auth Status
                                {user ? (
                                    <span className="text-green-400 text-sm font-normal">(Logged In: {user.email})</span>
                                ) : (
                                    <span className="text-red-400 text-sm font-normal">(Not Logged In)</span>
                                )}
                            </div>
                            {user && (
                                <button
                                    onClick={createTestMatch}
                                    className="px-3 py-1 bg-green-600 hover:bg-green-500 text-white text-sm rounded transition-colors"
                                >
                                    Start Test Match
                                </button>
                            )}
                        </CardTitle>
                    </CardHeader>
                </Card>

                {/* Status Card */}
                <Card className="bg-slate-800/50 border-slate-700">
                    <CardHeader>
                        <CardTitle className="text-white flex items-center justify-between">
                            <div className="flex items-center gap-2">
                                Database Connection
                                {loading ? (
                                    <Loader2 className="w-5 h-5 animate-spin text-blue-500" />
                                ) : error ? (
                                    <X className="w-5 h-5 text-red-500" />
                                ) : (
                                    <Check className="w-5 h-5 text-green-500" />
                                )}
                            </div>
                            <button
                                onClick={testWebSocket}
                                className="px-3 py-1 bg-blue-600 hover:bg-blue-500 text-white text-sm rounded transition-colors"
                            >
                                Test WebSocket
                            </button>
                        </CardTitle>
                    </CardHeader>
                    <CardContent>
                        {error && (
                            <div className="flex items-start gap-3 p-4 bg-red-500/10 border border-red-500/20 rounded">
                                <AlertCircle className="w-5 h-5 text-red-500 mt-0.5" />
                                <div className="space-y-2">
                                    <p className="text-red-400 font-semibold">Error</p>
                                    <p className="text-red-300 text-sm">{error}</p>
                                    {error.includes('No questions found') && (
                                        <div className="mt-3 text-slate-300 text-sm">
                                            <strong>Fix:</strong> Run seed script:
                                            <code className="block mt-2 bg-slate-900 p-2 rounded">
                                                npm run seed:test-v2
                                            </code>
                                        </div>
                                    )}
                                </div>
                            </div>
                        )}

                        {!loading && !error && (
                            <div className="space-y-3">
                                <TestResult
                                    label="Table exists and is accessible"
                                    passed={!!rawData}
                                />
                                <TestResult
                                    label="Question data retrieved"
                                    passed={!!mappedQuestion}
                                />
                                <TestResult
                                    label="Data matches canonical contract"
                                    passed={validationPassed}
                                />
                            </div>
                        )}
                    </CardContent>
                </Card>

                {/* Question Data */}
                {mappedQuestion && (
                    <Card className="bg-slate-800/50 border-slate-700">
                        <CardHeader>
                            <CardTitle className="text-white">Retrieved Question</CardTitle>
                        </CardHeader>
                        <CardContent className="space-y-3 text-slate-200">
                            <div><strong>ID:</strong> <code className="text-blue-400">{mappedQuestion.id}</code></div>
                            <div><strong>Title:</strong> {mappedQuestion.title}</div>
                            <div><strong>Subject:</strong> {mappedQuestion.subject}</div>
                            <div><strong>Level:</strong> {mappedQuestion.level}</div>
                            <div><strong>Difficulty:</strong> {mappedQuestion.difficulty}</div>
                            <div><strong>Steps:</strong> {mappedQuestion.steps.length}</div>
                            <div><strong>Total Marks:</strong> {mappedQuestion.totalMarks}</div>
                        </CardContent>
                    </Card>
                )}

                {/* Raw Data */}
                {rawData && (
                    <Card className="bg-slate-800/50 border-slate-700">
                        <CardHeader>
                            <CardTitle className="text-white">Raw Database Row</CardTitle>
                        </CardHeader>
                        <CardContent>
                            <pre className="bg-slate-900 p-4 rounded text-xs text-slate-300 overflow-x-auto">
                                {JSON.stringify(rawData, null, 2)}
                            </pre>
                        </CardContent>
                    </Card>
                )}

                {/* Instructions */}
                <Card className="bg-slate-800/50 border-slate-700">
                    <CardHeader>
                        <CardTitle className="text-white">Setup Instructions</CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-3 text-slate-200">
                        <div>
                            <strong className="block mb-2">1. Run migration:</strong>
                            <code className="block bg-slate-900 p-2 rounded text-sm">
                                supabase db push
                            </code>
                        </div>
                        <div>
                            <strong className="block mb-2">2. Seed test data:</strong>
                            <code className="block bg-slate-900 p-2 rounded text-sm">
                                tsx scripts/seed-test-question-v2.ts
                            </code>
                        </div>
                        <div>
                            <strong className="block mb-2">3. Refresh this page</strong>
                        </div>
                    </CardContent>
                </Card>
            </div>
        </div>
    );
};

const TestResult = ({ label, passed }: { label: string; passed: boolean }) => {
    return (
        <div className="flex items-center justify-between p-3 rounded bg-slate-900/50">
            <span className="text-slate-200">{label}</span>
            {passed ? (
                <Check className="w-5 h-5 text-green-500" />
            ) : (
                <X className="w-5 h-5 text-red-500" />
            )}
        </div>
    );
};
