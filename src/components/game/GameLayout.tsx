import React from 'react';
import AnimatedBackground from '../AnimatedBackground';

interface GameLayoutProps {
    children: React.ReactNode;
    className?: string;
}

export const GameLayout: React.FC<GameLayoutProps> = ({ children, className = '' }) => {
    return (
        <div className={`min-h-screen relative overflow-hidden flex flex-col bg-gradient-to-br from-[hsl(222,40%,3%)] via-[hsl(222,45%,6%)] to-[hsl(222,40%,3%)] ${className}`}>
            <AnimatedBackground />
            <div className="relative z-10 flex-1 flex flex-col w-full max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
                {children}
            </div>
        </div>
    );
};
