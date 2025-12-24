import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export type MatchmakingSubject = 'physics' | 'math' | 'chemistry';
export type MatchmakingLevel = 'A1' | 'A2' | 'Both';

interface MatchmakingPrefsState {
  subject: MatchmakingSubject | null;
  level: MatchmakingLevel | null;
  setSubject: (subject: MatchmakingSubject | null) => void;
  setLevel: (level: MatchmakingLevel | null) => void;
  setPrefs: (subject: MatchmakingSubject, level: MatchmakingLevel) => void;
  clear: () => void;
}

export const useMatchmakingPrefs = create<MatchmakingPrefsState>()(
  persist(
    (set) => ({
      subject: null,
      level: null,
      setSubject: (subject) => set({ subject }),
      setLevel: (level) => set({ level }),
      setPrefs: (subject, level) => set({ subject, level }),
      clear: () => set({ subject: null, level: null }),
    }),
    {
      name: 'bn_matchmaking_prefs',
    }
  )
);


