import React from 'react';
import { ArrowLeft } from 'lucide-react';
import TugOfWarBar from '../TugOfWarBar';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';

interface GameHeaderProps {
    player: {
        username: string;
        avatarUrl?: string;
    };
    opponent: {
        username: string;
        avatarUrl?: string;
    };
    currentRound: number;
    totalRounds: number;
    tugPosition: number;
    maxSteps: number;
    onBack?: () => void;
}

export const GameHeader: React.FC<GameHeaderProps> = ({
    player,
    opponent,
    currentRound,
    totalRounds,
    tugPosition,
    maxSteps,
    onBack
}) => {
    return (
        <div className="relative z-20 w-full pt-6 pb-4">
            <div className="flex items-center justify-between mb-6">
                <button
                    onClick={onBack}
                    className="flex items-center gap-2 px-4 py-2 rounded-lg bg-black/40 hover:bg-black/60 transition-colors backdrop-blur-md border border-white/10"
                >
                    <ArrowLeft className="w-4 h-4" />
                    <span className="hidden sm:inline">Back</span>
                </button>

                <div className="flex items-center gap-4">
                    <div className="text-right hidden sm:block">
                        <div className="font-bold text-white">{player.username}</div>
                        <div className="text-xs text-emerald-400">YOU</div>
                    </div>
                    <Avatar className="h-10 w-10 border-2 border-emerald-500/50 shadow-[0_0_15px_rgba(16,185,129,0.3)]">
                        <AvatarImage src={player.avatarUrl} />
                        <AvatarFallback className="bg-emerald-900 text-emerald-200">
                            {player.username.substring(0, 2).toUpperCase()}
                        </AvatarFallback>
                    </Avatar>

                    <div className="px-4 py-1 rounded-full bg-black/60 backdrop-blur-md border border-white/10 text-sm font-mono text-white shadow-[inset_0_2px_8px_rgba(0,0,0,0.4)]">
                        ROUND {currentRound}/{totalRounds}
                    </div>

                    <Avatar className="h-10 w-10 border-2 border-red-500/50 shadow-[0_0_15px_rgba(239,68,68,0.3)]">
                        <AvatarImage src={opponent.avatarUrl} />
                        <AvatarFallback className="bg-red-900 text-red-200">
                            {opponent.username.substring(0, 2).toUpperCase()}
                        </AvatarFallback>
                    </Avatar>
                    <div className="text-left hidden sm:block">
                        <div className="font-bold text-white">{opponent.username}</div>
                        <div className="text-xs text-red-400">OPPONENT</div>
                    </div>
                </div>

                <div className="w-[88px]" /> {/* Spacer for balance */}
            </div>

            <TugOfWarBar position={tugPosition} maxSteps={maxSteps} />
        </div>
    );
};
