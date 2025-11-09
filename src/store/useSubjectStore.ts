import { create } from 'zustand';
import { persist } from 'zustand/middleware';

type Subject = 'physics' | 'maths';

interface SubjectStore {
  subject: Subject;
  setSubject: (subject: Subject) => void;
}

export const useSubjectStore = create<SubjectStore>()(
  persist(
    (set) => ({
      subject: 'physics',
      setSubject: (subject) => set({ subject }),
    }),
    {
      name: 'academy_ui',
    }
  )
);
