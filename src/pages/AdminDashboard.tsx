import { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { StepBasedQuestion } from '@/types/question-contract';
import { dbRowToQuestion } from '@/lib/question-contract';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { toast } from 'sonner';
import { Loader2, Plus, Trash2, Shield, Search, Filter, X, RefreshCw, AlertCircle, CheckCircle2, BookOpen, TrendingUp, BarChart3 } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import SpaceBackground from '@/components/SpaceBackground';
import { useIsAdmin } from '@/hooks/useUserRole';
import AdminQuestions from './AdminQuestions';

type QuestionFilter = {
  subject: 'all' | 'math' | 'physics' | 'chemistry';
  level: 'all' | 'A1' | 'A2';
  difficulty: 'all' | 'easy' | 'medium' | 'hard';
};

export default function AdminDashboard() {
  const navigate = useNavigate();
  const { user, loading: authLoading } = useAuth();
  const { isAdmin, isLoading: checkingAdmin } = useIsAdmin();

  // Question list state
  const [questions, setQuestions] = useState<StepBasedQuestion[]>([]);
  const [loadingQuestions, setLoadingQuestions] = useState(false);
  const [filters, setFilters] = useState<QuestionFilter>({
    subject: 'all',
    level: 'all',
    difficulty: 'all',
  });
  const [searchTerm, setSearchTerm] = useState('');
  const [mappingErrors, setMappingErrors] = useState<string[]>([]);
  const [selectedQuestionId, setSelectedQuestionId] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  // Load questions on mount and filter changes
  useEffect(() => {
    if (isAdmin) {
      fetchQuestions();
    }
  }, [isAdmin, filters]);

  async function fetchQuestions() {
    setLoadingQuestions(true);
    setMappingErrors([]);
    try {
      let query = supabase
        .from('questions_v2')
        .select('*')
        .order('updated_at', { ascending: false });

      if (filters.subject !== 'all') query = query.eq('subject', filters.subject);
      if (filters.level !== 'all') query = query.eq('level', filters.level);
      if (filters.difficulty !== 'all') query = query.eq('difficulty', filters.difficulty);

      console.log('[AdminDashboard] Fetching questions with filters:', filters);
      const { data, error } = await query;
      console.log('[AdminDashboard] Raw result count:', data?.length || 0, 'error:', error);

      if (error) throw error;

      const mapped: StepBasedQuestion[] = [];
      const rowErrors: string[] = [];

      (data || []).forEach((row, idx) => {
        try {
          mapped.push(dbRowToQuestion(row));
        } catch (err: any) {
          console.error('[AdminDashboard] Mapping error for row', idx, err, row);
          rowErrors.push(`Row ${idx}: ${err?.message || 'Mapping error'}`);
        }
      });

      if (rowErrors.length > 0) {
        setMappingErrors(rowErrors);
        toast.warning(`${rowErrors.length} question(s) could not be parsed. Check console for details.`);
      } else {
        setMappingErrors([]);
      }

      setQuestions(mapped);
      console.log('[AdminDashboard] Successfully loaded', mapped.length, 'questions');
    } catch (error: any) {
      console.error('[AdminDashboard] Error fetching:', error);
      toast.error(error.message || 'Failed to load questions');
      setQuestions([]);
    } finally {
      setLoadingQuestions(false);
    }
  }

  async function handleDeleteQuestion(questionId: string, event: React.MouseEvent) {
    event.stopPropagation(); // Prevent selecting the question when clicking delete
    
    if (!confirm(`Are you sure you want to delete this question? This action cannot be undone.`)) {
      return;
    }

    setDeletingId(questionId);
    try {
      const { error } = await supabase
        .from('questions_v2')
        .delete()
        .eq('id', questionId);

      if (error) throw error;

      toast.success('Question deleted successfully!');
      
      // Remove from local state
      setQuestions(prev => prev.filter(q => q.id !== questionId));
      
      // Clear selection if deleted question was selected
      if (selectedQuestionId === questionId) {
        setSelectedQuestionId(null);
      }
    } catch (error: any) {
      console.error('[AdminDashboard] Delete error:', error);
      toast.error(error.message || 'Failed to delete question');
    } finally {
      setDeletingId(null);
    }
  }

  const filteredQuestions = useMemo(() => {
    const term = searchTerm.toLowerCase().trim();
    return questions.filter((q) => {
      const matchesSearch = term === '' ||
        q.title.toLowerCase().includes(term) ||
        q.chapter.toLowerCase().includes(term) ||
        q.topicTags.some(tag => tag.toLowerCase().includes(term));
      return matchesSearch;
    });
  }, [questions, searchTerm]);

  // Statistics
  const stats = useMemo(() => {
    const total = questions.length;
    const bySubject = {
      math: questions.filter(q => q.subject === 'math').length,
      physics: questions.filter(q => q.subject === 'physics').length,
      chemistry: questions.filter(q => q.subject === 'chemistry').length,
    };
    const byLevel = {
      A1: questions.filter(q => q.level === 'A1').length,
      A2: questions.filter(q => q.level === 'A2').length,
    };
    const totalSteps = questions.reduce((sum, q) => sum + q.steps.length, 0);
    return { total, bySubject, byLevel, totalSteps, avgSteps: total > 0 ? (totalSteps / total).toFixed(1) : '0' };
  }, [questions]);

  // Loading state
  if (authLoading || checkingAdmin) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center relative overflow-hidden">
        <SpaceBackground />
        <div className="relative z-10 flex flex-col items-center gap-4">
          <Loader2 className="w-12 h-12 animate-spin text-primary" />
          <p className="text-white/70 font-medium animate-pulse">Authenticating...</p>
        </div>
      </div>
    );
  }

  // Not logged in / Not admin
  if (!user || !isAdmin) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center relative overflow-hidden">
        <SpaceBackground />
        <div className="relative z-10 max-w-md w-full p-8 bg-white/10 backdrop-blur-xl border border-white/20 rounded-3xl text-center">
          <Shield className={`w-16 h-16 mx-auto mb-6 ${!user ? 'text-white/50' : 'text-red-500'}`} />
          <h2 className="text-2xl font-black text-white mb-2">
            {!user ? 'Authentication Required' : 'Access Denied'}
          </h2>
          <p className="text-white/60 mb-8">
            {!user ? 'Please login to access the admin panel.' : 'You do not have permission to view this page.'}
          </p>
          <Button
            onClick={() => navigate(!user ? '/auth' : '/')}
            className="w-full bg-white/10 hover:bg-white/20 text-white border border-white/10 h-12 text-lg font-bold"
          >
            {!user ? 'Go to Login' : 'Return Home'}
          </Button>
        </div>
      </div>
    );
  }

  // Main UI
  return (
    <div className="min-h-screen text-foreground relative overflow-hidden font-sans">
      <SpaceBackground />

      <div className="relative z-10 max-w-[1800px] mx-auto p-6">
        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <div>
            <div className="flex items-center gap-3 mb-2">
              <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-amber-400 to-orange-500 flex items-center justify-center">
                <Shield className="w-6 h-6 text-gray-900" />
              </div>
              <div>
                <h1 className="text-4xl font-black text-white tracking-tight">
                  ADMIN <span className="text-transparent bg-clip-text bg-gradient-to-r from-amber-400 to-orange-500">2.0</span>
                </h1>
                <p className="text-white/60 font-medium text-sm">Enhanced question management dashboard</p>
              </div>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <Button
              onClick={fetchQuestions}
              variant="outline"
              className="text-white/70 hover:text-white hover:bg-white/10 border-white/20"
            >
              <RefreshCw className="w-4 h-4 mr-2" />
              Refresh
            </Button>
            <Button
              onClick={() => navigate('/admin/questions')}
              variant="ghost"
              className="text-white/70 hover:text-white hover:bg-white/10"
            >
              Legacy Panel
            </Button>
            <Button
              onClick={() => navigate('/')}
              variant="ghost"
              className="text-white/70 hover:text-white hover:bg-white/10"
            >
              Exit to App
            </Button>
          </div>
        </div>

        {/* Statistics Cards */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
          <div className="bg-gradient-to-br from-white/15 to-white/5 backdrop-blur-xl border-2 border-white/30 rounded-2xl p-5 shadow-lg">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-white/80 text-sm font-semibold mb-1">Total Questions</p>
                <p className="text-4xl font-black text-white mt-1">{stats.total}</p>
              </div>
              <BookOpen className="w-10 h-10 text-amber-400" />
            </div>
          </div>
          <div className="bg-gradient-to-br from-white/15 to-white/5 backdrop-blur-xl border-2 border-white/30 rounded-2xl p-5 shadow-lg">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-white/80 text-sm font-semibold mb-1">Total Steps</p>
                <p className="text-4xl font-black text-white mt-1">{stats.totalSteps}</p>
                <p className="text-xs text-white/60 mt-1 font-medium">Avg: {stats.avgSteps} per question</p>
              </div>
              <BarChart3 className="w-10 h-10 text-blue-400" />
            </div>
          </div>
          <div className="bg-gradient-to-br from-white/15 to-white/5 backdrop-blur-xl border-2 border-white/30 rounded-2xl p-5 shadow-lg">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-white/80 text-sm font-semibold mb-1">By Subject</p>
                <div className="flex gap-2 mt-2">
                  <Badge className="bg-blue-500/30 text-blue-200 border border-blue-400/50 text-xs font-semibold px-2 py-0.5">Math: {stats.bySubject.math}</Badge>
                  <Badge className="bg-purple-500/30 text-purple-200 border border-purple-400/50 text-xs font-semibold px-2 py-0.5">Physics: {stats.bySubject.physics}</Badge>
                </div>
              </div>
              <TrendingUp className="w-10 h-10 text-purple-400" />
            </div>
          </div>
          <div className="bg-gradient-to-br from-white/15 to-white/5 backdrop-blur-xl border-2 border-white/30 rounded-2xl p-5 shadow-lg">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-white/80 text-sm font-semibold mb-1">By Level</p>
                <div className="flex gap-2 mt-2">
                  <Badge className="bg-green-500/30 text-green-200 border border-green-400/50 text-xs font-semibold px-2 py-0.5">A1: {stats.byLevel.A1}</Badge>
                  <Badge className="bg-orange-500/30 text-orange-200 border border-orange-400/50 text-xs font-semibold px-2 py-0.5">A2: {stats.byLevel.A2}</Badge>
                </div>
              </div>
              <BarChart3 className="w-10 h-10 text-green-400" />
            </div>
          </div>
        </div>

        {/* Main Content Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-[400px_1fr] gap-6 h-[calc(100vh-320px)]">
          {/* LEFT PANEL: Filters & Question List */}
          <div className="flex flex-col gap-4 h-full overflow-hidden">
            {/* Filters */}
            <div className="bg-gradient-to-br from-white/15 to-white/5 backdrop-blur-xl border-2 border-white/30 rounded-2xl p-5 space-y-4 shadow-lg">
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2 text-white font-bold uppercase tracking-wider text-sm">
                  <Filter className="w-5 h-5 text-amber-400" />
                  Filters
                </div>
                {(filters.subject !== 'all' || filters.level !== 'all' || filters.difficulty !== 'all' || searchTerm) && (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => {
                      setFilters({ subject: 'all', level: 'all', difficulty: 'all' });
                      setSearchTerm('');
                    }}
                    className="text-white/60 hover:text-white h-6 px-2 text-xs"
                  >
                    <X className="w-3 h-3 mr-1" />
                    Clear
                  </Button>
                )}
              </div>

              <div className="space-y-3">
                <div>
                  <label className="text-white font-semibold mb-2 block text-sm">Subject</label>
                  <Select value={filters.subject} onValueChange={(v: any) => setFilters({ ...filters, subject: v })}>
                    <SelectTrigger className="bg-white/10 border-2 border-white/30 text-white h-10 font-medium">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent className="bg-gray-900 border-white/10 text-white">
                      <SelectItem value="all">All</SelectItem>
                      <SelectItem value="math">Math</SelectItem>
                      <SelectItem value="physics">Physics</SelectItem>
                      <SelectItem value="chemistry">Chemistry</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <label className="text-white font-semibold mb-2 block text-sm">Level</label>
                  <Select value={filters.level} onValueChange={(v: any) => setFilters({ ...filters, level: v })}>
                    <SelectTrigger className="bg-white/10 border-2 border-white/30 text-white h-10 font-medium">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent className="bg-gray-900 border-white/10 text-white">
                      <SelectItem value="all">All</SelectItem>
                      <SelectItem value="A1">A1</SelectItem>
                      <SelectItem value="A2">A2</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <label className="text-white font-semibold mb-2 block text-sm">Difficulty</label>
                  <Select value={filters.difficulty} onValueChange={(v: any) => setFilters({ ...filters, difficulty: v })}>
                    <SelectTrigger className="bg-white/10 border-2 border-white/30 text-white h-10 font-medium">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent className="bg-gray-900 border-white/10 text-white">
                      <SelectItem value="all">All</SelectItem>
                      <SelectItem value="easy">Easy</SelectItem>
                      <SelectItem value="medium">Medium</SelectItem>
                      <SelectItem value="hard">Hard</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="pt-3 border-t-2 border-white/20">
                <label className="text-white font-semibold mb-2 block text-sm">Search</label>
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-amber-400" />
                  <Input
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    placeholder="Search by title, chapter..."
                    className="bg-white/10 border-2 border-white/30 text-white placeholder:text-white/50 pl-10 h-10 font-medium"
                  />
                </div>
              </div>

              <Button
                onClick={() => navigate('/admin/questions')}
                className="w-full bg-gradient-to-r from-amber-400 to-orange-500 hover:from-amber-500 hover:to-orange-600 text-gray-900 font-bold h-10 shadow-lg shadow-orange-500/20 mt-4"
              >
                <Plus className="w-4 h-4 mr-2" />
                Create New Question
              </Button>
            </div>

            {/* Question List */}
            <div className="flex-1 bg-gradient-to-br from-white/15 to-white/5 backdrop-blur-xl border-2 border-white/30 rounded-2xl flex flex-col min-h-0 overflow-hidden shadow-lg">
              <div className="p-4 border-b-2 border-white/20 bg-white/10 backdrop-blur-md flex justify-between items-center">
                <div className="flex items-center gap-2">
                  <Search className="w-5 h-5 text-amber-400" />
                  <h3 className="font-bold text-white text-base">Questions</h3>
                </div>
                <span className="text-white font-semibold text-sm">
                  {filteredQuestions.length} / {questions.length}
                </span>
              </div>

              <div className="flex-1 overflow-y-auto p-3 space-y-2 custom-scrollbar">
                {loadingQuestions ? (
                  <div className="flex justify-center py-12">
                    <Loader2 className="w-8 h-8 animate-spin text-amber-400" />
                  </div>
                ) : filteredQuestions.length === 0 ? (
                  <div className="text-center py-12 text-white/40">
                    <BookOpen className="w-12 h-12 mx-auto mb-3 opacity-30" />
                    <p className="text-sm">No questions found</p>
                    {searchTerm && (
                      <p className="text-xs mt-2 text-white/30">Try adjusting your search or filters</p>
                    )}
                  </div>
                ) : (
                  filteredQuestions.map((q) => (
                    <div
                      key={q.id}
                      className={`p-4 rounded-xl cursor-pointer transition-all duration-200 border-2 relative group ${
                        selectedQuestionId === q.id
                          ? 'bg-amber-500/30 border-amber-400 shadow-[0_0_20px_rgba(251,191,36,0.4)]'
                          : 'bg-white/10 border-white/20 hover:bg-white/15 hover:border-white/30 hover:shadow-lg'
                      }`}
                    >
                      {/* Delete Button */}
                      <button
                        onClick={(e) => handleDeleteQuestion(q.id, e)}
                        disabled={deletingId === q.id}
                        className="absolute top-2 right-2 p-1.5 rounded-lg bg-red-500/20 hover:bg-red-500/30 text-red-300 opacity-0 group-hover:opacity-100 transition-opacity border border-red-500/30 z-10 disabled:opacity-50"
                        title="Delete question"
                      >
                        {deletingId === q.id ? (
                          <Loader2 className="w-4 h-4 animate-spin" />
                        ) : (
                          <Trash2 className="w-4 h-4" />
                        )}
                      </button>

                      <div
                        onClick={() => {
                          setSelectedQuestionId(q.id);
                          navigate(`/admin/questions?edit=${q.id}`);
                        }}
                        className="pr-8"
                      >
                        <div className="font-bold text-white mb-2 line-clamp-2 text-sm leading-tight">{q.title}</div>
                        <div className="flex flex-wrap gap-1.5 mb-2">
                          <Badge
                            variant="outline"
                            className={`text-xs uppercase tracking-wider font-semibold border ${
                              q.subject === 'math'
                                ? 'bg-blue-500/30 text-blue-200 border-blue-400/50'
                                : q.subject === 'physics'
                                ? 'bg-purple-500/30 text-purple-200 border-purple-400/50'
                                : 'bg-green-500/30 text-green-200 border-green-400/50'
                            }`}
                          >
                            {q.subject}
                          </Badge>
                          <Badge variant="outline" className="text-xs border-white/30 bg-white/10 text-white font-semibold">
                            {q.level}
                          </Badge>
                          <Badge
                            variant="outline"
                            className={`text-xs border font-semibold ${
                              q.difficulty === 'hard'
                                ? 'bg-red-500/30 text-red-200 border-red-400/50'
                                : q.difficulty === 'medium'
                                ? 'bg-yellow-500/30 text-yellow-200 border-yellow-400/50'
                                : 'bg-green-500/30 text-green-200 border-green-400/50'
                            }`}
                          >
                            {q.difficulty}
                          </Badge>
                        </div>
                        <div className="flex items-center justify-between text-xs text-white/70 font-semibold mt-2">
                          <span>{q.steps.length} Steps</span>
                          <span>{q.totalMarks} Marks</span>
                          <span className="font-mono text-white/50">#{q.id.slice(0, 6)}</span>
                        </div>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>

            {/* Error Display */}
            {mappingErrors.length > 0 && (
              <div className="bg-red-500/20 border-2 border-red-400/50 rounded-xl p-4 shadow-lg">
                <div className="flex items-start gap-3">
                  <AlertCircle className="w-5 h-5 text-red-300 mt-0.5 flex-shrink-0" />
                  <div className="flex-1">
                    <p className="text-red-200 text-sm font-bold mb-1">
                      {mappingErrors.length} question(s) failed to load
                    </p>
                    <p className="text-red-300/80 text-xs">Check browser console for details</p>
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* RIGHT PANEL: Info/Editor Redirect */}
          <div className="bg-gradient-to-br from-white/15 to-white/5 backdrop-blur-xl border-2 border-white/30 rounded-2xl flex flex-col h-full overflow-hidden relative shadow-lg">
            {selectedQuestionId ? (
              <div className="flex-1 flex flex-col items-center justify-center text-white p-8">
                <CheckCircle2 className="w-20 h-20 mb-6 text-amber-400" />
                <h3 className="text-2xl font-bold text-white mb-3">Question Selected</h3>
                <p className="text-center text-base mb-8 text-white/80">
                  Click "Edit in Legacy Panel" to modify this question
                </p>
                <Button
                  onClick={() => navigate(`/admin/questions?edit=${selectedQuestionId}`)}
                  className="bg-gradient-to-r from-amber-400 to-orange-500 hover:from-amber-500 hover:to-orange-600 text-gray-900 font-bold h-12 px-8 text-base shadow-lg"
                >
                  Edit in Legacy Panel
                </Button>
              </div>
            ) : (
              <div className="flex-1 flex flex-col items-center justify-center text-white p-8">
                <div className="w-28 h-28 rounded-full bg-gradient-to-br from-white/20 to-white/5 border-2 border-white/30 flex items-center justify-center mb-8 shadow-lg">
                  <Shield className="w-14 h-14 text-amber-400" />
                </div>
                <h3 className="text-2xl font-bold text-white mb-3">Admin Dashboard 2.0</h3>
                <p className="text-center text-base mb-2 text-white/90">
                  Select a question from the list to view details
                </p>
                <p className="text-center text-sm text-white/60 mb-8">
                  Or use the Legacy Panel for full editing capabilities
                </p>
                <Button
                  onClick={() => navigate('/admin/questions')}
                  variant="outline"
                  className="border-2 border-white/30 text-white hover:text-white hover:bg-white/15 hover:border-white/40 h-11 px-6 font-semibold"
                >
                  Open Legacy Panel
                </Button>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
