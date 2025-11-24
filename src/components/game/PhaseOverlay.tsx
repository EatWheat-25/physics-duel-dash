import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';

interface PhaseOverlayProps {
    isVisible: boolean;
    type: 'round_start' | 'vs' | 'victory' | 'defeat' | 'draw';
    title: string;
    subtitle?: string;
    onComplete?: () => void;
}

export const PhaseOverlay: React.FC<PhaseOverlayProps> = ({
    isVisible,
    type,
    title,
    subtitle,
}) => {
    const getGradient = () => {
        switch (type) {
            case 'victory': return 'from-emerald-400 to-cyan-500';
            case 'defeat': return 'from-red-500 to-orange-500';
            case 'draw': return 'from-yellow-400 to-orange-400';
            default: return 'from-white to-gray-400';
        }
    };

    return (
        <AnimatePresence>
            {isVisible && (
                <motion.div
                    initial={{ opacity: 0, backdropFilter: 'blur(0px)' }}
                    animate={{ opacity: 1, backdropFilter: 'blur(10px)' }}
                    exit={{ opacity: 0, backdropFilter: 'blur(0px)' }}
                    className="fixed inset-0 z-50 flex items-center justify-center bg-black/60"
                >
                    <motion.div
                        initial={{ scale: 0.5, opacity: 0 }}
                        animate={{ scale: 1, opacity: 1 }}
                        exit={{ scale: 1.5, opacity: 0 }}
                        transition={{ type: 'spring', damping: 15 }}
                        className="text-center p-8"
                    >
                        <h1 className={`text-6xl md:text-8xl font-black italic tracking-tighter bg-gradient-to-r ${getGradient()} bg-clip-text text-transparent drop-shadow-2xl`}>
                            {title}
                        </h1>
                        {subtitle && (
                            <motion.p
                                initial={{ y: 20, opacity: 0 }}
                                animate={{ y: 0, opacity: 1 }}
                                transition={{ delay: 0.2 }}
                                className="mt-4 text-xl md:text-2xl text-white/80 font-bold tracking-widest uppercase"
                            >
                                {subtitle}
                            </motion.p>
                        )}
                    </motion.div>
                </motion.div>
            )}
        </AnimatePresence>
    );
};
