import { useCallback, useEffect, useMemo, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';
import {
  Loader2,
  Play,
  Save,
  Trash2,
  Copy,
  RefreshCw,
  Terminal,
  ImagePlus,
} from 'lucide-react';
import {
  ensurePyodide,
  getPyodideStatus,
  onPyodideStatus,
  runDiagramScript,
  type DiagramRunResult,
  type DiagramSvg,
  type PyodideStatus,
} from '@/lib/pyodideRunner';

const QUESTION_IMAGE_BUCKET = 'question-images';

const SAMPLE_SCRIPT = `import matplotlib
import matplotlib.pyplot as plt

fig, ax = plt.subplots(figsize=(4, 3))
ax.plot([0, 1, 2, 3], [0, 1, 4, 9])
ax.set_xlabel("time / s")
ax.set_ylabel("displacement / m")
ax.set_title("Example")

# Save as SVG - the library harvests any *.svg files the script writes.
fig.savefig("diagram.svg")
`;

export interface DiagramRow {
  id: string;
  code: string;
  title: string | null;
  python_source: string | null;
  svg: string;
  public_url: string;
  created_at: string;
  updated_at: string;
}

interface DiagramStudioProps {
  /**
   * When provided, an "Apply to this question" action is shown. It is called
   * with a cache-busted public URL after the previewed SVG is uploaded to
   * storage (saved to the library if a code is set, otherwise a one-off file).
   */
  onApply?: (url: string) => void;
  /** Show the saved-diagrams grid (with load/copy/delete). */
  showLibrary?: boolean;
  /** Tighter layout for embedding inside the question form. */
  compact?: boolean;
  initialSource?: string;
}

function sanitizeCode(raw: string): string {
  return raw
    .trim()
    .replace(/[^a-zA-Z0-9._-]+/g, '')
    .slice(0, 24);
}

export function DiagramStudio({ onApply, showLibrary = false, compact = false, initialSource }: DiagramStudioProps) {
  const [pythonSource, setPythonSource] = useState<string>(initialSource ?? SAMPLE_SCRIPT);
  const [code, setCode] = useState<string>('');
  const [title, setTitle] = useState<string>('');

  const [pyStatus, setPyStatus] = useState<PyodideStatus>(getPyodideStatus());
  const [running, setRunning] = useState(false);
  const [runResult, setRunResult] = useState<DiagramRunResult | null>(null);
  const [selectedSvgIndex, setSelectedSvgIndex] = useState(0);

  const [saving, setSaving] = useState(false);
  const [applying, setApplying] = useState(false);
  const [library, setLibrary] = useState<DiagramRow[]>([]);
  const [loadingLibrary, setLoadingLibrary] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  useEffect(() => onPyodideStatus(setPyStatus), []);

  const selectedSvg: DiagramSvg | null = useMemo(() => {
    if (!runResult || runResult.svgs.length === 0) return null;
    return runResult.svgs[Math.min(selectedSvgIndex, runResult.svgs.length - 1)] ?? null;
  }, [runResult, selectedSvgIndex]);

  const loadLibrary = useCallback(async () => {
    setLoadingLibrary(true);
    try {
      const { data, error } = await supabase
        .from('question_diagrams')
        .select('*')
        .order('updated_at', { ascending: false });
      if (error) throw error;
      setLibrary((data ?? []) as DiagramRow[]);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to load diagram library.');
    } finally {
      setLoadingLibrary(false);
    }
  }, []);

  useEffect(() => {
    if (showLibrary) void loadLibrary();
  }, [showLibrary, loadLibrary]);

  const handleRun = useCallback(async () => {
    setRunning(true);
    setRunResult(null);
    setSelectedSvgIndex(0);
    try {
      const result = await runDiagramScript(pythonSource);
      setRunResult(result);
      if (result.error) {
        toast.error('Script finished with an error - see the log below.');
      } else if (result.svgs.length === 0) {
        toast.warning('Script ran but produced no SVG. Make sure it calls fig.savefig("name.svg").');
      } else {
        toast.success(`Rendered ${result.svgs.length} image${result.svgs.length > 1 ? 's' : ''}.`);
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to run the script.');
    } finally {
      setRunning(false);
    }
  }, [pythonSource]);

  /** Upload the previewed SVG to the library (requires a code) and refresh the grid. */
  const handleSave = useCallback(async (): Promise<string | null> => {
    const cleanCode = sanitizeCode(code);
    if (!cleanCode) {
      toast.error('Enter a code for this diagram (e.g. 0101).');
      return null;
    }
    if (!selectedSvg) {
      toast.error('Run the script and get a preview before saving.');
      return null;
    }

    setSaving(true);
    try {
      const path = `diagrams/${cleanCode}.svg`;
      const blob = new Blob([selectedSvg.svg], { type: 'image/svg+xml' });

      const { error: uploadError } = await supabase.storage
        .from(QUESTION_IMAGE_BUCKET)
        .upload(path, blob, { cacheControl: '3600', upsert: true, contentType: 'image/svg+xml' });
      if (uploadError) throw uploadError;

      const { data: publicData } = supabase.storage.from(QUESTION_IMAGE_BUCKET).getPublicUrl(path);
      const publicUrl = publicData?.publicUrl;
      if (!publicUrl) throw new Error('Could not resolve a public URL for the uploaded SVG.');

      const { error: upsertError } = await supabase
        .from('question_diagrams')
        .upsert(
          {
            code: cleanCode,
            title: title.trim() || null,
            python_source: pythonSource,
            svg: selectedSvg.svg,
            public_url: publicUrl,
            updated_at: new Date().toISOString(),
          },
          { onConflict: 'code' },
        );
      if (upsertError) throw upsertError;

      toast.success(`Saved diagram "${cleanCode}".`);
      setCode(cleanCode);
      if (showLibrary) await loadLibrary();
      return `${publicUrl}?v=${Date.now()}`;
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to save the diagram.');
      return null;
    } finally {
      setSaving(false);
    }
  }, [code, title, pythonSource, selectedSvg, showLibrary, loadLibrary]);

  /** Apply the previewed SVG to the parent (question). Saves to library if a code is set. */
  const handleApply = useCallback(async () => {
    if (!onApply) return;
    if (!selectedSvg) {
      toast.error('Run the script and get a preview before applying.');
      return;
    }
    setApplying(true);
    try {
      const cleanCode = sanitizeCode(code);
      if (cleanCode) {
        const url = await handleSave();
        if (url) onApply(url);
        return;
      }
      // No code: one-off upload so the question still gets a stable URL.
      const id = typeof crypto !== 'undefined' && 'randomUUID' in crypto ? crypto.randomUUID() : `${Date.now()}`;
      const path = `diagrams/adhoc/${id}.svg`;
      const blob = new Blob([selectedSvg.svg], { type: 'image/svg+xml' });
      const { error: uploadError } = await supabase.storage
        .from(QUESTION_IMAGE_BUCKET)
        .upload(path, blob, { cacheControl: '3600', upsert: true, contentType: 'image/svg+xml' });
      if (uploadError) throw uploadError;
      const { data: publicData } = supabase.storage.from(QUESTION_IMAGE_BUCKET).getPublicUrl(path);
      if (!publicData?.publicUrl) throw new Error('Could not resolve a public URL for the uploaded SVG.');
      onApply(`${publicData.publicUrl}?v=${Date.now()}`);
      toast.success('Diagram applied to this question.');
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to apply the diagram.');
    } finally {
      setApplying(false);
    }
  }, [onApply, selectedSvg, code, handleSave]);

  const handleLoadRow = useCallback((row: DiagramRow) => {
    setCode(row.code);
    setTitle(row.title ?? '');
    setPythonSource(row.python_source ?? '');
    setRunResult({ svgs: [{ filename: `${row.code}.svg`, svg: row.svg }], stdout: '', stderr: '', error: null });
    setSelectedSvgIndex(0);
    toast.success(`Loaded "${row.code}" into the editor.`);
  }, []);

  const handleCopyUrl = useCallback(async (url: string) => {
    try {
      await navigator.clipboard.writeText(url);
      toast.success('Public URL copied.');
    } catch {
      toast.error('Could not copy to clipboard.');
    }
  }, []);

  const handleDelete = useCallback(async (row: DiagramRow) => {
    if (!window.confirm(`Delete diagram "${row.code}"? Questions pointing at it will lose their image.`)) return;
    setDeletingId(row.id);
    try {
      const { error: delRowError } = await supabase.from('question_diagrams').delete().eq('id', row.id);
      if (delRowError) throw delRowError;
      await supabase.storage.from(QUESTION_IMAGE_BUCKET).remove([`diagrams/${row.code}.svg`]);
      toast.success(`Deleted "${row.code}".`);
      await loadLibrary();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to delete the diagram.');
    } finally {
      setDeletingId(null);
    }
  }, [loadLibrary]);

  const glassInput =
    'bg-white/5 border-white/10 text-white placeholder:text-white/30 focus:border-cyan-400/50 focus:ring-cyan-400/20';

  const pyStatusLabel: Record<PyodideStatus, string> = {
    idle: 'Python engine not loaded',
    loading: 'Loading Python engine…',
    ready: 'Python engine ready',
    error: 'Python engine failed to load',
  };

  return (
    <div className="space-y-4">
      <div className={`grid grid-cols-1 ${compact ? 'xl:grid-cols-2' : 'lg:grid-cols-2'} gap-4`}>
        {/* Editor column */}
        <div className="space-y-3">
          <div className="rounded-xl border border-white/10 bg-slate-900/50 backdrop-blur p-3">
            <div className="flex items-center justify-between mb-2 gap-2 flex-wrap">
              <label className="text-white/70 font-medium text-sm">matplotlib Python</label>
              <div className="flex items-center gap-2">
                <Badge
                  variant="outline"
                  className={`border-white/20 text-[10px] ${
                    pyStatus === 'ready' ? 'text-emerald-300' : pyStatus === 'error' ? 'text-red-300' : 'text-white/60'
                  }`}
                >
                  {pyStatus === 'loading' && <Loader2 className="w-3 h-3 mr-1 animate-spin" />}
                  {pyStatusLabel[pyStatus]}
                </Badge>
                {pyStatus !== 'ready' && (
                  <Button
                    type="button"
                    size="sm"
                    variant="ghost"
                    className="text-white/60 hover:text-white hover:bg-white/10 h-7 text-xs"
                    onClick={() => void ensurePyodide()}
                    disabled={pyStatus === 'loading'}
                  >
                    {pyStatus === 'loading' ? (
                      <Loader2 className="w-3.5 h-3.5 mr-1 animate-spin" />
                    ) : (
                      <RefreshCw className="w-3.5 h-3.5 mr-1" />
                    )}
                    Load engine
                  </Button>
                )}
                <Button
                  type="button"
                  size="sm"
                  className="bg-gradient-to-r from-cyan-500 to-blue-500 hover:from-cyan-600 hover:to-blue-600 text-white h-7 text-xs"
                  onClick={() => void handleRun()}
                  disabled={running}
                >
                  {running ? <Loader2 className="w-3.5 h-3.5 mr-1 animate-spin" /> : <Play className="w-3.5 h-3.5 mr-1" />}
                  Run
                </Button>
              </div>
            </div>
            <Textarea
              value={pythonSource}
              onChange={(e) => setPythonSource(e.target.value)}
              spellCheck={false}
              className={`${glassInput} font-mono text-xs leading-relaxed ${compact ? 'min-h-[220px]' : 'min-h-[340px]'}`}
              placeholder="Paste the matplotlib script here…"
            />
            <p className="text-[11px] text-white/40 mt-2">
              The script must save at least one SVG, e.g.{' '}
              <code className="text-white/60">fig.savefig("diagram.svg")</code>. The first render can take ~20s while the
              Python engine downloads.
            </p>
          </div>

          {/* Save / apply controls */}
          <div className="rounded-xl border border-white/10 bg-slate-900/50 backdrop-blur p-3">
            <div className="grid grid-cols-1 sm:grid-cols-[120px_1fr] gap-3">
              <div>
                <label className="text-white/70 font-medium text-xs mb-1 block">Code</label>
                <Input value={code} onChange={(e) => setCode(e.target.value)} className={glassInput} placeholder="0101" />
              </div>
              <div>
                <label className="text-white/70 font-medium text-xs mb-1 block">Title (optional)</label>
                <Input
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  className={glassInput}
                  placeholder="e.g. Bouncing ball velocity-time graph"
                />
              </div>
            </div>
            <div className="mt-3 grid gap-2 sm:grid-cols-2">
              <Button
                type="button"
                className="bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-600 hover:to-teal-600 text-white"
                onClick={() => void handleSave()}
                disabled={saving || !selectedSvg}
              >
                {saving ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Save className="w-4 h-4 mr-2" />}
                Save to library
              </Button>
              {onApply && (
                <Button
                  type="button"
                  className="bg-gradient-to-r from-cyan-500 to-blue-500 hover:from-cyan-600 hover:to-blue-600 text-white"
                  onClick={() => void handleApply()}
                  disabled={applying || !selectedSvg}
                >
                  {applying ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <ImagePlus className="w-4 h-4 mr-2" />}
                  Apply to this question
                </Button>
              )}
            </div>
            <p className="text-[11px] text-white/40 mt-2">
              {onApply
                ? 'Apply uploads the previewed SVG and sets it as this question\u2019s image. With a code it is also saved to the library for reuse; without a code it is a one-off upload.'
                : 'Saving uploads the previewed SVG to storage as '}
              {!onApply && <code className="text-white/60">diagrams/&lt;code&gt;.svg</code>}
              {!onApply && ' and upserts the library record. Reusing a code overwrites it.'}
            </p>
          </div>
        </div>

        {/* Preview + logs column */}
        <div className="space-y-3">
          <div className="rounded-xl border border-white/10 bg-slate-900/50 backdrop-blur p-3">
            <div className="flex items-center justify-between mb-2">
              <label className="text-white/70 font-medium text-sm">Preview</label>
              {runResult && runResult.svgs.length > 1 && (
                <div className="flex items-center gap-1 flex-wrap">
                  {runResult.svgs.map((s, i) => (
                    <Button
                      key={s.filename}
                      type="button"
                      size="sm"
                      variant={i === selectedSvgIndex ? 'default' : 'ghost'}
                      className={`h-6 text-[10px] px-2 ${
                        i === selectedSvgIndex ? 'bg-cyan-500 text-white' : 'text-white/60 hover:text-white hover:bg-white/10'
                      }`}
                      onClick={() => setSelectedSvgIndex(i)}
                    >
                      {s.filename}
                    </Button>
                  ))}
                </div>
              )}
            </div>
            <div className="rounded-lg bg-white p-4 min-h-[220px] flex items-center justify-center overflow-auto">
              {selectedSvg ? (
                // Rendered as an <img>, never as inline HTML: the SVG may come from
                // a stored library row, and scripts inside an <img> SVG don't run.
                <img
                  src={`data:image/svg+xml;charset=utf-8,${encodeURIComponent(selectedSvg.svg)}`}
                  alt={selectedSvg.filename}
                  className="max-w-full h-auto"
                />
              ) : (
                <span className="text-slate-400 text-sm">Run a script to see the diagram here.</span>
              )}
            </div>
          </div>

          {runResult && (runResult.error || runResult.stdout || runResult.stderr) && (
            <div className="rounded-xl border border-white/10 bg-slate-900/50 backdrop-blur p-3">
              <div className="flex items-center gap-2 mb-2">
                <Terminal className="w-4 h-4 text-white/60" />
                <label className="text-white/70 font-medium text-sm">Log</label>
              </div>
              {runResult.error && (
                <pre className="text-[11px] text-red-300 whitespace-pre-wrap break-words bg-red-950/30 rounded-md p-2 mb-2">
                  {runResult.error}
                </pre>
              )}
              {runResult.stdout && (
                <pre className="text-[11px] text-white/70 whitespace-pre-wrap break-words bg-black/30 rounded-md p-2 mb-2">
                  {runResult.stdout}
                </pre>
              )}
              {runResult.stderr && (
                <pre className="text-[11px] text-amber-200/80 whitespace-pre-wrap break-words bg-black/30 rounded-md p-2">
                  {runResult.stderr}
                </pre>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Library */}
      {showLibrary && (
        <div className="rounded-xl border border-white/10 bg-slate-900/50 backdrop-blur p-4">
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-white font-semibold text-sm">Saved diagrams</h2>
            <Button
              type="button"
              size="sm"
              variant="ghost"
              className="text-white/60 hover:text-white hover:bg-white/10 h-7 text-xs"
              onClick={() => void loadLibrary()}
              disabled={loadingLibrary}
            >
              {loadingLibrary ? <Loader2 className="w-3.5 h-3.5 mr-1 animate-spin" /> : <RefreshCw className="w-3.5 h-3.5 mr-1" />}
              Refresh
            </Button>
          </div>

          {library.length === 0 ? (
            <p className="text-white/40 text-sm py-6 text-center">
              No diagrams saved yet. Run a script and save it with a code.
            </p>
          ) : (
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
              {library.map((row) => (
                <div key={row.id} className="rounded-lg border border-white/10 bg-slate-800/40 overflow-hidden flex flex-col">
                  <div className="bg-white p-2 h-28 flex items-center justify-center overflow-hidden">
                    <img src={row.public_url} alt={row.code} className="max-h-full max-w-full object-contain" />
                  </div>
                  <div className="p-2 flex-1 flex flex-col">
                    <span className="font-mono text-cyan-300 text-sm font-bold">{row.code}</span>
                    {row.title && <span className="text-[11px] text-white/50 line-clamp-2 mt-0.5">{row.title}</span>}
                    <div className="flex items-center gap-1 mt-2">
                      <Button
                        type="button"
                        size="sm"
                        variant="ghost"
                        title="Load into editor"
                        className="h-6 px-1.5 text-white/60 hover:text-white hover:bg-white/10"
                        onClick={() => handleLoadRow(row)}
                      >
                        <RefreshCw className="w-3.5 h-3.5" />
                      </Button>
                      <Button
                        type="button"
                        size="sm"
                        variant="ghost"
                        title="Copy public URL"
                        className="h-6 px-1.5 text-white/60 hover:text-white hover:bg-white/10"
                        onClick={() => void handleCopyUrl(row.public_url)}
                      >
                        <Copy className="w-3.5 h-3.5" />
                      </Button>
                      {onApply && (
                        <Button
                          type="button"
                          size="sm"
                          variant="ghost"
                          title="Use for this question"
                          className="h-6 px-1.5 text-cyan-300/80 hover:text-cyan-200 hover:bg-cyan-500/10"
                          onClick={() => onApply(`${row.public_url}?v=${Date.parse(row.updated_at) || Date.now()}`)}
                        >
                          <ImagePlus className="w-3.5 h-3.5" />
                        </Button>
                      )}
                      <Button
                        type="button"
                        size="sm"
                        variant="ghost"
                        title="Delete"
                        className="h-6 px-1.5 text-red-300/70 hover:text-red-300 hover:bg-red-500/10 ml-auto"
                        onClick={() => void handleDelete(row)}
                        disabled={deletingId === row.id}
                      >
                        {deletingId === row.id ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Trash2 className="w-3.5 h-3.5" />}
                      </Button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
