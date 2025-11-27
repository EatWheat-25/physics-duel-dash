/**
 * DEV PAGE: Mapper Test
 * 
 * Tests the fail-fast mapper with various payloads
 * Shows how it handles valid data and contract violations
 * 
 * Access at: /dev/mapper-test
 */

import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Check, X, AlertCircle } from 'lucide-react';
import { mapToStepBasedQuestion } from '@/lib/question-contract';
import { StepBasedQuestion } from '@/types/question-contract';

export const DevMapperTest = () => {
    const [results, setResults] = useState<Array<{
        name: string;
        success: boolean;
        message: string;
        question?: StepBasedQuestion;
    }>>([]);

    const runTests = () => {
        const testResults = [];

        // Test 1: Valid payload (snake_case DB format)
        try {
            const dbPayload = {
                id: 'test-1',
                title: 'Test Question',
                subject: 'math',
                chapter: 'Integration',
                level: 'A2',
                difficulty: 'medium',
                rank_tier: 'Silver',
                question_text: 'This is the stem',
                total_marks: 2,
                topic_tags: ['test'],
                steps: [
                    {
                        id: 'step-1',
                        step_index: 0,
                        step_type: 'mcq',
                        title: 'Step 1',
                        prompt: 'What is 1+1?',
                        options: ['1', '2', '3', '4'],
                        correct_answer: { correctIndex: 1 },
                        marks: 1,
                        time_limit_seconds: 30,
                        explanation: 'Basic math'
                    },
                    {
                        id: 'step-2',
                        step_index: 1,
                        step_type: 'mcq',
                        title: 'Step 2',
                        prompt: 'What is 2+2?',
                        options: ['2', '3', '4', '5'],
                        correct_answer: { correctIndex: 2 },
                        marks: 1,
                        time_limit_seconds: 30,
                        explanation: null
                    }
                ]
            };

            const question = mapToStepBasedQuestion(dbPayload);
            testResults.push({
                name: 'Valid DB payload (snake_case)',
                success: true,
                message: `✅ Mapped successfully: ${question.steps.length} steps`,
                question
            });
        } catch (e: any) {
            testResults.push({
                name: 'Valid DB payload (snake_case)',
                success: false,
                message: `❌ ${e.message}`
            });
        }

        // Test 2: Valid payload (camelCase WS format)
        try {
            const wsPayload = {
                id: 'test-2',
                title: 'WS Question',
                subject: 'physics',
                chapter: 'Mechanics',
                level: 'A1',
                difficulty: 'easy',
                stem: 'This is the stem',
                totalMarks: 1,
                topicTags: ['mechanics'],
                steps: [
                    {
                        id: 'step-1',
                        index: 0,
                        type: 'mcq',
                        title: 'Step 1',
                        prompt: 'Force equals?',
                        options: ['ma', 'mv', 'mgh', 'p'],
                        correctAnswer: 0,
                        marks: 1,
                        timeLimitSeconds: 30,
                        explanation: 'F = ma'
                    }
                ]
            };

            const question = mapToStepBasedQuestion(wsPayload);
            testResults.push({
                name: 'Valid WS payload (camelCase)',
                success: true,
                message: `✅ Mapped successfully: ${question.steps.length} steps`,
                question
            });
        } catch (e: any) {
            testResults.push({
                name: 'Valid WS payload (camelCase)',
                success: false,
                message: `❌ ${e.message}`
            });
        }

        // Test 3: Missing steps array
        try {
            const badPayload = {
                id: 'test-3',
                title: 'Bad Question',
                subject: 'math',
                chapter: 'Test',
                level: 'A1',
                difficulty: 'easy',
                stem: 'Stem',
                totalMarks: 1,
                topicTags: []
                // Missing steps!
            };

            mapToStepBasedQuestion(badPayload);
            testResults.push({
                name: 'Missing steps array',
                success: false,
                message: '❌ Should have thrown error but didn\'t'
            });
        } catch (e: any) {
            testResults.push({
                name: 'Missing steps array',
                success: true,
                message: `✅ Correctly rejected: "${e.message}"`
            });
        }

        // Test 4: Invalid subject
        try {
            const badPayload = {
                id: 'test-4',
                title: 'Test',
                subject: 'biology', // Invalid!
                chapter: 'Test',
                level: 'A1',
                difficulty: 'easy',
                stem: 'Stem',
                totalMarks: 1,
                topicTags: [],
                steps: [
                    {
                        id: 'step-1',
                        index: 0,
                        type: 'mcq',
                        title: 'Step',
                        prompt: 'Q?',
                        options: ['A', 'B', 'C', 'D'],
                        correctAnswer: 0,
                        marks: 1
                    }
                ]
            };

            mapToStepBasedQuestion(badPayload);
            testResults.push({
                name: 'Invalid subject',
                success: false,
                message: '❌ Should have thrown error but didn\'t'
            });
        } catch (e: any) {
            testResults.push({
                name: 'Invalid subject',
                success: true,
                message: `✅ Correctly rejected: "${e.message}"`
            });
        }

        // Test 5: Wrong number of options
        try {
            const badPayload = {
                id: 'test-5',
                title: 'Test',
                subject: 'math',
                chapter: 'Test',
                level: 'A1',
                difficulty: 'easy',
                stem: 'Stem',
                totalMarks: 1,
                topicTags: [],
                steps: [
                    {
                        id: 'step-1',
                        index: 0,
                        type: 'mcq',
                        title: 'Step',
                        prompt: 'Q?',
                        options: ['A', 'B'], // Only 2 options!
                        correctAnswer: 0,
                        marks: 1
                    }
                ]
            };

            mapToStepBasedQuestion(badPayload);
            testResults.push({
                name: 'Wrong number of options',
                success: false,
                message: '❌ Should have thrown error but didn\'t'
            });
        } catch (e: any) {
            testResults.push({
                name: 'Wrong number of options',
                success: true,
                message: `✅ Correctly rejected: "${e.message}"`
            });
        }

        setResults(testResults);
    };

    const passedTests = results.filter(r => r.success).length;
    const totalTests = results.length;

    return (
        <div className="min-h-screen bg-gradient-to-br from-slate-900 via-purple-900 to-slate-900 p-8">
            <div className="max-w-4xl mx-auto space-y-6">
                <div className="text-center space-y-2">
                    <h1 className="text-4xl font-bold text-white">Contract Mapper Test</h1>
                    <p className="text-slate-300">Testing fail-fast mapping logic</p>
                </div>

                <Card className="bg-slate-800/50 border-slate-700">
                    <CardHeader>
                        <CardTitle className="text-white">Test Controls</CardTitle>
                    </CardHeader>
                    <CardContent>
                        <Button onClick={runTests} className="w-full">
                            Run All Tests
                        </Button>
                        {results.length > 0 && (
                            <div className="mt-4 text-center">
                                <span className={`text-2xl font-bold ${passedTests === totalTests ? 'text-green-400' : 'text-yellow-400'}`}>
                                    {passedTests}/{totalTests} Passed
                                </span>
                            </div>
                        )}
                    </CardContent>
                </Card>

                {/* Test Results */}
                {results.map((result, i) => (
                    <Card key={i} className="bg-slate-800/50 border-slate-700">
                        <CardHeader>
                            <CardTitle className="text-white flex items-center justify-between">
                                <span>{result.name}</span>
                                {result.success ? (
                                    <Check className="w-6 h-6 text-green-500" />
                                ) : (
                                    <X className="w-6 h-6 text-red-500" />
                                )}
                            </CardTitle>
                        </CardHeader>
                        <CardContent className="space-y-3">
                            <div className={`p-3 rounded ${result.success ? 'bg-green-500/10' : 'bg-red-500/10'}`}>
                                <p className={result.success ? 'text-green-300' : 'text-red-300'}>
                                    {result.message}
                                </p>
                            </div>

                            {result.question && (
                                <div className="mt-3">
                                    <p className="text-slate-300 mb-2">
                                        <strong>Mapped Question:</strong>
                                    </p>
                                    <div className="space-y-1 text-sm text-slate-400">
                                        <div>ID: {result.question.id}</div>
                                        <div>Title: {result.question.title}</div>
                                        <div>Steps: {result.question.steps.length}</div>
                                        <div>Total Marks: {result.question.totalMarks}</div>
                                    </div>
                                </div>
                            )}
                        </CardContent>
                    </Card>
                ))}

                {results.length === 0 && (
                    <Card className="bg-slate-800/50 border-slate-700">
                        <CardContent className="flex items-center gap-3 p-6">
                            <AlertCircle className="w-5 h-5 text-blue-400" />
                            <p className="text-slate-300">Click "Run All Tests" to start</p>
                        </CardContent>
                    </Card>
                )}
            </div>
        </div>
    );
};
