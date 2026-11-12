import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';
import { Loader2, RefreshCw, ImagePlus } from 'lucide-react';

interface DiagramOption {
  code: string;
  title: string | null;
  public_url: string;
  updated_at: string;
}

interface SavedDiagramPickerProps {
  /** Called with a cache-busted public URL when the admin applies a diagram. */
  onPick: (url: string) => void;
  selectClassName?: string;
}

/**
 * Small picker for the question editor: lists diagrams saved in the Diagram
 * Library and lets the admin point the question's image at one by code. The
 * URL is cache-busted with the diagram's updated_at so overwriting a code
 * (same storage path) still refreshes the preview.
 */
export function SavedDiagramPicker({ onPick, selectClassName }: SavedDiagramPickerProps) {
  const [options, setOptions] = useState<DiagramOption[]>([]);
  const [loading, setLoading] = useState(false);
  const [selectedCode, setSelectedCode] = useState('');

  async function loadDiagrams() {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('question_diagrams')
        .select('code, title, public_url, updated_at')
        .order('code', { ascending: true });
      if (error) throw error;
      setOptions((data ?? []) as DiagramOption[]);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to load saved diagrams.');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void loadDiagrams();
  }, []);

  function handleApply() {
    const chosen = options.find((o) => o.code === selectedCode);
    if (!chosen) {
      toast.error('Pick a saved diagram first.');
      return;
    }
    const bust = Date.parse(chosen.updated_at) || Date.now();
    const url = `${chosen.public_url}?v=${bust}`;
    onPick(url);
    toast.success(`Using diagram "${chosen.code}".`);
  }

  return (
    <div className="flex flex-wrap items-center gap-2">
      <select
        value={selectedCode}
        onChange={(e) => setSelectedCode(e.target.value)}
        className={selectClassName ?? 'bg-white/5 border border-white/10 text-white rounded-md px-2 py-1.5 text-sm'}
      >
        <option value="">— Use saved diagram —</option>
        {options.map((o) => (
          <option key={o.code} value={o.code}>
            {o.code}
            {o.title ? ` · ${o.title}` : ''}
          </option>
        ))}
      </select>
      <Button
        type="button"
        size="sm"
        variant="ghost"
        className="h-8 text-white/70 hover:text-white hover:bg-white/10"
        onClick={handleApply}
        disabled={!selectedCode}
      >
        <ImagePlus className="w-3.5 h-3.5 mr-1" />
        Apply
      </Button>
      <Button
        type="button"
        size="sm"
        variant="ghost"
        title="Refresh list"
        className="h-8 px-2 text-white/50 hover:text-white hover:bg-white/10"
        onClick={() => void loadDiagrams()}
        disabled={loading}
      >
        {loading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <RefreshCw className="w-3.5 h-3.5" />}
      </Button>
    </div>
  );
}
