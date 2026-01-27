import { useLocation, useNavigate } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';
import type { StepBasedQuestion } from '@/types/question-contract';
import { InGamePreview } from '@/components/admin/InGamePreview';
import { MatchPatternBackground } from '@/components/battle/MatchPatternBackground';

type AdminPreviewState = {
  question?: StepBasedQuestion;
};

export default function AdminEndgamePreview() {
  const navigate = useNavigate();
  const { state } = useLocation();
  const question = (state as AdminPreviewState | null)?.question;

  return (
    <div className="min-h-screen text-white relative overflow-hidden">
      <MatchPatternBackground />

      <header className="relative z-10 w-full max-w-6xl mx-auto p-4 md:p-6 flex items-center justify-between">
        <button
          type="button"
          onClick={() => navigate('/admin/questions')}
          className="flex items-center gap-2 text-white/60 hover:text-white transition-colors"
        >
          <div className="p-2 rounded-lg bg-white/5 hover:bg-white/10 transition-colors">
            <ArrowLeft className="w-4 h-4" />
          </div>
          <span className="text-sm font-medium tracking-wide">Back to Admin</span>
        </button>
        <div className="text-xs uppercase tracking-[0.35em] text-white/40">Admin Preview</div>
      </header>

      <main className="relative z-10 w-full max-w-6xl mx-auto px-4 md:px-6 pb-10 space-y-6">
        <div className="rounded-2xl border border-white/10 bg-white/5 backdrop-blur-md p-4">
          <div className="grid grid-cols-3 gap-4 items-center">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-blue-600 to-blue-800 flex items-center justify-center font-bold">
                A
              </div>
              <div>
                <div className="text-xs text-blue-200/50 font-mono">OPERATOR</div>
                <div className="font-bold text-sm">ADMIN</div>
              </div>
            </div>
            <div className="text-center">
              <div className="text-xs text-white/30 font-mono uppercase tracking-widest">Preview Mode</div>
              <div className="text-lg font-black tracking-tight">ENDGAME VIEW</div>
            </div>
            <div className="flex items-center gap-3 justify-end">
              <div className="text-right">
                <div className="text-xs text-red-200/50 font-mono">TARGET</div>
                <div className="font-bold text-sm">SANDBOX</div>
              </div>
              <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-red-600 to-red-800 flex items-center justify-center font-bold">
                S
              </div>
            </div>
          </div>
          {question && (
            <div className="mt-3 text-xs text-white/50 font-mono">
              Previewing: {question.title || 'Untitled Question'}
            </div>
          )}
        </div>

        {question ? (
          <div className="rounded-2xl border border-white/10 bg-black/40 backdrop-blur-sm">
            <InGamePreview question={question} variant="embedded" />
          </div>
        ) : (
          <div className="rounded-2xl border border-white/10 bg-black/40 p-6 text-center text-white/70">
            <div className="text-sm">
              No question data found. Return to Admin Questions and open preview again.
            </div>
            <button
              type="button"
              onClick={() => navigate('/admin/questions')}
              className="mt-4 px-4 py-2 rounded-lg bg-white/10 hover:bg-white/20 transition-colors text-sm"
            >
              Return to Admin Questions
            </button>
          </div>
        )}
      </main>
    </div>
  );
}
