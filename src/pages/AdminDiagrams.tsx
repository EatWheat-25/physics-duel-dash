import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { ArrowLeft, Image as ImageIcon } from 'lucide-react';
import SpaceBackground from '@/components/SpaceBackground';
import { DiagramStudio } from '@/components/admin/DiagramStudio';

export default function AdminDiagrams() {
  const navigate = useNavigate();

  return (
    <div className="relative min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950">
      <SpaceBackground />
      <div className="relative z-10 max-w-7xl mx-auto px-4 py-6">
        {/* Header */}
        <div className="flex items-center justify-between mb-5">
          <div className="flex items-center gap-3">
            <ImageIcon className="w-6 h-6 text-cyan-400" />
            <div>
              <h1 className="text-xl font-bold text-white">Diagram Library</h1>
              <p className="text-xs text-white/50">
                Paste matplotlib Python → render in-browser → save by code → reuse on questions.
              </p>
            </div>
          </div>
          <Button
            onClick={() => navigate('/admin/dashboard')}
            variant="ghost"
            className="text-white/70 hover:text-white hover:bg-white/10"
          >
            <ArrowLeft className="w-4 h-4 mr-2" />
            Back to Admin
          </Button>
        </div>

        <DiagramStudio showLibrary />
      </div>
    </div>
  );
}
