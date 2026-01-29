import { supabase } from '@/integrations/supabase/client';

const QUESTION_IMAGE_BUCKET = 'question-images';
const MAX_IMAGE_SIZE_BYTES = 5 * 1024 * 1024; // 5 MB

const extensionByMime: Record<string, string> = {
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
  'image/gif': 'gif',
  'image/svg+xml': 'svg',
};

function sanitizeBaseName(name: string): string {
  const rawBase = name.replace(/\.[^/.]+$/, '');
  const ascii = rawBase.normalize('NFKD').replace(/[^\x00-\x7F]/g, '');
  const safe = ascii.replace(/[^a-zA-Z0-9._-]+/g, '-').replace(/^-+|-+$/g, '');
  return safe.slice(0, 48) || 'image';
}

function resolveExtension(file: File): string {
  const fromName = file.name.split('.').pop()?.toLowerCase() ?? '';
  if (fromName) return fromName;
  return extensionByMime[file.type] || 'bin';
}

function buildStoragePath(file: File, prefix: string): string {
  const base = sanitizeBaseName(file.name);
  const ext = resolveExtension(file);
  const id = typeof crypto !== 'undefined' && 'randomUUID' in crypto
    ? crypto.randomUUID()
    : `${Date.now()}-${Math.random().toString(16).slice(2)}`;
  const safePrefix = prefix.replace(/^\/+|\/+$/g, '') || 'questions';
  return `${safePrefix}/${Date.now()}-${id}-${base}.${ext}`;
}

export async function uploadQuestionImage(
  file: File,
  options?: { prefix?: string }
): Promise<{ publicUrl: string; path: string }> {
  if (!file) {
    throw new Error('No file selected for upload.');
  }
  if (file.type && !file.type.startsWith('image/')) {
    throw new Error('Only image files can be uploaded.');
  }
  if (file.size > MAX_IMAGE_SIZE_BYTES) {
    throw new Error('Image exceeds 5 MB size limit.');
  }

  const path = buildStoragePath(file, options?.prefix ?? 'questions');
  const { data, error } = await supabase
    .storage
    .from(QUESTION_IMAGE_BUCKET)
    .upload(path, file, { cacheControl: '3600', upsert: false });

  if (error) {
    throw new Error(error.message || 'Failed to upload image.');
  }

  const { data: publicData } = supabase
    .storage
    .from(QUESTION_IMAGE_BUCKET)
    .getPublicUrl(data?.path || path);

  if (!publicData?.publicUrl) {
    throw new Error('Unable to generate a public URL for the image.');
  }

  return { publicUrl: publicData.publicUrl, path: data?.path || path };
}
