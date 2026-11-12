import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { ChevronDown, ChevronRight, Code2 } from 'lucide-react';
import { DiagramStudio } from '@/components/admin/DiagramStudio';

interface InlineDiagramStudioFieldProps {
  /** Receives a cache-busted public URL to set as the question image. */
  onApply: (url: string) => void;
}

/**
 * Collapsible wrapper so the heavy matplotlib/Pyodide studio only mounts (and
 * only loads the runtime) when the admin opens it from inside the question form.
 */
export function InlineDiagramStudioField({ onApply }: InlineDiagramStudioFieldProps) {
  const [open, setOpen] = useState(false);

  return (
    <div className="pt-1 border-t border-white/5">
      <Button
        type="button"
        variant="ghost"
        className="w-full justify-start text-white/70 hover:text-white hover:bg-white/10 h-8 text-sm"
        onClick={() => setOpen((v) => !v)}
      >
        {open ? <ChevronDown className="w-4 h-4 mr-1.5" /> : <ChevronRight className="w-4 h-4 mr-1.5" />}
        <Code2 className="w-4 h-4 mr-1.5" />
        Create diagram from code (matplotlib)
      </Button>
      {open && (
        <div className="mt-2 rounded-xl border border-white/10 bg-black/20 p-3">
          <DiagramStudio compact onApply={onApply} />
        </div>
      )}
    </div>
  );
}
