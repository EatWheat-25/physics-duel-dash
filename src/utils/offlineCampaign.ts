import type { QuestionDifficulty, QuestionSubject } from '@/types/questions';

export const OFFLINE_LEVELS = 100;
export const QUESTIONS_PER_LEVEL = 3;
export const HEARTS_PER_LEVEL = 4;
export const LEVELS_PER_STAGE = 10;
export const INITIAL_UNLOCKED_CHAPTERS = 3;
export const CHAPTERS_PER_STAGE_INCREMENT = 3;

export interface OfflineProgress {
  subject: QuestionSubject;
  currentLevel: number;
  completedLevels: number[];
  unlockedStage: number;
  updatedAt: string;
}

const PROGRESS_KEY_PREFIX = 'bn_offline_progress_v1';
const SUBJECT_KEY = 'bn_offline_subject_v1';

const clampLevel = (level: number) => Math.min(Math.max(Math.floor(level), 1), OFFLINE_LEVELS);

const uniqueSortedLevels = (levels: number[]) =>
  Array.from(new Set(levels.map((level) => clampLevel(level)))).sort((a, b) => a - b);

export const createDefaultProgress = (subject: QuestionSubject): OfflineProgress => ({
  subject,
  currentLevel: 1,
  completedLevels: [],
  unlockedStage: 1,
  updatedAt: new Date().toISOString(),
});

export const loadOfflineProgress = (subject: QuestionSubject): OfflineProgress => {
  try {
    const raw = localStorage.getItem(`${PROGRESS_KEY_PREFIX}_${subject}`);
    if (!raw) return createDefaultProgress(subject);
    const parsed = JSON.parse(raw) as Partial<OfflineProgress>;
    if (!parsed || typeof parsed !== 'object') return createDefaultProgress(subject);

    const completedLevels = uniqueSortedLevels(Array.isArray(parsed.completedLevels) ? parsed.completedLevels : []);
    const currentLevel = clampLevel(typeof parsed.currentLevel === 'number' ? parsed.currentLevel : 1);
    const unlockedStage = computeUnlockedStage(completedLevels);

    return {
      subject,
      currentLevel,
      completedLevels,
      unlockedStage,
      updatedAt: typeof parsed.updatedAt === 'string' ? parsed.updatedAt : new Date().toISOString(),
    };
  } catch {
    return createDefaultProgress(subject);
  }
};

export const saveOfflineProgress = (progress: OfflineProgress) => {
  try {
    const safe: OfflineProgress = {
      ...progress,
      currentLevel: clampLevel(progress.currentLevel),
      completedLevels: uniqueSortedLevels(progress.completedLevels),
      unlockedStage: Math.min(Math.max(progress.unlockedStage, 1), Math.ceil(OFFLINE_LEVELS / LEVELS_PER_STAGE)),
      updatedAt: new Date().toISOString(),
    };
    localStorage.setItem(`${PROGRESS_KEY_PREFIX}_${progress.subject}`, JSON.stringify(safe));
  } catch {
    // ignore
  }
};

export const loadOfflineSubject = (): QuestionSubject => {
  try {
    const raw = localStorage.getItem(SUBJECT_KEY);
    if (raw === 'math' || raw === 'physics' || raw === 'chemistry') return raw;
  } catch {
    // ignore
  }
  return 'math';
};

export const saveOfflineSubject = (subject: QuestionSubject) => {
  try {
    localStorage.setItem(SUBJECT_KEY, subject);
  } catch {
    // ignore
  }
};

export const getHighestContiguousLevel = (completedLevels: number[]) => {
  const set = new Set(completedLevels);
  let level = 1;
  while (set.has(level)) level += 1;
  return level - 1;
};

export const computeUnlockedStage = (completedLevels: number[]) => {
  const highestContiguous = getHighestContiguousLevel(completedLevels);
  const stage = Math.floor(Math.max(highestContiguous - 1, 0) / LEVELS_PER_STAGE) + 1;
  return Math.min(Math.max(stage, 1), Math.ceil(OFFLINE_LEVELS / LEVELS_PER_STAGE));
};

export const isLevelUnlocked = (progress: OfflineProgress, level: number) =>
  clampLevel(level) <= progress.unlockedStage * LEVELS_PER_STAGE;

export const getStageForLevel = (level: number) =>
  Math.min(Math.max(Math.ceil(clampLevel(level) / LEVELS_PER_STAGE), 1), Math.ceil(OFFLINE_LEVELS / LEVELS_PER_STAGE));

export const getStageRange = (stage: number) => {
  const safeStage = Math.min(Math.max(Math.floor(stage), 1), Math.ceil(OFFLINE_LEVELS / LEVELS_PER_STAGE));
  const start = (safeStage - 1) * LEVELS_PER_STAGE + 1;
  const end = Math.min(safeStage * LEVELS_PER_STAGE, OFFLINE_LEVELS);
  return { start, end };
};

export const getDifficultyForLevel = (level: number): QuestionDifficulty => {
  const safeLevel = clampLevel(level);
  if (safeLevel <= 33) return 'easy';
  if (safeLevel <= 66) return 'medium';
  return 'hard';
};

export const getUnlockedChapterCount = (level: number, totalChapters: number) => {
  const increments = Math.floor((clampLevel(level) - 1) / LEVELS_PER_STAGE);
  const unlocked = INITIAL_UNLOCKED_CHAPTERS + CHAPTERS_PER_STAGE_INCREMENT * increments;
  return Math.min(Math.max(unlocked, 1), Math.max(totalChapters, 1));
};

export const getUnlockedChapters = (chapters: string[], level: number) => {
  if (!chapters.length) return [];
  const unlockedCount = getUnlockedChapterCount(level, chapters.length);
  return chapters.slice(0, unlockedCount);
};

export const updateProgressOnLevelComplete = (progress: OfflineProgress, level: number) => {
  const completedLevels = uniqueSortedLevels([...progress.completedLevels, clampLevel(level)]);
  const unlockedStage = computeUnlockedStage(completedLevels);
  const nextLevel = clampLevel(level + 1);
  return {
    ...progress,
    completedLevels,
    unlockedStage,
    currentLevel: isLevelUnlocked({ ...progress, completedLevels, unlockedStage }, nextLevel) ? nextLevel : level,
    updatedAt: new Date().toISOString(),
  };
};
