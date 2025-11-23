import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Card, CardContent } from './ui/card';
import { Button } from './ui/button';
import { StepBasedQuestion } from '@/types/questions';
import { RoundResultEvent } from '@/types/gameEvents';
import { CheckCircle2, XCircle, Clock, ArrowRight } from 'lucide-react';

interface BattleQuestionViewProps {
    question: StepBasedQuestion;
    currentStepIndex: number;
    selectedOptionIndex: number | null;
    stepTimeLeft: number | null;
    isSubmitting: boolean;
    onSelectOption: (index: number) => void;
    onSubmitStep: () => void;
    roundResult: RoundResultEvent | null;
    onNextQuestion: () => void;
    isLoadingNext: boolean;
}

export const BattleQuestionView: React.FC<BattleQuestionViewProps> = ({
    question,
    currentStepIndex,
    selectedOptionIndex,
    stepTimeLeft,
    isSubmitting,
    onSelectOption,
    onSubmitStep,
    roundResult,
    onNextQuestion,
    isLoadingNext
}) => {
    const currentStep = question.steps[currentStepIndex];
    const totalSteps = question.steps.length;
    const isFinalStep = currentStepIndex === totalSteps - 1;

    // Visual urgency for timer
    const isUrgent = stepTimeLeft !== null && stepTimeLeft <= 5;

    return (
        <div className="w-full max-w-4xl mx-auto relative">
            {/* Round Result Overlay */}
            <AnimatePresence>
                {roundResult && (
                    <motion.div
                        initial={{ opacity: 0, scale: 0.9 }}
                        animate={{ opacity: 1, scale: 1 }}
                        exit={{ opacity: 0, scale: 0.9 }}
                        className="absolute inset-0 z-50 flex items-center justify-center bg-background/80 backdrop-blur-md rounded-xl"
                    >
                        <Card className="w-full max-w-md border-2 border-primary/50 shadow-2xl bg-card">
                            <CardContent className="p-8 text-center space-y-6">
                                <h2 className="text-3xl font-bold bg-gradient-to-r from-primary to-purple-400 bg-clip-text text-transparent">
                                    Round Complete!
                                </h2>

                                <div className="space-y-4">
                                    {roundResult.playerResults.map((result, idx) => (
                                        <div key={idx} className="flex items-center justify-between p-4 rounded-lg bg-secondary/20 border border-border/50">
                                            <span className="font-semibold text-lg">
                                                Player {idx + 1}
                                            </span>
                                            <div className="flex items-center gap-2">
                                                {result.isCorrect ? (
                                                    <span className="flex items-center text-green-500 font-bold">
                                                        <CheckCircle2 className="w-5 h-5 mr-1" /> Correct
                                                    </span>
                                                ) : (
                                                    <span className="flex items-center text-red-500 font-bold">
                                                        <XCircle className="w-5 h-5 mr-1" /> Wrong
                                                    </span>
                                                )}
                                            </div>
                                        </div>
                                    ))}
                                </div>

                                <div className="pt-4">
                                    <Button
                                        size="lg"
                                        className="w-full text-lg font-bold"
                                        onClick={onNextQuestion}
                                        disabled={isLoadingNext}
                                    >
                                        {isLoadingNext ? 'Loading...' : 'Next Question'} <ArrowRight className="ml-2 w-5 h-5" />
                                    </Button>
                                </div>
                            </CardContent>
                        </Card>
                    </motion.div>
                )}
            </AnimatePresence>

            {/* Loading Overlay */}
            <AnimatePresence>
                {isLoadingNext && !roundResult && (
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        className="absolute inset-0 z-40 flex flex-col items-center justify-center bg-background/60 backdrop-blur-sm rounded-xl"
                    >
                        <div className="w-16 h-16 border-4 border-primary border-t-transparent rounded-full animate-spin mb-4" />
                        <h3 className="text-xl font-semibold animate-pulse">Preparing next battle...</h3>
                    </motion.div>
                )}
            </AnimatePresence>

            {/* Main Question Card */}
            <Card className="border-border/50 bg-card/50 backdrop-blur-sm shadow-xl overflow-hidden">
                {/* Header: Stem & Context */}
                <div className="bg-secondary/30 p-6 border-b border-border/50">
                    <div className="flex justify-between items-start mb-4">
                        <div>
                            <h3 className="text-sm font-bold text-primary uppercase tracking-wider mb-1">
                                {question.subject} • {question.chapter}
                            </h3>
                            <h2 className="text-xl font-bold text-foreground/90">{question.title}</h2>
                        </div>
                        <div className={`flex items-center gap-2 px-4 py-2 rounded-full font-mono font-bold text-xl border ${isUrgent ? 'bg-red-500/20 text-red-500 border-red-500/50 animate-pulse' : 'bg-secondary/50 text-foreground border-border'
                            }`}>
                            <Clock className="w-5 h-5" />
                            {stepTimeLeft !== null ? String(stepTimeLeft).padStart(2, '0') : '--'}s
                        </div>
                    </div>

                    <div className="text-lg text-muted-foreground leading-relaxed font-medium">
                        {question.questionText}
                    </div>
                </div>

                <CardContent className="p-0">
                    {/* Step Progress Bar */}
                    <div className="h-1 w-full bg-secondary/30">
                        <motion.div
                            className="h-full bg-primary"
                            initial={{ width: `${((currentStepIndex) / totalSteps) * 100}%` }}
                            animate={{ width: `${((currentStepIndex + 1) / totalSteps) * 100}%` }}
                            transition={{ duration: 0.5 }}
                        />
                    </div>

                    {/* Step Content */}
                    <div className="p-6 space-y-8">
                        <div className="space-y-2">
                            <div className="flex items-center justify-between text-sm font-medium text-muted-foreground">
                                <span>Step {currentStepIndex + 1} of {totalSteps}</span>
                                <span>{currentStep.marks} Marks</span>
                            </div>
                            <h3 className="text-2xl font-bold text-foreground">
                                {currentStep.question}
                            </h3>
                        </div>

                        {/* Options Grid */}
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            {currentStep.options.map((option, idx) => {
                                const isSelected = selectedOptionIndex === idx;
                                return (
                                    <Button
                                        key={idx}
                                        variant={isSelected ? "default" : "outline"}
                                        className={`h-auto py-6 px-6 text-left justify-start text-lg transition-all duration-200 ${isSelected
                                                ? 'ring-2 ring-primary ring-offset-2 ring-offset-background scale-[1.02]'
                                                : 'hover:bg-secondary/50 hover:border-primary/50'
                                            }`}
                                        onClick={() => !isSubmitting && onSelectOption(idx)}
                                        disabled={isSubmitting || roundResult !== null}
                                    >
                                        <div className="flex items-center gap-4 w-full">
                                            <div className={`flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center border-2 font-bold ${isSelected ? 'bg-background text-primary border-background' : 'border-muted-foreground text-muted-foreground'
                                                }`}>
                                                {String.fromCharCode(65 + idx)}
                                            </div>
                                            <span className="flex-grow whitespace-normal leading-tight">{option}</span>
                                        </div>
                                    </Button>
                                );
                            })}
                        </div>

                        {/* Action Bar */}
                        <div className="flex justify-end pt-4">
                            <Button
                                size="lg"
                                className="px-8 text-lg font-bold min-w-[200px]"
                                onClick={onSubmitStep}
                                disabled={selectedOptionIndex === null || isSubmitting || roundResult !== null}
                            >
                                {isSubmitting ? (
                                    <span className="flex items-center gap-2">
                                        <div className="w-4 h-4 border-2 border-white/50 border-t-white rounded-full animate-spin" />
                                        Submitting...
                                    </span>
                                ) : isFinalStep ? (
                                    "Submit Final Answer"
                                ) : (
                                    "Next Step"
                                )}
                            </Button>
                        </div>
                    </div>
                </CardContent>
            </Card>
        </div>
    );
};
