import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { AnswerGrid } from './AnswerGrid';
import { Clock } from 'lucide-react';

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
                            transition={{ ease: "linear", duration: 0.1 }} // Smooth updates
                        />
                    </div>

                    <div className="p-8 md:p-12 space-y-8">
                        {/* Header / Timer Text */}
                        <div className="flex items-center justify-between text-sm font-bold tracking-wider uppercase text-muted-foreground">
                            <div className="flex items-center gap-2">
                                <Clock className="w-4 h-4" />
                                <span>{isThinking ? 'Reading Time' : isResult ? 'Round Over' : 'Choose Answer'}</span>
                            </div>
                            <div className={`${timeLeft < 3000 ? 'text-red-500 animate-pulse' : ''}`}>
                                {(timeLeft / 1000).toFixed(1)}s
                            </div>
                        </div>

                        {/* Question Text */}
                        <div className="space-y-6 text-center">
                            <h2 className="text-2xl md:text-4xl font-bold text-white leading-tight">
                                {question.text}
                            </h2>
                            {question.imageUrl && (
                                <div className="relative rounded-xl overflow-hidden border border-white/10 max-h-64 mx-auto inline-block">
                                    <img src={question.imageUrl} alt="Question" className="max-w-full h-auto object-contain" />
                                </div>
                            )}
                        </div>

                        {/* Divider */}
                        <div className="h-px w-full bg-gradient-to-r from-transparent via-white/20 to-transparent" />

                        {/* Answer Grid */}
                        <div className={`transition-opacity duration-300 ${isThinking ? 'opacity-50 blur-sm pointer-events-none' : 'opacity-100'}`}>
                            <AnswerGrid
                                options={question.options}
                                disabled={isThinking || isResult || selectedIndex !== null}
                                selectedIndex={selectedIndex}
                                correctIndex={correctIndex}
                                onSelect={onAnswer}
                            />
                        </div>
                    </div>

                    {/* Phase Overlay (Optional - e.g. "Wait for options") */}
                    {isThinking && (
                        <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                            <motion.div
                                initial={{ opacity: 0, scale: 0.9 }}
                                animate={{ opacity: 1, scale: 1 }}
                                className="bg-black/60 backdrop-blur-sm px-6 py-3 rounded-full border border-white/10 text-blue-200 font-bold tracking-widest uppercase"
                            >
                                Study the Question
                            </motion.div>
                        </div>
                    )}
                </motion.div>
            </AnimatePresence>
        </div>
    );
};
