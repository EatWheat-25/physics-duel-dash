import React from 'react';
import { motion } from 'framer-motion';

interface AnswerGridProps {
    options: string[];
    disabled: boolean;
    selectedIndex: number | null;
    correctIndex: number | null; // Only passed when showing results
    onSelect: (index: number) => void;
}

export const AnswerGrid: React.FC<AnswerGridProps> = ({
    options,
    disabled,
    selectedIndex,
    correctIndex,
    onSelect
}) => {
    const getButtonStyle = (index: number) => {
        // Result phase
        if (correctIndex !== null) {
            if (index === correctIndex) return 'bg-emerald-500/20 border-emerald-500 text-emerald-200 shadow-[0_0_15px_rgba(16,185,129,0.2)]';
            if (index === selectedIndex) return 'bg-red-500/20 border-red-500 text-red-200'; // Wrong selection
            return 'bg-white/5 border-white/10 opacity-50';
        }

        // Selection phase
        if (index === selectedIndex) {
            return 'bg-primary/20 border-primary text-primary-foreground shadow-[0_0_15px_rgba(var(--primary),0.3)]';
        }

        // Default state
        if (disabled) return 'bg-white/5 border-white/10 opacity-50 cursor-not-allowed';
        return 'bg-white/5 border-white/10 hover:bg-white/10 hover:border-white/30 hover:scale-[1.02] active:scale-[0.98]';
    };

    return (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 w-full">
            {options.map((option, index) => (
                <motion.button
                    key={index}
                    onClick={() => !disabled && onSelect(index)}
                    className={`
            relative p-6 rounded-xl border-2 text-left transition-all duration-200
            flex items-center gap-4 group overflow-hidden
            ${getButtonStyle(index)}
          `}
                    disabled={disabled}
                    whileTap={!disabled ? { scale: 0.98 } : {}}
                >
                    {/* Option Letter */}
                    <div className={`
            flex items-center justify-center w-8 h-8 rounded-lg text-sm font-bold border
            ${index === selectedIndex || index === correctIndex
                            ? 'border-current bg-current/10'
                            : 'border-white/20 bg-black/20 text-muted-foreground group-hover:border-white/40'}
          `}>
                        {String.fromCharCode(65 + index)}
                    </div>

                    {/* Option Text */}
                    <span className="font-medium text-lg leading-snug">{option}</span>

                    {/* Selection Indicator (Corner) */}
                    {(index === selectedIndex || index === correctIndex) && (
                        <motion.div
                            layoutId="selection-corner"
                            className="absolute top-0 right-0 w-0 h-0 border-t-[20px] border-r-[20px] border-t-transparent border-r-current opacity-50"
                        />
                    )}
                </motion.button>
            ))}
        </div>
    );
};
