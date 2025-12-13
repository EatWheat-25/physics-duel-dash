import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { StepBasedQuestion, QuestionStep } from '@/types/question-contract';
import { dbRowToQuestion } from '@/lib/question-contract';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { toast } from 'sonner';
import { Loader2, Plus, Trash2, ArrowUp, ArrowDown, Shield, Save, X, Search, Filter } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import SpaceBackground from '@/components/SpaceBackground';
import { useIsAdmin } from '@/hooks/useUserRole';

type QuestionFilter = {
  subject: 'all' | 'math' | 'physics' | 'chemistry';
  level: 'all' | 'A1' | 'A2';
  difficulty: 'all' | 'easy' | 'medium' | 'hard';
  rankTier: string;
};

type EditorMode = 'idle' | 'creating' | 'editing';

type FormStep = {
  id?: string;
  title: string;
  prompt: string;
  options: [string, string, string, string];
  correctAnswer: 0 | 1 | 2 | 3;
  marks: number;
  timeLimitSeconds: number | null;
  explanation: string;
};

type QuestionForm = {
  title: string;
  subject: 'math' | 'physics' | 'chemistry';
  chapter: string;
  level: 'A1' | 'A2';
  difficulty: 'easy' | 'medium' | 'hard';
  rankTier: string;
  stem: string;
  totalMarks: number;
  topicTags: string; // Comma-separated string for editing
  steps: FormStep[];
  imageUrl: string;
};

export default function AdminQuestions() {
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
    rankTier: ''
  });

  // Editor state
  const [mode, setMode] = useState<EditorMode>('idle');
  const [selectedQuestionId, setSelectedQuestionId] = useState<string | null>(null);
  const [form, setForm] = useState<QuestionForm>(getEmptyForm());
  const [saving, setSaving] = useState(false);

  // Load questions on mount and filter changes
  useEffect(() => {
    if (isAdmin) {
      fetchQuestions();
    }
  }, [isAdmin, filters]);

  function getEmptyForm(): QuestionForm {
    return {
      title: '',
      subject: 'math',
      chapter: '',
      level: 'A1',
      difficulty: 'medium',
      rankTier: '',
      stem: '',
      totalMarks: 1,
      topicTags: '',
      steps: [{
        title: 'Step 1',
        prompt: '',
        options: ['', '', '', ''],
        correctAnswer: 0,
        marks: 1,
        timeLimitSeconds: 30,
        explanation: ''
      }],
      imageUrl: ''
    };
  }

  async function fetchQuestions() {
    setLoadingQuestions(true);
    try {
      let query = supabase
        .from('questions_v2')
        .select('*')
        .order('updated_at', { ascending: false });

      if (filters.subject !== 'all') query = query.eq('subject', filters.subject);
      if (filters.level !== 'all') query = query.eq('level', filters.level);
      if (filters.difficulty !== 'all') query = query.eq('difficulty', filters.difficulty);
      if (filters.rankTier.trim()) query = query.eq('rank_tier', filters.rankTier.trim());

      const { data, error } = await query;

      if (error) throw error;

      const mapped = (data || []).map(dbRowToQuestion);
      setQuestions(mapped);
    } catch (error: any) {
      console.error('[AdminQuestions] Error fetching:', error);
      toast.error(error.message || 'Failed to load questions');
    } finally {
      setLoadingQuestions(false);
    }
  }

  function handleNewQuestion() {
    setMode('creating');
    setSelectedQuestionId(null);
    setForm(getEmptyForm());
  }

  function handleSelectQuestion(q: StepBasedQuestion) {
    setMode('editing');
    setSelectedQuestionId(q.id);
    setForm({
      title: q.title,
      subject: q.subject,
      chapter: q.chapter,
      level: q.level,
      difficulty: q.difficulty,
      rankTier: q.rankTier || '',
      stem: q.stem,
      totalMarks: q.totalMarks,
      topicTags: q.topicTags.join(', '),
      steps: q.steps.map(s => ({
        id: s.id,
        title: s.title,
        prompt: s.prompt,
        options: [s.options[0] || '', s.options[1] || '', s.options[2] || '', s.options[3] || ''],
        correctAnswer: s.correctAnswer,
        marks: s.marks,
        timeLimitSeconds: s.timeLimitSeconds,
        explanation: s.explanation
      })),
      imageUrl: q.imageUrl || ''
    });
  }

  function handleAddStep() {
    setForm({
      ...form,
      steps: [
        ...form.steps,
        {
          title: `Step ${form.steps.length + 1}`,
          prompt: '',
          options: ['', '', '', ''],
          correctAnswer: 0,
          marks: 1,
          timeLimitSeconds: 30,
          explanation: ''
        }
      ]
    });
  }

  function handleDeleteStep(index: number) {
    if (form.steps.length <= 1) {
      toast.error('Must have at least 1 step');
      return;
    }
    const newSteps = form.steps.filter((_, i) => i !== index);
    setForm({ ...form, steps: newSteps });
  }

  function handleMoveStepUp(index: number) {
    if (index === 0) return;
    const newSteps = [...form.steps];
    [newSteps[index - 1], newSteps[index]] = [newSteps[index], newSteps[index - 1]];
    setForm({ ...form, steps: newSteps });
  }

  function handleMoveStepDown(index: number) {
    if (index === form.steps.length - 1) return;
    const newSteps = [...form.steps];
    [newSteps[index], newSteps[index + 1]] = [newSteps[index + 1], newSteps[index]];
    setForm({ ...form, steps: newSteps });
  }

  function updateStepField(index: number, field: keyof FormStep, value: any) {
    const newSteps = [...form.steps];
    newSteps[index] = { ...newSteps[index], [field]: value };
    setForm({ ...form, steps: newSteps });
  }

  function updateStepOption(stepIndex: number, optionIndex: number, value: string) {
    const newSteps = [...form.steps];
    const options = [...newSteps[stepIndex].options];
    options[optionIndex] = value;
    newSteps[stepIndex] = { ...newSteps[stepIndex], options: options as [string, string, string, string] };
    setForm({ ...form, steps: newSteps });
  }

  function validateForm(): boolean {
    if (!form.title.trim()) {
      toast.error('Title is required');
      return false;
    }
    if (!form.chapter.trim()) {
      toast.error('Chapter is required');
      return false;
    }
    if (!form.stem.trim()) {
      toast.error('Stem (main question text) is required');
      return false;
    }
    if (form.steps.length < 1) {
      toast.error('At least 1 step is required');
      return false;
    }

    for (let i = 0; i < form.steps.length; i++) {
      const step = form.steps[i];
      if (!step.title.trim() || !step.prompt.trim()) {
        toast.error(`Step ${i + 1}: title and prompt are required`);
        return false;
      }
      if (step.options.some(opt => !opt.trim())) {
        toast.error(`Step ${i + 1}: all 4 options must be filled`);
        return false;
      }
      if (step.correctAnswer < 0 || step.correctAnswer > 3) {
        toast.error(`Step ${i + 1}: correct answer must be 0-3`);
        return false;
      }
    }

    return true;
  }

  async function handleSave() {
    if (!validateForm()) return;

    setSaving(true);
    try {
      const topicTagsArray = form.topicTags
        .split(',')
        .map(t => t.trim())
        .filter(t => t.length > 0);

      // Strict type detection with validation
      const normalize = (s: string) => s.toLowerCase().trim()
      
      const stepsPayload: QuestionStep[] = form.steps.map((s, i) => {
        const nonEmptyOptions = s.options.map(o => o.trim()).filter(Boolean)
        const normalized = nonEmptyOptions.map(normalize).sort().join(',')
        
        // Strict TF detection: exactly 2 options, must be True/False
        const isTrueFalse = nonEmptyOptions.length === 2 && normalized === 'false,true'
        
        // Validate correctAnswer range
        const correct = Number(s.correctAnswer)
        if (Number.isNaN(correct)) {
          throw new Error(`Step ${i + 1}: correctAnswer missing`)
        }
        if (correct < 0 || correct >= nonEmptyOptions.length) {
          throw new Error(`Step ${i + 1}: correctAnswer out of range (must be 0-${nonEmptyOptions.length - 1})`)
        }
        
        return {
          id: s.id || `step-${i + 1}`,
          stepIndex: i,
          type: isTrueFalse ? 'true_false' : 'mcq',
          title: s.title,
          prompt: s.prompt,
          options: nonEmptyOptions, // Only non-empty options
          correctAnswer: correct,
          timeLimitSeconds: s.timeLimitSeconds ?? null,
          marks: s.marks,
          explanation: s.explanation
        }
      });

      const payload = {
        title: form.title,
        subject: form.subject,
        chapter: form.chapter,
        level: form.level,
        difficulty: form.difficulty,
        rank_tier: form.rankTier || null,
        stem: form.stem,
        total_marks: form.totalMarks,
        topic_tags: topicTagsArray,
        steps: stepsPayload,
        image_url: form.imageUrl || null,
      };

      if (mode === 'creating') {
        const { data, error } = await supabase
          .from('questions_v2')
          .insert([payload])
          .select()
          .single();

        if (error) throw error;

        toast.success('Question created successfully!');
        fetchQuestions();
        const newQuestion = dbRowToQuestion(data);
        setMode('editing');
        setSelectedQuestionId(newQuestion.id);
      } else if (mode === 'editing' && selectedQuestionId) {
        const { data, error } = await supabase
          .from('questions_v2')
          .update(payload)
          .eq('id', selectedQuestionId)
          .select()
          .single();

        if (error) throw error;

        toast.success('Question updated successfully!');
        fetchQuestions();
      }
    } catch (error: any) {
      console.error('[AdminQuestions] Save error:', error);
      toast.error(error.message || 'Failed to save question');
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete() {
    if (!selectedQuestionId) return;
    if (!confirm('Are you sure you want to delete this question? This cannot be undone.')) return;

    try {
      const { error } = await supabase
        .from('questions_v2')
        .delete()
        .eq('id', selectedQuestionId);

      if (error) throw error;

      toast.success('Question deleted successfully!');
      setMode('idle');
      setSelectedQuestionId(null);
      setForm(getEmptyForm());
      fetchQuestions();
    } catch (error: any) {
      console.error('[AdminQuestions] Delete error:', error);
      toast.error(error.message || 'Failed to delete question');
    }
  }

  async function handleDeleteFromList(questionId: string, event: React.MouseEvent) {
    event.stopPropagation(); // Prevent selecting the question when clicking delete
    
    if (!confirm('Are you sure you want to delete this question? This cannot be undone.')) {
      return;
    }

    try {
      const { error } = await supabase
        .from('questions_v2')
        .delete()
        .eq('id', questionId);

      if (error) throw error;

      toast.success('Question deleted successfully!');
      
      // If deleted question was selected, clear selection
      if (selectedQuestionId === questionId) {
        setMode('idle');
        setSelectedQuestionId(null);
        setForm(getEmptyForm());
      }
      
      fetchQuestions();
    } catch (error: any) {
      console.error('[AdminQuestions] Delete error:', error);
      toast.error(error.message || 'Failed to delete question');
    }
  }

  // Common styles
  const glassPanel = "bg-white/10 backdrop-blur-xl border border-white/20 rounded-3xl overflow-hidden shadow-xl";
  const glassInput = "bg-white/5 border-white/10 text-white placeholder:text-white/30 focus:border-primary/50 focus:ring-primary/20";
  const labelStyle = "text-white/70 font-medium mb-1.5 block text-sm";

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
        <div className={`relative z-10 max-w-md w-full p-8 ${glassPanel} text-center`}>
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

      <div className="relative z-10 max-w-[1600px] mx-auto p-6">
        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-4xl font-black text-white mb-2 tracking-tight" style={{ fontFamily: 'Roboto, sans-serif' }}>
              ADMIN <span className="text-transparent bg-clip-text bg-gradient-to-r from-amber-400 to-orange-500">DASHBOARD</span>
            </h1>
            <p className="text-white/60 font-medium">Manage battle questions and content</p>
          </div>
          <Button
            onClick={() => navigate('/')}
            variant="ghost"
            className="text-white/70 hover:text-white hover:bg-white/10"
          >
            Exit to App
          </Button>
        </div>

        {/* Two-column layout */}
        <div className="grid grid-cols-1 lg:grid-cols-[350px_1fr] gap-8 h-[calc(100vh-140px)]">

          {/* LEFT PANEL: Filters & List */}
          <div className="flex flex-col gap-6 h-full overflow-hidden">

            {/* Filters */}
            <div className={`p-5 ${glassPanel} space-y-4`}>
              <div className="flex items-center gap-2 text-white/90 font-bold uppercase tracking-wider text-sm mb-2">
                <Filter className="w-4 h-4 text-primary" />
                Filters
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className={labelStyle}>Subject</label>
                  <Select value={filters.subject} onValueChange={(v: any) => setFilters({ ...filters, subject: v })}>
                    <SelectTrigger className={glassInput}>
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
                  <label className={labelStyle}>Level</label>
                  <Select value={filters.level} onValueChange={(v: any) => setFilters({ ...filters, level: v })}>
                    <SelectTrigger className={glassInput}>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent className="bg-gray-900 border-white/10 text-white">
                      <SelectItem value="all">All</SelectItem>
                      <SelectItem value="A1">A1</SelectItem>
                      <SelectItem value="A2">A2</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <Button
                onClick={handleNewQuestion}
                className="w-full bg-gradient-to-r from-amber-400 to-orange-500 hover:from-amber-500 hover:to-orange-600 text-gray-900 font-bold h-10 shadow-lg shadow-orange-500/20"
              >
                <Plus className="w-4 h-4 mr-2" />
                Create New Question
              </Button>
            </div>

            {/* Question List */}
            <div className={`flex-1 ${glassPanel} flex flex-col min-h-0`}>
              <div className="p-4 border-b border-white/10 bg-white/5 backdrop-blur-md flex justify-between items-center">
                <h3 className="font-bold text-white flex items-center gap-2">
                  <Search className="w-4 h-4 text-primary" />
                  Questions <span className="text-white/40 text-sm font-normal">({questions.length})</span>
                </h3>
              </div>

              <div className="flex-1 overflow-y-auto p-3 space-y-2 custom-scrollbar">
                {loadingQuestions ? (
                  <div className="flex justify-center py-12">
                    <Loader2 className="w-8 h-8 animate-spin text-primary" />
                  </div>
                ) : questions.length === 0 ? (
                  <div className="text-center py-12 text-white/40">
                    <p>No questions found</p>
                  </div>
                ) : (
                  questions.map((q) => (
                    <div
                      key={q.id}
                      onClick={() => handleSelectQuestion(q)}
                      className={`p-4 rounded-xl cursor-pointer transition-all duration-200 border relative group ${selectedQuestionId === q.id
                          ? 'bg-primary/20 border-primary/50 shadow-[0_0_15px_rgba(var(--primary),0.3)]'
                          : 'bg-white/5 border-transparent hover:bg-white/10 hover:border-white/10'
                        }`}
                    >
                      {/* Delete button - appears on hover */}
                      <button
                        onClick={(e) => handleDeleteFromList(q.id, e)}
                        className="absolute top-2 right-2 p-1.5 rounded-lg bg-red-500/10 hover:bg-red-500/20 text-red-400 opacity-0 group-hover:opacity-100 transition-opacity border border-red-500/20 z-10"
                        title="Delete question"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                      
                      <div className="font-bold text-white mb-2 line-clamp-2 text-sm pr-8">{q.title}</div>
                      <div className="flex flex-wrap gap-1.5 mb-2">
                        <Badge variant="outline" className={`text-[10px] uppercase tracking-wider border-0 ${q.subject === 'math' ? 'bg-blue-500/20 text-blue-300' :
                            q.subject === 'physics' ? 'bg-purple-500/20 text-purple-300' : 'bg-green-500/20 text-green-300'
                          }`}>
                          {q.subject}
                        </Badge>
                        <Badge variant="outline" className="text-[10px] border-white/10 bg-white/5 text-white/70">{q.level}</Badge>
                        <Badge variant="outline" className={`text-[10px] border-0 ${q.difficulty === 'hard' ? 'bg-red-500/20 text-red-300' :
                            q.difficulty === 'medium' ? 'bg-yellow-500/20 text-yellow-300' : 'bg-green-500/20 text-green-300'
                          }`}>
                          {q.difficulty}
                        </Badge>
                      </div>
                      <div className="text-[10px] text-white/40 font-medium flex justify-between">
                        <span>{q.steps.length} Steps</span>
                        <span>{q.totalMarks} Marks</span>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>

          {/* RIGHT PANEL: Editor */}
          <div className={`${glassPanel} flex flex-col h-full overflow-hidden relative`}>
            {mode === 'idle' ? (
              <div className="flex-1 flex flex-col items-center justify-center text-white/30">
                <div className="w-24 h-24 rounded-full bg-white/5 flex items-center justify-center mb-6">
                  <Shield className="w-10 h-10" />
                </div>
                <h3 className="text-xl font-bold text-white/50 mb-2">Ready to Edit</h3>
                <p>Select a question or create a new one</p>
              </div>
            ) : (
              <>
                {/* Editor Header */}
                <div className="p-6 border-b border-white/10 bg-white/5 flex justify-between items-center sticky top-0 z-20 backdrop-blur-xl">
                  <div>
                    <h2 className="text-xl font-black text-white tracking-wide">
                      {mode === 'creating' ? 'NEW QUESTION' : 'EDIT QUESTION'}
                    </h2>
                    <p className="text-xs text-white/50 font-mono mt-1 uppercase tracking-widest">
                      {mode === 'creating' ? 'DRAFTING MODE' : `ID: ${selectedQuestionId?.slice(0, 8)}...`}
                    </p>
                  </div>
                  <div className="flex gap-3">
                    {mode === 'editing' && (
                      <Button
                        onClick={handleDelete}
                        variant="destructive"
                        className="bg-red-500/10 hover:bg-red-500/20 text-red-400 border border-red-500/20"
                      >
                        <Trash2 className="w-4 h-4 mr-2" />
                        Delete
                      </Button>
                    )}
                    <Button
                      onClick={handleSave}
                      disabled={saving}
                      className="bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-600 hover:to-teal-600 text-white font-bold shadow-lg shadow-emerald-500/20 border-0"
                    >
                      {saving ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Save className="w-4 h-4 mr-2" />}
                      Save Changes
                    </Button>
                  </div>
                </div>

                {/* Editor Content */}
                <div className="flex-1 overflow-y-auto p-8 space-y-8 custom-scrollbar">

                  {/* Section: Meta */}
                  <div className="space-y-6">
                    <h3 className="text-lg font-bold text-white/90 border-b border-white/10 pb-2 flex items-center gap-2">
                      <div className="w-1 h-5 bg-primary rounded-full"></div>
                      Meta Information
                    </h3>

                    <div className="grid grid-cols-2 gap-6">
                      <div className="col-span-2">
                        <label className={labelStyle}>Title *</label>
                        <Input
                          value={form.title}
                          onChange={e => setForm({ ...form, title: e.target.value })}
                          className={glassInput}
                          placeholder="e.g. Integration by Parts: ln(x)/x³"
                        />
                      </div>

                      <div>
                        <label className={labelStyle}>Subject *</label>
                        <Select value={form.subject} onValueChange={(v: any) => setForm({ ...form, subject: v })}>
                          <SelectTrigger className={glassInput}><SelectValue /></SelectTrigger>
                          <SelectContent className="bg-gray-900 border-white/10 text-white">
                            <SelectItem value="math">Math</SelectItem>
                            <SelectItem value="physics">Physics</SelectItem>
                            <SelectItem value="chemistry">Chemistry</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>

                      <div>
                        <label className={labelStyle}>Chapter *</label>
                        <Input
                          value={form.chapter}
                          onChange={e => setForm({ ...form, chapter: e.target.value })}
                          className={glassInput}
                          placeholder="e.g. Integration"
                        />
                      </div>

                      <div className="grid grid-cols-2 gap-4">
                        <div>
                          <label className={labelStyle}>Level *</label>
                          <Select value={form.level} onValueChange={(v: any) => setForm({ ...form, level: v })}>
                            <SelectTrigger className={glassInput}><SelectValue /></SelectTrigger>
                            <SelectContent className="bg-gray-900 border-white/10 text-white">
                              <SelectItem value="A1">A1</SelectItem>
                              <SelectItem value="A2">A2</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>
                        <div>
                          <label className={labelStyle}>Difficulty *</label>
                          <Select value={form.difficulty} onValueChange={(v: any) => setForm({ ...form, difficulty: v })}>
                            <SelectTrigger className={glassInput}><SelectValue /></SelectTrigger>
                            <SelectContent className="bg-gray-900 border-white/10 text-white">
                              <SelectItem value="easy">Easy</SelectItem>
                              <SelectItem value="medium">Medium</SelectItem>
                              <SelectItem value="hard">Hard</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>
                      </div>

                      <div>
                        <label className={labelStyle}>Total Marks</label>
                        <Input
                          type="number"
                          value={form.totalMarks}
                          onChange={e => setForm({ ...form, totalMarks: parseInt(e.target.value) || 1 })}
                          className={glassInput}
                        />
                      </div>

                      <div className="col-span-2">
                        <label className={labelStyle}>Stem (Main Question) *</label>
                        <Textarea
                          value={form.stem}
                          onChange={e => setForm({ ...form, stem: e.target.value })}
                          className={`${glassInput} min-h-[100px]`}
                          placeholder="Enter the main question text here..."
                        />
                      </div>

                      <div className="col-span-2">
                        <label className={labelStyle}>Image URL (Optional)</label>
                        <Input
                          value={form.imageUrl}
                          onChange={e => setForm({ ...form, imageUrl: e.target.value })}
                          className={glassInput}
                          placeholder="https://..."
                        />
                      </div>
                    </div>
                  </div>

                  {/* Section: Steps */}
                  <div className="space-y-6">
                    <div className="flex items-center justify-between border-b border-white/10 pb-2">
                      <h3 className="text-lg font-bold text-white/90 flex items-center gap-2">
                        <div className="w-1 h-5 bg-secondary rounded-full"></div>
                        Steps ({form.steps.length})
                      </h3>
                      <Button
                        onClick={handleAddStep}
                        size="sm"
                        className="bg-white/10 hover:bg-white/20 text-white border border-white/10"
                      >
                        <Plus className="w-4 h-4 mr-2" /> Add Step
                      </Button>
                    </div>

                    <div className="space-y-6">
                      {form.steps.map((step, index) => (
                        <div key={index} className="bg-white/5 border border-white/10 rounded-2xl p-6 relative group">
                          <div className="absolute top-4 right-4 flex gap-2 opacity-50 group-hover:opacity-100 transition-opacity">
                            <Button size="icon" variant="ghost" className="h-8 w-8 text-white/70 hover:bg-white/10" onClick={() => handleMoveStepUp(index)} disabled={index === 0}><ArrowUp className="w-4 h-4" /></Button>
                            <Button size="icon" variant="ghost" className="h-8 w-8 text-white/70 hover:bg-white/10" onClick={() => handleMoveStepDown(index)} disabled={index === form.steps.length - 1}><ArrowDown className="w-4 h-4" /></Button>
                            <Button size="icon" variant="ghost" className="h-8 w-8 text-red-400 hover:bg-red-500/20" onClick={() => handleDeleteStep(index)} disabled={form.steps.length <= 1}><Trash2 className="w-4 h-4" /></Button>
                          </div>

                          <div className="mb-4 flex items-center gap-2">
                            <Badge className="bg-primary/20 text-primary hover:bg-primary/30 border-0">STEP {index + 1}</Badge>
                            {(() => {
                              // Live type detection
                              const normalize = (s: string) => s.toLowerCase().trim()
                              const nonEmptyOptions = step.options.map(o => o.trim()).filter(Boolean)
                              const normalized = nonEmptyOptions.map(normalize).sort().join(',')
                              const isTrueFalse = nonEmptyOptions.length === 2 && normalized === 'false,true'
                              const isValid = nonEmptyOptions.length >= 2 && step.correctAnswer >= 0 && step.correctAnswer < nonEmptyOptions.length
                              
                              if (!isValid) {
                                return <Badge className="bg-red-500/20 text-red-400 border-red-500/50">⚠️ Invalid config</Badge>
                              }
                              return isTrueFalse 
                                ? <Badge className="bg-green-500/20 text-green-400 border-green-500/50">✅ True/False</Badge>
                                : <Badge className="bg-blue-500/20 text-blue-400 border-blue-500/50">✅ MCQ</Badge>
                            })()}
                          </div>

                          <div className="grid grid-cols-1 gap-4">
                            <div>
                              <label className={labelStyle}>Step Title</label>
                              <Input
                                value={step.title}
                                onChange={e => updateStepField(index, 'title', e.target.value)}
                                className={glassInput}
                              />
                            </div>
                            <div>
                              <label className={labelStyle}>Prompt</label>
                              <Textarea
                                value={step.prompt}
                                onChange={e => updateStepField(index, 'prompt', e.target.value)}
                                className={`${glassInput} min-h-[80px]`}
                              />
                            </div>

                            <div className="grid grid-cols-2 gap-4 bg-black/20 p-4 rounded-xl border border-white/5">
                              {[0, 1, 2, 3].map((optIdx) => (
                                <div key={optIdx}>
                                  <label className="text-xs text-white/50 mb-1 block uppercase tracking-wider">Option {String.fromCharCode(65 + optIdx)}</label>
                                  <div className="flex items-center gap-2">
                                    <div className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold ${step.correctAnswer === optIdx ? 'bg-green-500 text-black' : 'bg-white/10 text-white/50'}`}>
                                      {String.fromCharCode(65 + optIdx)}
                                    </div>
                                    <Input
                                      value={step.options[optIdx]}
                                      onChange={e => updateStepOption(index, optIdx, e.target.value)}
                                      className={`${glassInput} h-9 text-sm`}
                                    />
                                  </div>
                                </div>
                              ))}
                            </div>

                            <div className="grid grid-cols-3 gap-4">
                              <div>
                                <label className={labelStyle}>Correct Answer</label>
                                <Select value={step.correctAnswer.toString()} onValueChange={(v) => updateStepField(index, 'correctAnswer', parseInt(v))}>
                                  <SelectTrigger className={glassInput}><SelectValue /></SelectTrigger>
                                  <SelectContent className="bg-gray-900 border-white/10 text-white">
                                    <SelectItem value="0">Option A</SelectItem>
                                    <SelectItem value="1">Option B</SelectItem>
                                    <SelectItem value="2">Option C</SelectItem>
                                    <SelectItem value="3">Option D</SelectItem>
                                  </SelectContent>
                                </Select>
                              </div>
                              <div>
                                <label className={labelStyle}>Marks</label>
                                <Input type="number" value={step.marks} onChange={e => updateStepField(index, 'marks', parseInt(e.target.value) || 1)} className={glassInput} />
                              </div>
                              <div>
                                <label className={labelStyle}>Time (s)</label>
                                <Input type="number" value={step.timeLimitSeconds ?? ''} onChange={e => updateStepField(index, 'timeLimitSeconds', e.target.value ? parseInt(e.target.value) : null)} className={glassInput} placeholder="30" />
                              </div>
                            </div>

                            <div>
                              <label className={labelStyle}>Explanation</label>
                              <Textarea
                                value={step.explanation}
                                onChange={e => updateStepField(index, 'explanation', e.target.value)}
                                className={`${glassInput} h-20 text-sm`}
                                placeholder="Explain why the answer is correct..."
                              />
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>

                </div>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
