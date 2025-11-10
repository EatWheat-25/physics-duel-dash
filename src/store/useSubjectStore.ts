import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export type Subject = 'physics' | 'maths';
export type Mode = 'study' | 'daily' | 'ranked' | 'quick';
export type Chapter = string;

interface SubjectStore {
  subject: Subject;
  mode: Mode | null;
  chapter: Chapter | null;
  setSubject: (subject: Subject) => void;
  setMode: (mode: Mode | null) => void;
  setChapter: (chapter: Chapter | null) => void;
  setSelection: (subject: Subject, mode: Mode, chapter?: Chapter) => void;
}

export const useSubjectStore = create<SubjectStore>()(
  persist(
    (set) => ({
      subject: 'physics',
      mode: null,
      chapter: null,
      setSubject: (subject) => set({ subject }),
      setMode: (mode) => set({ mode }),
      setChapter: (chapter) => set({ chapter }),
      setSelection: (subject, mode, chapter = null) =>
        set({ subject, mode, chapter }),
    }),
    {
      name: 'academy_ui',
    }
  )
);
