import { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { StepBasedQuestion } from '@/types/question-contract';
import { dbRowToQuestion } from '@/lib/question-contract';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { toast } from 'sonner';
import { Loader2, Plus, Trash2, Shield, Search, Filter, X, RefreshCw, AlertCircle, BookOpen, TrendingUp, BarChart3 } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import SpaceBackground from '@/components/SpaceBackground';

type QuestionFilter = {
  subject: 'all' | 'math' | 'physics' | 'chemistry';
  level: 'all' | 'A1' | 'A2';
  difficulty: 'all' | 'easy' | 'medium' | 'hard';
};

export default function AdminDashboard() {
  const navigate = useNavigate();

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
    fetchQuestions();
  }, [filters]);

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
      // Try using the RPC function first (more reliable, handles everything in a transaction)
      const { data: rpcResult, error: rpcError } = await supabase
        .rpc('delete_question_cascade' as any, { p_question_id: questionId });

      if (!rpcError && rpcResult && typeof rpcResult === 'object' && rpcResult !== null && 'success' in rpcResult && (rpcResult as any).success) {
        // RPC function succeeded
        toast.success('Question deleted successfully!');
        
        // Remove from local state
        setQuestions(prev => prev.filter(q => q.id !== questionId));
        
        // Clear selection if deleted question was selected
        if (selectedQuestionId === questionId) {
          setSelectedQuestionId(null);
        }
        return;
      }

      // If RPC function doesn't exist or failed, fall back to manual deletion
      console.log('[AdminDashboard] RPC function not available or failed, using manual deletion');
      
      // Delete related records first to avoid foreign key constraint violations
      // Delete match_answers that reference this question
      const { error: answersError } = await supabase
        .from('match_answers')
        .delete()
        .eq('question_id', questionId);

      if (answersError && !answersError.message.includes('does not exist')) {
        console.warn('[AdminDashboard] Error deleting match_answers:', answersError);
      }

      // Delete match_rounds that reference this question
      const { error: roundsError } = await supabase
        .from('match_rounds')
        .delete()
        .eq('question_id', questionId);

      if (roundsError && !roundsError.message.includes('does not exist')) {
        console.warn('[AdminDashboard] Error deleting match_rounds:', roundsError);
      }

      // Delete match_questions if the table exists
      const { error: matchQuestionsError } = await supabase
        .from('match_questions')
        .delete()
        .eq('question_id', questionId);

      if (matchQuestionsError && !matchQuestionsError.message.includes('does not exist')) {
        // Table might not exist, which is fine
        console.warn('[AdminDashboard] Error deleting match_questions (table may not exist):', matchQuestionsError);
      }

      // Handle matches table if it has question_id column
      // Try to update to NULL first, then delete if that fails
      const { error: matchesUpdateError } = await supabase
        .from('matches')
        .update({ question_id: null } as any)
        .eq('question_id' as any, questionId);

      if (matchesUpdateError && !matchesUpdateError.message.includes('does not exist') && !matchesUpdateError.message.includes('null value')) {
        // If update to NULL fails (column not nullable), try deleting matches
        const { error: matchesDeleteError } = await supabase
          .from('matches')
          .delete()
          .eq('question_id' as any, questionId);
        
        if (matchesDeleteError && !matchesDeleteError.message.includes('does not exist')) {
          console.warn('[AdminDashboard] Error handling matches:', matchesDeleteError);
        }
      }

      // Now delete the question itself
      const { error } = await supabase
        .from('questions_v2')
        .delete()
        .eq('id', questionId);

      if (error) {
        // If we still get a foreign key error, it means CASCADE isn't working
        // Try one more time with the RPC if it was just a timing issue
        if (error.message?.includes('foreign key constraint') || error.message?.includes('violates')) {
          const { data: retryResult, error: retryError } = await supabase
            .rpc('delete_question_cascade' as any, { p_question_id: questionId });
          
          if (!retryError && retryResult && typeof retryResult === 'object' && retryResult !== null && 'success' in retryResult && (retryResult as any).success) {
            toast.success('Question deleted successfully!');
            setQuestions(prev => prev.filter(q => q.id !== questionId));
            if (selectedQuestionId === questionId) {
              setSelectedQuestionId(null);
            }
            return;
          }
        }
        throw error;
      }

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

  // Main UI (auth is handled by ProtectedAdminRoute wrapper)
  return (
    <div className="min-h-screen text-foreground relative overflow-hidden font-sans">
      <SpaceBackground />

      <div className="relative z-10 w-full h-screen flex flex-col p-6">
        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <div>
            <div className="flex items-center gap-3 mb-2">
              <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-cyan-500 to-blue-500 flex items-center justify-center shadow-lg">
                <Shield className="w-6 h-6 text-white" />
              </div>
              <div>
                <h1 className="text-4xl font-black text-white tracking-tight">
                  ADMIN <span className="text-transparent bg-clip-text bg-gradient-to-r from-cyan-400 to-blue-400">2.0</span>
                </h1>
                <p className="text-slate-300 font-medium text-sm">Enhanced question management dashboard</p>
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
        <div className="grid grid-cols-1 md:grid-cols-4 gap-3 mb-4 flex-shrink-0">
          <div className="bg-gradient-to-br from-cyan-500/20 to-blue-500/20 backdrop-blur-xl border border-cyan-400/30 rounded-xl p-4 shadow-lg">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-slate-300 text-xs font-semibold mb-1">Total Questions</p>
                <p className="text-3xl font-black text-white mt-1">{stats.total}</p>
              </div>
              <BookOpen className="w-8 h-8 text-cyan-400" />
            </div>
          </div>
          <div className="bg-gradient-to-br from-purple-500/20 to-pink-500/20 backdrop-blur-xl border border-purple-400/30 rounded-xl p-4 shadow-lg">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-slate-300 text-xs font-semibold mb-1">Total Steps</p>
                <p className="text-3xl font-black text-white mt-1">{stats.totalSteps}</p>
                <p className="text-xs text-slate-400 mt-1 font-medium">Avg: {stats.avgSteps} per question</p>
              </div>
              <BarChart3 className="w-8 h-8 text-purple-400" />
            </div>
          </div>
          <div className="bg-gradient-to-br from-blue-500/20 to-indigo-500/20 backdrop-blur-xl border border-blue-400/30 rounded-xl p-4 shadow-lg">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-slate-300 text-xs font-semibold mb-1">By Subject</p>
                <div className="flex gap-1.5 mt-2">
                  <Badge className="bg-blue-500/40 text-blue-100 border border-blue-400/60 text-[10px] font-semibold px-1.5 py-0.5">Math: {stats.bySubject.math}</Badge>
                  <Badge className="bg-purple-500/40 text-purple-100 border border-purple-400/60 text-[10px] font-semibold px-1.5 py-0.5">Physics: {stats.bySubject.physics}</Badge>
                </div>
              </div>
              <TrendingUp className="w-8 h-8 text-blue-400" />
            </div>
          </div>
          <div className="bg-gradient-to-br from-green-500/20 to-emerald-500/20 backdrop-blur-xl border border-green-400/30 rounded-xl p-4 shadow-lg">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-slate-300 text-xs font-semibold mb-1">By Level</p>
                <div className="flex gap-1.5 mt-2">
                  <Badge className="bg-green-500/40 text-green-100 border border-green-400/60 text-[10px] font-semibold px-1.5 py-0.5">A1: {stats.byLevel.A1}</Badge>
                  <Badge className="bg-orange-500/40 text-orange-100 border border-orange-400/60 text-[10px] font-semibold px-1.5 py-0.5">A2: {stats.byLevel.A2}</Badge>
                </div>
              </div>
              <BarChart3 className="w-8 h-8 text-green-400" />
            </div>
          </div>
        </div>

        {/* Main Content Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-[240px_1fr] gap-4 flex-1 min-h-0">
          {/* LEFT PANEL: Filters - Very Compact */}
          <div className="flex flex-col gap-3 h-full overflow-hidden">
            {/* Filters - Ultra Compact */}
            <div className="bg-gradient-to-br from-slate-800/90 to-slate-900/90 backdrop-blur-xl border border-slate-700/50 rounded-xl p-3 space-y-2 shadow-xl flex-shrink-0">
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-1.5 text-slate-300 font-semibold uppercase tracking-wider text-[10px]">
                  <Filter className="w-3 h-3 text-cyan-400" />
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
                    className="text-slate-400 hover:text-white h-4 px-1.5 text-[10px]"
                  >
                    <X className="w-2.5 h-2.5" />
                  </Button>
                )}
              </div>

              <div className="grid grid-cols-2 gap-1.5">
                <div>
                  <label className="text-slate-300 font-medium mb-0.5 block text-[10px]">Subject</label>
                  <Select value={filters.subject} onValueChange={(v: any) => setFilters({ ...filters, subject: v })}>
                    <SelectTrigger className="bg-slate-700/50 border border-slate-600 text-white h-7 font-medium text-[10px]">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent className="bg-slate-800 border-slate-700 text-white">
                      <SelectItem value="all">All</SelectItem>
                      <SelectItem value="math">Math</SelectItem>
                      <SelectItem value="physics">Physics</SelectItem>
                      <SelectItem value="chemistry">Chemistry</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <label className="text-slate-300 font-medium mb-0.5 block text-[10px]">Level</label>
                  <Select value={filters.level} onValueChange={(v: any) => setFilters({ ...filters, level: v })}>
                    <SelectTrigger className="bg-slate-700/50 border border-slate-600 text-white h-7 font-medium text-[10px]">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent className="bg-slate-800 border-slate-700 text-white">
                      <SelectItem value="all">All</SelectItem>
                      <SelectItem value="A1">A1</SelectItem>
                      <SelectItem value="A2">A2</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div>
                <label className="text-slate-300 font-medium mb-0.5 block text-[10px]">Difficulty</label>
                <Select value={filters.difficulty} onValueChange={(v: any) => setFilters({ ...filters, difficulty: v })}>
                  <SelectTrigger className="bg-slate-700/50 border border-slate-600 text-white h-7 font-medium text-[10px]">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className="bg-slate-800 border-slate-700 text-white">
                    <SelectItem value="all">All</SelectItem>
                    <SelectItem value="easy">Easy</SelectItem>
                    <SelectItem value="medium">Medium</SelectItem>
                    <SelectItem value="hard">Hard</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="pt-1.5 border-t border-slate-700/50">
                <label className="text-slate-300 font-medium mb-0.5 block text-[10px]">Search</label>
                <div className="relative">
                  <Search className="absolute left-2 top-1/2 transform -translate-y-1/2 w-3 h-3 text-cyan-400" />
                  <Input
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    placeholder="Search..."
                    className="bg-slate-700/50 border border-slate-600 text-white placeholder:text-slate-500 pl-7 h-7 font-medium text-[10px]"
                  />
                </div>
              </div>

              <Button
                onClick={() => navigate('/admin/questions?create')}
                className="w-full bg-gradient-to-r from-cyan-500 to-blue-500 hover:from-cyan-600 hover:to-blue-600 text-white font-bold h-7 shadow-lg shadow-cyan-500/20 text-[10px] mt-1"
              >
                <Plus className="w-3 h-3 mr-1" />
                Create
              </Button>
            </div>
          </div>

          {/* RIGHT PANEL: Questions List - Takes most of screen */}
          <div className="flex-1 bg-gradient-to-br from-slate-900/95 to-slate-800/95 backdrop-blur-xl border border-slate-700/50 rounded-xl flex flex-col min-h-0 overflow-hidden shadow-2xl">
            <div className="p-4 border-b border-slate-700/50 bg-slate-800/50 backdrop-blur-md flex justify-between items-center">
              <div className="flex items-center gap-2">
                <BookOpen className="w-5 h-5 text-cyan-400" />
                <h3 className="font-bold text-white text-lg">Questions</h3>
              </div>
              <span className="text-slate-300 font-semibold text-sm bg-slate-700/50 px-3 py-1 rounded-md border border-slate-600">
                {filteredQuestions.length} / {questions.length}
              </span>
            </div>

            <div className="flex-1 overflow-y-auto custom-scrollbar">
              {loadingQuestions ? (
                <div className="flex justify-center py-12">
                  <Loader2 className="w-8 h-8 animate-spin text-cyan-400" />
                </div>
              ) : filteredQuestions.length === 0 ? (
                <div className="text-center py-12 text-slate-400">
                  <BookOpen className="w-16 h-16 mx-auto mb-4 opacity-40" />
                  <p className="text-base font-semibold">No questions found</p>
                  {searchTerm && (
                    <p className="text-sm mt-2 text-slate-500">Try adjusting your search or filters</p>
                  )}
                </div>
              ) : (
                <table className="w-full">
                  <thead className="sticky top-0 bg-slate-800/95 backdrop-blur-md border-b border-slate-700/50 z-10">
                    <tr>
                      <th className="text-left p-4 text-slate-300 font-semibold text-xs uppercase tracking-wider">Title</th>
                      <th className="text-left p-4 text-slate-300 font-semibold text-xs uppercase tracking-wider">Subject</th>
                      <th className="text-left p-4 text-slate-300 font-semibold text-xs uppercase tracking-wider">Level</th>
                      <th className="text-left p-4 text-slate-300 font-semibold text-xs uppercase tracking-wider">Difficulty</th>
                      <th className="text-left p-4 text-slate-300 font-semibold text-xs uppercase tracking-wider">Steps</th>
                      <th className="text-left p-4 text-slate-300 font-semibold text-xs uppercase tracking-wider">Marks</th>
                      <th className="text-left p-4 text-slate-300 font-semibold text-xs uppercase tracking-wider">ID</th>
                      <th className="text-left p-4 text-slate-300 font-semibold text-xs uppercase tracking-wider">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredQuestions.map((q, idx) => (
                      <tr
                        key={q.id}
                        onClick={() => {
                          setSelectedQuestionId(q.id);
                          navigate(`/admin/questions?edit=${q.id}`);
                        }}
                        className={`border-b border-slate-700/30 cursor-pointer transition-all duration-150 group ${
                          selectedQuestionId === q.id
                            ? 'bg-cyan-500/20 hover:bg-cyan-500/25'
                            : 'bg-slate-800/30 hover:bg-slate-700/40'
                        } ${idx % 2 === 0 ? 'bg-slate-800/20' : 'bg-slate-800/10'}`}
                      >
                        <td className="p-4">
                          <div className="font-semibold text-white text-sm">{q.title}</div>
                        </td>
                        <td className="p-4">
                          <Badge
                            className={`text-xs font-semibold border ${
                              q.subject === 'math'
                                ? 'bg-blue-500/30 text-blue-200 border-blue-400/50'
                                : q.subject === 'physics'
                                ? 'bg-purple-500/30 text-purple-200 border-purple-400/50'
                                : 'bg-green-500/30 text-green-200 border-green-400/50'
                            }`}
                          >
                            {q.subject}
                          </Badge>
                        </td>
                        <td className="p-4">
                          <Badge className="text-xs font-semibold border border-slate-600 bg-slate-700/50 text-slate-200">
                            {q.level}
                          </Badge>
                        </td>
                        <td className="p-4">
                          <Badge
                            className={`text-xs font-semibold border ${
                              q.difficulty === 'hard'
                                ? 'bg-red-500/30 text-red-200 border-red-400/50'
                                : q.difficulty === 'medium'
                                ? 'bg-yellow-500/30 text-yellow-200 border-yellow-400/50'
                                : 'bg-green-500/30 text-green-200 border-green-400/50'
                            }`}
                          >
                            {q.difficulty}
                          </Badge>
                        </td>
                        <td className="p-4">
                          <span className="text-slate-300 font-medium text-sm">{q.steps.length}</span>
                        </td>
                        <td className="p-4">
                          <span className="text-slate-300 font-medium text-sm">{q.totalMarks}</span>
                        </td>
                        <td className="p-4">
                          <span className="font-mono text-slate-400 text-xs">#{q.id.slice(0, 8)}</span>
                        </td>
                        <td className="p-4">
                          <button
                            onClick={(e) => handleDeleteQuestion(q.id, e)}
                            disabled={deletingId === q.id}
                            className="p-1.5 rounded-md bg-red-500/20 hover:bg-red-500/30 text-red-300 opacity-0 group-hover:opacity-100 transition-opacity border border-red-500/30 disabled:opacity-50"
                            title="Delete question"
                          >
                            {deletingId === q.id ? (
                              <Loader2 className="w-4 h-4 animate-spin" />
                            ) : (
                              <Trash2 className="w-4 h-4" />
                            )}
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>

            {/* Error Display */}
            {mappingErrors.length > 0 && (
              <div className="bg-red-500/20 border-2 border-red-400/50 rounded-xl p-4 shadow-lg m-4">
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
        </div>
      </div>
    </div>
  );
}
