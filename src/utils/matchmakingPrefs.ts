export type MatchmakingLevel = 'A1' | 'A2';
export type MatchmakingPrefs = {
  subject: string;
  level: MatchmakingLevel;
};

const STORAGE_KEY = 'bn_matchmaking_prefs_v1';

function normalizeSubject(subject: string): string {
  return subject === 'maths' ? 'math' : subject;
}

function normalizeLevel(level: string): MatchmakingLevel | null {
  const upper = level.toUpperCase();
  if (upper === 'A1') return 'A1';
  if (upper === 'A2') return 'A2';
  return null;
}

export function loadMatchmakingPrefs(): MatchmakingPrefs | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<MatchmakingPrefs>;
    if (!parsed || typeof parsed !== 'object') return null;

    const subject =
      typeof parsed.subject === 'string' && parsed.subject.trim().length > 0
        ? normalizeSubject(parsed.subject.trim())
        : null;
    const level = typeof parsed.level === 'string' ? normalizeLevel(parsed.level) : null;

    if (!subject || !level) return null;
    return { subject, level };
  } catch {
    return null;
  }
}

export function saveMatchmakingPrefs(prefs: MatchmakingPrefs): void {
  try {
    const safe: MatchmakingPrefs = {
      subject: normalizeSubject(prefs.subject),
      level: prefs.level,
    };
    localStorage.setItem(STORAGE_KEY, JSON.stringify(safe));
  } catch {
    // ignore (private mode, storage full, etc.)
  }
}


