import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { GameMode } from '@/types/gameMode';

interface BattleQueueState {
  pendingBattle: {
    mode: GameMode;
    subject: string;
  } | null;
  setPendingBattle: (mode: GameMode, subject: string) => void;
  clearPendingBattle: () => void;
}

export const useBattleQueueStore = create<BattleQueueState>()(
  persist(
    (set) => ({
      pendingBattle: null,
      setPendingBattle: (mode, subject) => set({ pendingBattle: { mode, subject } }),
      clearPendingBattle: () => set({ pendingBattle: null }),
    }),
    {
      name: 'battle-queue-storage',
    }
  )
);
