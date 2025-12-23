import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { AnswerGrid } from './AnswerGrid';
import { Clock } from 'lucide-react';
import { MathText } from '@/components/math/MathText';

interface ActiveQuestionProps {
    question: {
        id: string;
        text: string;
        options: string[];
        imageUrl?: string;
    };
    phase: 'thinking' | 'choosing' | 'result';
    timeLeft: number; // ms
    totalTime: number; // ms
    selectedIndex: number | null;
    correctIndex: number | null;
    onAnswer: (index: number) => void;
}

export const ActiveQuestion: React.FC<ActiveQuestionProps> = ({
    question,
    phase,
    timeLeft,
    totalTime,
    selectedIndex,
    correctIndex,
    onAnswer
}) => {
    const progress = Math.max(0, Math.min(100, (timeLeft / totalTime) * 100));
    const isThinking = phase === 'thinking';
    const isResult = phase === 'result';
    const seconds = Math.ceil(timeLeft / 1000);

    // Debug logging
    console.log('[ActiveQuestion] Render:', {
        phase,
        isThinking,
        isResult,
        selectedIndex,
        disabled: isResult || selectedIndex !== null,
        seconds
    });

    return (
        <div className="w-full max-w-4xl mx-auto perspective-1000">
            <AnimatePresence mode="wait">
                <motion.div
                    key={question.id}
                    initial={{ opacity: 0, rotateX: -10, y: 50 }}
                    animate={{ opacity: 1, rotateX: 0, y: 0 }}
                    exit={{ opacity: 0, rotateX: 10, y: -50 }}
                    transition={{ duration: 0.5, type: 'spring' }}
                    className="relative bg-black/40 backdrop-blur-xl border border-white/10 rounded-3xl overflow-hidden shadow-2xl"
                >
                    {/* Timer Bar */}
                    <div className="absolute top-0 left-0 w-full h-1 bg-white/10">
                        <motion.div
                            className={`h-full ${isThinking ? 'bg-blue-500' : 'bg-yellow-500'}`}
                            animate={{ width: `${progress}%` }}
                            transition={{ ease: "linear", duration: 0.1 }}
                        />
                    </div>

                    <div className="p-8 md:p-12 space-y-8">
                        {/* Prominent Centered Timer */}
                        <div className="flex flex-col items-center gap-2">
                            <motion.div
                                className={`text-6xl font-bold tracking-tight ${seconds <= 10 ? 'text-red-500 animate-pulse' :
                                    isThinking ? 'text-blue-400' : 'text-yellow-400'
                                    }`}
                                key={seconds}
                                initial={{ scale: 1.1 }}
                                animate={{ scale: 1 }}
                                transition={{ duration: 0.2 }}
                            >
                                {seconds}
                            </motion.div>
                            <div className="flex items-center gap-2 text-sm font-bold tracking-wider uppercase text-muted-foreground">
                                <Clock className="w-4 h-4" />
                                <span>{isThinking ? 'Reading Time' : isResult ? 'Round Over' : 'Choose Your Answer'}</span>
                            </div>
                        </div>

                        {/* Question Text */}
                        <div className="space-y-6 text-center">
                            <h2 className="text-2xl md:text-4xl font-bold text-white leading-tight">
                                <MathText text={question.text} />
                            </h2>
                            {question.imageUrl && (
                                <div className="relative rounded-xl overflow-hidden border border-white/10 max-h-64 mx-auto inline-block">
                                    <img src={question.imageUrl} alt="Question" className="max-w-full h-auto object-contain" />
                                </div>
                            )}
                        </div>

                        {/* Divider */}
                        <div className="h-px w-full bg-gradient-to-r from-transparent via-white/20 to-transparent" />

                        {/* Answer Grid - Completely hidden during thinking phase */}
                        {!isThinking ? (
                            <div className="transition-all duration-500">
                                <AnswerGrid
                                    options={question.options}
                                    disabled={isResult || selectedIndex !== null}
                                    selectedIndex={selectedIndex}
                                    correctIndex={correctIndex}
                                    onSelect={onAnswer}
                                />
                            </div>
                        ) : (
                            <div className="text-center py-12 text-muted-foreground">
                                <p className="text-lg">Options will appear when the timer reaches 0</p>
                            </div>
                        )}
                    </div>

                    {/* Phase Overlay - Now just shows a message, doesn't cover everything */}
                    {isThinking && (
                        <div className="absolute top-24 left-0 right-0 flex items-center justify-center pointer-events-none">
                            <motion.div
                                initial={{ opacity: 0, y: -20 }}
                                animate={{ opacity: 1, y: 0 }}
                                className="bg-blue-500/20 backdrop-blur-sm px-6 py-3 rounded-full border border-blue-500/50 text-blue-200 font-bold tracking-widest uppercase text-sm"
                            >
                                📖 Study the Question
                            </motion.div>
                        </div>
                    )}
                </motion.div>
            </AnimatePresence>
        </div>
    );
};
