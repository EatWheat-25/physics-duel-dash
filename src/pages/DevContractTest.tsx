/**
 * DEV PAGE: Contract Type Verification
 * 
 * This page verifies that the question contract types are correctly defined
 * and that type guards work as expected.
 * 
 * Access at: /dev/contract-test
 */

import { StepBasedQuestion, QuestionStep, isValidQuestionStep, isValidStepBasedQuestion } from '@/types/question-contract';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Check, X } from 'lucide-react';

export const DevContractTest = () => {
    // Test data: Valid question matching the contract
    const validQuestion: StepBasedQuestion = {
        id: 'test-q-1',
        title: 'Integration by Parts: ln(x)/x³',
        subject: 'math',
        chapter: 'Integration',
        level: 'A2',
        difficulty: 'medium',
        stem: 'Find the integral of ln(x)/x³',
        totalMarks: 4,
        topicTags: ['integration', 'by-parts'],
        steps: [
            {
                id: 'step-1',
                index: 0,
                type: 'mcq',
                title: 'Choose u for substitution',
                prompt: 'In integration by parts (∫u dv = uv - ∫v du), which should be u?',
                options: ['ln(x)', 'x³', '1/x³', 'x'],
                correctAnswer: 0,
                timeLimitSeconds: 30,
                marks: 1,
                explanation: 'ln(x) simplifies when differentiated, making it the better choice for u'
            },
            {
                id: 'step-2',
                index: 1,
                type: 'mcq',
                title: 'Identify dv',
                prompt: 'What is dv in this case?',
                options: ['ln(x) dx', 'x³ dx', '1/x³ dx', 'dx'],
                correctAnswer: 2,
                timeLimitSeconds: 30,
                marks: 1,
                explanation: 'Since u = ln(x), then dv = 1/x³ dx'
            },
            {
                id: 'step-3',
                index: 2,
                type: 'mcq',
                title: 'Find v',
                prompt: 'What is v = ∫dv = ∫1/x³ dx?',
                options: ['-1/(2x²)', '1/(2x²)', '-1/x²', '1/x²'],
                correctAnswer: 0,
                timeLimitSeconds: 45,
                marks: 1,
                explanation: '∫x⁻³ dx = x⁻²/(-2) = -1/(2x²)'
            },
            {
                id: 'step-4',
                index: 3,
                type: 'mcq',
                title: 'Final answer',
                prompt: 'What is the final result after applying ∫u dv = uv - ∫v du?',
                options: [
                    '-ln(x)/(2x²) - 1/(2x²) + C',
                    '-ln(x)/(2x²) + 1/(2x²) + C',
                    'ln(x)/(2x²) - 1/(2x²) + C',
                    'ln(x)/(2x²) + 1/(2x²) + C'
                ],
                correctAnswer: 0,
                timeLimitSeconds: 60,
                marks: 1,
                explanation: 'uv - ∫v du = -ln(x)/(2x²) - ∫(-1/(2x²))(1/x)dx = -ln(x)/(2x²) - 1/(2x²) + C'
            }
        ],
    };

    // Test data: Invalid question (missing required field)
    const invalidQuestion = {
        id: 'test-q-2',
        title: 'Bad Question',
        // Missing subject
        chapter: 'Test',
        level: 'A1',
        difficulty: 'easy',
        stem: 'This is invalid',
        totalMarks: 1,
        topicTags: [],
        steps: []
    };

    // Run validations
    const validQuestionCheck = isValidStepBasedQuestion(validQuestion);
    const invalidQuestionCheck = isValidStepBasedQuestion(invalidQuestion);
    const stepCheck = isValidQuestionStep(validQuestion.steps[0]);

    return (
        <div className="min-h-screen bg-gradient-to-br from-slate-900 via-purple-900 to-slate-900 p-8">
            <div className="max-w-4xl mx-auto space-y-6">
                <div className="text-center space-y-2">
                    <h1 className="text-4xl font-bold text-white">Contract Type Test</h1>
                    <p className="text-slate-300">Verifying question-contract.ts types</p>
                </div>

                {/* Test Results Summary */}
                <Card className="bg-slate-800/50 border-slate-700">
                    <CardHeader>
                        <CardTitle className="text-white flex items-center gap-2">
                            <span>Validation Results</span>
                            {validQuestionCheck && !invalidQuestionCheck && stepCheck ? (
                                <Check className="w-6 h-6 text-green-500" />
                            ) : (
                                <X className="w-6 h-6 text-red-500" />
                            )}
                        </CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-4">
                        <TestResult
                            label="Valid question passes validation"
                            expected={true}
                            actual={validQuestionCheck}
                        />
                        <TestResult
                            label="Invalid question fails validation"
                            expected={false}
                            actual={invalidQuestionCheck}
                        />
                        <TestResult
                            label="Valid step passes validation"
                            expected={true}
                            actual={stepCheck}
                        />
                    </CardContent>
                </Card>

                {/* Valid Question Display */}
                <Card className="bg-slate-800/50 border-slate-700">
                    <CardHeader>
                        <CardTitle className="text-white">Valid Question Example</CardTitle>
                    </CardHeader>
                    <CardContent>
                        <div className="space-y-3 text-slate-200">
                            <div><strong>ID:</strong> {validQuestion.id}</div>
                            <div><strong>Title:</strong> {validQuestion.title}</div>
                            <div><strong>Subject:</strong> {validQuestion.subject}</div>
                            <div><strong>Level:</strong> {validQuestion.level}</div>
                            <div><strong>Difficulty:</strong> {validQuestion.difficulty}</div>
                            <div><strong>Total Marks:</strong> {validQuestion.totalMarks}</div>
                            <div><strong>Steps:</strong> {validQuestion.steps.length}</div>

                            <div className="mt-4 pt-4 border-t border-slate-600">
                                <strong className="block mb-2">Step 1 Details:</strong>
                                <pre className="bg-slate-900 p-3 rounded text-sm overflow-x-auto">
                                    {JSON.stringify(validQuestion.steps[0], null, 2)}
                                </pre>
                            </div>
                        </div>
                    </CardContent>
                </Card>

                {/* Type Information */}
                <Card className="bg-slate-800/50 border-slate-700">
                    <CardHeader>
                        <CardTitle className="text-white">Contract Information</CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-3 text-slate-200">
                        <div>
                            <strong>Contract File:</strong>
                            <code className="ml-2 text-blue-400">src/types/question-contract.ts</code>
                        </div>
                        <div>
                            <strong>Main Types:</strong>
                            <ul className="list-disc list-inside ml-4 space-y-1">
                                <li><code className="text-green-400">StepBasedQuestion</code></li>
                                <li><code className="text-green-400">QuestionStep</code></li>
                            </ul>
                        </div>
                        <div>
                            <strong>Type Guards:</strong>
                            <ul className="list-disc list-inside ml-4 space-y-1">
                                <li><code className="text-purple-400">isValidStepBasedQuestion()</code></li>
                                <li><code className="text-purple-400">isValidQuestionStep()</code></li>
                            </ul>
                        </div>
                    </CardContent>
                </Card>
            </div>
        </div>
    );
};

// Helper component for test results
const TestResult = ({ label, expected, actual }: { label: string; expected: boolean; actual: boolean }) => {
    const passed = expected === actual;

    return (
        <div className="flex items-center justify-between p-3 rounded bg-slate-900/50">
            <span className="text-slate-200">{label}</span>
            <div className="flex items-center gap-2">
                <span className="text-sm text-slate-400">
                    Expected: {expected.toString()} | Got: {actual.toString()}
                </span>
                {passed ? (
                    <Check className="w-5 h-5 text-green-500" />
                ) : (
                    <X className="w-5 h-5 text-red-500" />
                )}
            </div>
        </div>
    );
};
