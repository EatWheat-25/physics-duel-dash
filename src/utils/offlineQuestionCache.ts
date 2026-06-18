import { supabase } from '@/integrations/supabase/client';
import type { QuestionSubject } from '@/types/questions';
import type { StepBasedQuestion, QuestionSubStep, QuestionStep } from '@/types/question-contract';
import { dbRowToQuestion } from '@/lib/question-contract';
import {
  QUESTIONS_PER_LEVEL,
  getDifficultyForLevel,
  getUnlockedChapters,
} from '@/utils/offlineCampaign';

const CACHE_KEY_PREFIX = 'bn_offline_question_cache_v1';
const USED_KEY_PREFIX = 'bn_offline_used_questions_v1';

type OfflineQuestion = StepBasedQuestion;
type OfflineQuestionStep = QuestionStep & { subSteps?: QuestionSubStep[] };

interface CachedBank {
  subject: QuestionSubject;
  updatedAt: string;
  questions: OfflineQuestion[];
}

const normalizeQuestions = (questions: OfflineQuestion[]) =>
  questions.filter((question) => Array.isArray(question.steps) && question.steps.length > 0);

export const loadCachedQuestionBank = (subject: QuestionSubject): CachedBank | null => {
  try {
    const raw = localStorage.getItem(`${CACHE_KEY_PREFIX}_${subject}`);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as CachedBank;
    if (!parsed || !Array.isArray(parsed.questions)) return null;
    return {
      subject,
      updatedAt: typeof parsed.updatedAt === 'string' ? parsed.updatedAt : new Date().toISOString(),
      questions: normalizeQuestions(parsed.questions),
    };
  } catch {
    return null;
  }
};

export const saveCachedQuestionBank = (subject: QuestionSubject, questions: OfflineQuestion[]) => {
  try {
    const payload: CachedBank = {
      subject,
      updatedAt: new Date().toISOString(),
      questions: normalizeQuestions(questions),
    };
    localStorage.setItem(`${CACHE_KEY_PREFIX}_${subject}`, JSON.stringify(payload));
  } catch {
    // ignore
  }
};

export const refreshQuestionBank = async (subject: QuestionSubject) => {
  // Sanitized server-side fetch (steps come back without answer keys).
  const { data, error } = await (supabase.rpc as any)('get_questions_for_play_v1', {
    p_subject: subject,
  });

  if (error) throw error;
  const mapped = (data || []).map((row) => {
    try {
      return dbRowToQuestion(row);
    } catch {
      return null;
    }
  }).filter((question): question is OfflineQuestion => Boolean(question));

  const normalized = normalizeQuestions(mapped);
  saveCachedQuestionBank(subject, normalized);
  return normalized;
};

export const loadUsedQuestionOrder = (subject: QuestionSubject) => {
  try {
    const raw = localStorage.getItem(`${USED_KEY_PREFIX}_${subject}`);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as string[];
    if (!Array.isArray(parsed)) return [];
    return parsed.filter((id) => typeof id === 'string');
  } catch {
    return [];
  }
};

export const saveUsedQuestionOrder = (subject: QuestionSubject, order: string[]) => {
  try {
    localStorage.setItem(`${USED_KEY_PREFIX}_${subject}`, JSON.stringify(order));
  } catch {
    // ignore
  }
};

const shuffle = <T,>(list: T[]) => {
  const arr = [...list];
  for (let i = arr.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
};

const sortByLRU = (list: OfflineQuestion[], usedOrder: string[]) => {
  const rank = new Map<string, number>();
  usedOrder.forEach((id, idx) => rank.set(id, idx));
  return [...list].sort((a, b) => {
    const aRank = rank.get(a.id) ?? Number.MAX_SAFE_INTEGER;
    const bRank = rank.get(b.id) ?? Number.MAX_SAFE_INTEGER;
    return aRank - bRank;
  });
};

const getChapterList = (questions: OfflineQuestion[]) => {
  const chapters = Array.from(new Set(questions.map((q) => q.chapter).filter(Boolean)));
  return chapters.sort((a, b) => a.localeCompare(b));
};

const pickBalanced = (
  pool: OfflineQuestion[],
  usedOrder: string[],
  count: number
) => {
  const usedSet = new Set(usedOrder);
  const selected: OfflineQuestion[] = [];
  const selectedIds = new Set<string>();
  const selectedChapters = new Set<string>();

  const pickDistinctChapters = (candidates: OfflineQuestion[]) => {
    const chapterBuckets = new Map<string, OfflineQuestion[]>();
    for (const question of candidates) {
      if (selectedIds.has(question.id)) continue;
      const chapter = question.chapter || 'General';
      if (!chapterBuckets.has(chapter)) chapterBuckets.set(chapter, []);
      chapterBuckets.get(chapter)!.push(question);
    }
    const chapterEntries = shuffle(Array.from(chapterBuckets.entries()));
    for (const [, list] of chapterEntries) {
      if (selected.length >= count) break;
      const candidate = list.find((q) => !selectedIds.has(q.id));
      if (!candidate) continue;
      const chapter = candidate.chapter || 'General';
      if (selectedChapters.has(chapter)) continue;
      selected.push(candidate);
      selectedIds.add(candidate.id);
      selectedChapters.add(chapter);
    }
  };

  const pickAny = (candidates: OfflineQuestion[]) => {
    for (const question of candidates) {
      if (selected.length >= count) break;
      if (selectedIds.has(question.id)) continue;
      selected.push(question);
      selectedIds.add(question.id);
    }
  };

  const unused = shuffle(pool.filter((question) => !usedSet.has(question.id)));
  pickDistinctChapters(unused);
  pickAny(unused);

  if (selected.length < count) {
    const used = sortByLRU(pool.filter((question) => usedSet.has(question.id)), usedOrder);
    pickDistinctChapters(used);
    pickAny(used);
  }

  return selected.slice(0, count);
};

export const selectQuestionsForLevel = (
  questions: OfflineQuestion[],
  subject: QuestionSubject,
  level: number,
  usedOrder: string[]
) => {
  const subjectQuestions = questions.filter((q) => q.subject === subject);
  const chapters = getChapterList(subjectQuestions);
  const unlockedChapters = getUnlockedChapters(chapters, level);
  const difficulty = getDifficultyForLevel(level);

  let pool = subjectQuestions.filter(
    (q) => unlockedChapters.includes(q.chapter) && q.difficulty === difficulty
  );

  if (pool.length < QUESTIONS_PER_LEVEL) {
    pool = subjectQuestions.filter((q) => unlockedChapters.includes(q.chapter));
  }

  if (pool.length < QUESTIONS_PER_LEVEL) {
    pool = subjectQuestions;
  }

  const picked = pickBalanced(pool, usedOrder, QUESTIONS_PER_LEVEL);
  const nextUsed = [...usedOrder];
  for (const question of picked) {
    const idx = nextUsed.indexOf(question.id);
    if (idx >= 0) nextUsed.splice(idx, 1);
    nextUsed.push(question.id);
  }

  return {
    questions: picked as OfflineQuestion[],
    usedOrder: nextUsed,
    unlockedChapters,
    difficulty,
  };
};

export const getStepSubSteps = (step: QuestionStep | null) =>
  (step as OfflineQuestionStep | null)?.subSteps ?? [];
