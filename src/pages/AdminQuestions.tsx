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
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { toast } from 'sonner';
import { Loader2, Plus, Trash2, ArrowUp, ArrowDown, Shield } from 'lucide-react';
import { Badge } from '@/components/ui/badge';

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

  // Access control
  const [isAdmin, setIsAdmin] = useState(false);
  const [checkingAdmin, setCheckingAdmin] = useState(true);

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

  // Check admin access
  useEffect(() => {
    if (!authLoading && user) {
      const role = user.user_metadata?.role;
      setIsAdmin(role === 'admin');
      setCheckingAdmin(false);
    } else if (!authLoading && !user) {
      setCheckingAdmin(false);
    }
  }, [user, authLoading]);

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

      const stepsPayload: QuestionStep[] = form.steps.map((s, i) => ({
        id: s.id || `step-${i + 1}`,
        stepIndex: i,
        type: 'mcq',
        title: s.title,
        prompt: s.prompt,
        options: s.options,
        correctAnswer: s.correctAnswer,
        timeLimitSeconds: s.timeLimitSeconds ?? null,
        marks: s.marks,
        explanation: s.explanation
      }));

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

  // Loading state
  if (authLoading || checkingAdmin) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin" />
      </div>
    );
  }

  // Not logged in
  if (!user) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Card className="max-w-md">
          <CardContent className="p-6 text-center">
            <Shield className="w-12 h-12 mx-auto mb-4 text-muted-foreground" />
            <p className="text-muted-foreground mb-4">Please login to access admin panel</p>
            <Button onClick={() => navigate('/auth')}>Go to Login</Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  // Not admin
  if (!isAdmin) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Card className="max-w-md">
          <CardContent className="p-6 text-center">
            <Shield className="w-12 h-12 mx-auto mb-4 text-destructive" />
            <p className="text-destructive font-semibold mb-2">Access Denied</p>
            <p className="text-muted-foreground mb-4">Admin privileges required</p>
            <Button onClick={() => navigate('/')}>Go to Home</Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  // Main UI
  return (
    <div className="min-h-screen bg-background p-6">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="mb-6">
          <h1 className="text-3xl font-bold">Admin · Questions</h1>
          <p className="text-muted-foreground">Create, edit and manage battle questions (questions_v2)</p>
        </div>

        {/* Two-column layout */}
        <div className="grid grid-cols-1 lg:grid-cols-[35%_65%] gap-6">
          {/* LEFT PANEL: Question List */}
          <div className="space-y-4">
            {/* Filter Bar */}
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Filters</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <div>
                  <Label>Subject</Label>
                  <Select
                    value={filters.subject}
                    onValueChange={(val: any) => setFilters({ ...filters, subject: val })}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All</SelectItem>
                      <SelectItem value="math">Math</SelectItem>
                      <SelectItem value="physics">Physics</SelectItem>
                      <SelectItem value="chemistry">Chemistry</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div>
                  <Label>Level</Label>
                  <Select
                    value={filters.level}
                    onValueChange={(val: any) => setFilters({ ...filters, level: val })}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All</SelectItem>
                      <SelectItem value="A1">A1</SelectItem>
                      <SelectItem value="A2">A2</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div>
                  <Label>Difficulty</Label>
                  <Select
                    value={filters.difficulty}
                    onValueChange={(val: any) => setFilters({ ...filters, difficulty: val })}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All</SelectItem>
                      <SelectItem value="easy">Easy</SelectItem>
                      <SelectItem value="medium">Medium</SelectItem>
                      <SelectItem value="hard">Hard</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div>
                  <Label>Rank Tier</Label>
                  <Input
                    value={filters.rankTier}
                    onChange={(e) => setFilters({ ...filters, rankTier: e.target.value })}
                    placeholder="Filter by rank"
                  />
                </div>
              </CardContent>
            </Card>

            {/* New Question Button */}
            <Button onClick={handleNewQuestion} className="w-full">
              <Plus className="w-4 h-4 mr-2" />
              New Question
            </Button>

            {/* Question List */}
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">
                  Questions ({questions.length})
                </CardTitle>
              </CardHeader>
              <CardContent>
                {loadingQuestions ? (
                  <div className="flex justify-center py-8">
                    <Loader2 className="w-6 h-6 animate-spin" />
                  </div>
                ) : questions.length === 0 ? (
                  <p className="text-muted-foreground text-sm text-center py-8">
                    No questions found
                  </p>
                ) : (
                  <div className="space-y-2 max-h-[600px] overflow-y-auto">
                    {questions.map((q) => (
                      <div
                        key={q.id}
                        onClick={() => handleSelectQuestion(q)}
                        className={`p-3 border rounded cursor-pointer transition-colors ${selectedQuestionId === q.id
                            ? 'bg-primary/10 border-primary'
                            : 'hover:bg-muted'
                          }`}
                      >
                        <div className="font-medium text-sm mb-1 line-clamp-1">{q.title}</div>
                        <div className="flex flex-wrap gap-1 mb-1">
                          <Badge variant="secondary" className="text-xs">{q.subject}</Badge>
                          <Badge variant="secondary" className="text-xs">{q.level}</Badge>
                          <Badge variant="secondary" className="text-xs">{q.difficulty}</Badge>
                          {q.rankTier && (
                            <Badge variant="outline" className="text-xs">{q.rankTier}</Badge>
                          )}
                        </div>
                        <div className="text-xs text-muted-foreground">
                          {q.steps.length} steps • {q.totalMarks} marks
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </div>

          {/* RIGHT PANEL: Question Editor */}
          <Card>
            <CardHeader>
              <CardTitle>
                {mode === 'idle' && 'Select a question or create new'}
                {mode === 'creating' && 'Create New Question'}
                {mode === 'editing' && 'Edit Question'}
              </CardTitle>
            </CardHeader>
            <CardContent>
              {mode === 'idle' ? (
                <div className="text-center py-12 text-muted-foreground">
                  <Shield className="w-16 h-16 mx-auto mb-4 opacity-50" />
                  <p>Select a question from the list to edit</p>
                  <p className="text-sm">or click "New Question" to create one</p>
                </div>
              ) : (
                <div className="space-y-6 max-h-[70vh] overflow-y-auto pr-2">
                  {/* Meta Information */}
                  <div className="space-y-4 border-b pb-6">
                    <h3 className="font-semibold">Meta Information</h3>

                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <Label>Title *</Label>
                        <Input
                          value={form.title}
                          onChange={(e) => setForm({ ...form, title: e.target.value })}
                          placeholder="Integration by Parts: ln(x)/x³"
                        />
                      </div>

                      <div>
                        <Label>Subject *</Label>
                        <Select
                          value={form.subject}
                          onValueChange={(val: any) => setForm({ ...form, subject: val })}
                        >
                          <SelectTrigger>
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="math">Math</SelectItem>
                            <SelectItem value="physics">Physics</SelectItem>
                            <SelectItem value="chemistry">Chemistry</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>

                      <div>
                        <Label>Chapter *</Label>
                        <Input
                          value={form.chapter}
                          onChange={(e) => setForm({ ...form, chapter: e.target.value })}
                          placeholder="Integration"
                        />
                      </div>

                      <div>
                        <Label>Level *</Label>
                        <Select
                          value={form.level}
                          onValueChange={(val: any) => setForm({ ...form, level: val })}
                        >
                          <SelectTrigger>
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="A1">A1</SelectItem>
                            <SelectItem value="A2">A2</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>

                      <div>
                        <Label>Difficulty *</Label>
                        <Select
                          value={form.difficulty}
                          onValueChange={(val: any) => setForm({ ...form, difficulty: val })}
                        >
                          <SelectTrigger>
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="easy">Easy</SelectItem>
                            <SelectItem value="medium">Medium</SelectItem>
                            <SelectItem value="hard">Hard</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>

                      <div>
                        <Label>Rank Tier</Label>
                        <Input
                          value={form.rankTier}
                          onChange={(e) => setForm({ ...form, rankTier: e.target.value })}
                          placeholder="Silver"
                        />
                      </div>

                      <div>
                        <Label>Total Marks *</Label>
                        <Input
                          type="number"
                          min={1}
                          value={form.totalMarks}
                          onChange={(e) => setForm({ ...form, totalMarks: parseInt(e.target.value) || 1 })}
                        />
                      </div>

                      <div>
                        <Label>Topic Tags</Label>
                        <Input
                          value={form.topicTags}
                          onChange={(e) => setForm({ ...form, topicTags: e.target.value })}
                          placeholder="integration, by-parts"
                        />
                        <p className="text-xs text-muted-foreground mt-1">Comma-separated</p>
                      </div>
                    </div>

                    <div>
                      <Label>Stem (Main Question Text) *</Label>
                      <Textarea
                        value={form.stem}
                        onChange={(e) => setForm({ ...form, stem: e.target.value })}
                        placeholder="Find the integral of ln(x)/x³ using integration by parts."
                        rows={3}
                      />
                    </div>

                    <div>
                      <Label>Image URL</Label>
                      <Input
                        value={form.imageUrl}
                        onChange={(e) => setForm({ ...form, imageUrl: e.target.value })}
                        placeholder="https://example.com/image.png"
                      />
                    </div>
                  </div>

                  {/* Steps Editor */}
                  <div className="space-y-4">
                    <div className="flex items-center justify-between">
                      <h3 className="font-semibold">Steps ({form.steps.length})</h3>
                      <Button onClick={handleAddStep} size="sm">
                        <Plus className="w-4 h-4 mr-1" />
                        Add Step
                      </Button>
                    </div>

                    {form.steps.map((step, index) => (
                      <Card key={index} className="border-l-4 border-l-primary">
                        <CardContent className="pt-4 space-y-3">
                          <div className="flex items-center justify-between">
                            <h4 className="font-medium">Step {index + 1}</h4>
                            <div className="flex gap-1">
                              <Button
                                size="sm"
                                variant="ghost"
                                onClick={() => handleMoveStepUp(index)}
                                disabled={index === 0}
                              >
                                <ArrowUp className="w-4 h-4" />
                              </Button>
                              <Button
                                size="sm"
                                variant="ghost"
                                onClick={() => handleMoveStepDown(index)}
                                disabled={index === form.steps.length - 1}
                              >
                                <ArrowDown className="w-4 h-4" />
                              </Button>
                              <Button
                                size="sm"
                                variant="ghost"
                                onClick={() => handleDeleteStep(index)}
                                disabled={form.steps.length <= 1}
                              >
                                <Trash2 className="w-4 h-4" />
                              </Button>
                            </div>
                          </div>

                          <div>
                            <Label>Step Title *</Label>
                            <Input
                              value={step.title}
                              onChange={(e) => updateStepField(index, 'title', e.target.value)}
                              placeholder="Choose u and dv"
                            />
                          </div>

                          <div>
                            <Label>Prompt (Sub-question) *</Label>
                            <Textarea
                              value={step.prompt}
                              onChange={(e) => updateStepField(index, 'prompt', e.target.value)}
                              placeholder="In integration by parts (∫u dv = uv - ∫v du), which should be u?"
                              rows={2}
                            />
                          </div>

                          <div className="grid grid-cols-2 gap-2">
                            {[0, 1, 2, 3].map((optIdx) => (
                              <div key={optIdx}>
                                <Label>Option {String.fromCharCode(65 + optIdx)} *</Label>
                                <Input
                                  value={step.options[optIdx]}
                                  onChange={(e) => updateStepOption(index, optIdx, e.target.value)}
                                  placeholder={`Option ${String.fromCharCode(65 + optIdx)}`}
                                />
                              </div>
                            ))}
                          </div>

                          <div className="grid grid-cols-3 gap-2">
                            <div>
                              <Label>Correct Answer *</Label>
                              <Select
                                value={step.correctAnswer.toString()}
                                onValueChange={(val) => updateStepField(index, 'correctAnswer', parseInt(val))}
                              >
                                <SelectTrigger>
                                  <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                  <SelectItem value="0">A</SelectItem>
                                  <SelectItem value="1">B</SelectItem>
                                  <SelectItem value="2">C</SelectItem>
                                  <SelectItem value="3">D</SelectItem>
                                </SelectContent>
                              </Select>
                            </div>

                            <div>
                              <Label>Marks *</Label>
                              <Input
                                type="number"
                                min={1}
                                value={step.marks}
                                onChange={(e) => updateStepField(index, 'marks', parseInt(e.target.value) || 1)}
                              />
                            </div>

                            <div>
                              <Label>Time Limit (s)</Label>
                              <Input
                                type="number"
                                min={0}
                                value={step.timeLimitSeconds ?? ''}
                                onChange={(e) => updateStepField(index, 'timeLimitSeconds', e.target.value ? parseInt(e.target.value) : null)}
                                placeholder="30"
                              />
                            </div>
                          </div>

                          <div>
                            <Label>Explanation *</Label>
                            <Textarea
                              value={step.explanation}
                              onChange={(e) => updateStepField(index, 'explanation', e.target.value)}
                              placeholder="Why this answer is correct..."
                              rows={2}
                            />
                          </div>
                        </CardContent>
                      </Card>
                    ))}
                  </div>

                  {/* Action Buttons */}
                  <div className="flex gap-2 pt-4 border-t">
                    <Button onClick={handleSave} disabled={saving} className="flex-1">
                      {saving ? (
                        <>
                          <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                          Saving...
                        </>
                      ) : (
                        'Save Question'
                      )}
                    </Button>

                    {mode === 'editing' && (
                      <Button onClick={handleDelete} variant="destructive">
                        <Trash2 className="w-4 h-4 mr-2" />
                        Delete
                      </Button>
                    )}
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
