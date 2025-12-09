import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { useQuestions, useAddQuestion, useUpdateQuestion, useDeleteQuestion } from '@/hooks/useQuestions';
import { StepBasedQuestion, QuestionStep } from '@/types/questions';
import { mapRawToQuestion } from '@/utils/questionMapper';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { toast } from 'sonner';
import { 
  Loader2, Plus, Trash2, Edit2, Search, Filter, 
  Shield, Save, X, ArrowLeft, CheckCircle2, XCircle 
} from 'lucide-react';
import { LoadingScreen } from '@/components/LoadingScreen';

const ADMIN_EMAIL = 'noffalnawaz65@gmail.com';

type QuestionFilter = {
  subject: 'all' | 'math' | 'physics' | 'chemistry';
  level: 'all' | 'A1' | 'A2';
  difficulty: 'all' | 'easy' | 'medium' | 'hard';
  type: 'all' | 'true_false' | 'mcq';
  search: string;
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
  topicTags: string;
  steps: FormStep[];
  imageUrl: string;
};

export default function AdminQuestions() {
  const navigate = useNavigate();
  const { user, loading: authLoading } = useAuth();

  // Access control
  const isAuthorized = user?.email === ADMIN_EMAIL;

  // Filters
  const [filters, setFilters] = useState<QuestionFilter>({
    subject: 'all',
    level: 'all',
    difficulty: 'all',
    type: 'all',
    search: ''
  });

  // Question list
  const { data: questions = [], isLoading: loadingQuestions } = useQuestions();

  // Editor state
  const [mode, setMode] = useState<EditorMode>('idle');
  const [selectedQuestionId, setSelectedQuestionId] = useState<string | null>(null);
  const [form, setForm] = useState<QuestionForm>(getEmptyForm());
  const [saving, setSaving] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [questionToDelete, setQuestionToDelete] = useState<string | null>(null);

  // Mutations
  const addQuestion = useAddQuestion();
  const updateQuestion = useUpdateQuestion();
  const deleteQuestion = useDeleteQuestion();

  // Show loading while checking auth
  if (authLoading) {
    return <LoadingScreen />;
  }

  // Access denied
  if (!isAuthorized) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 flex items-center justify-center p-4">
        <Card className="max-w-md w-full bg-slate-800 border-slate-700">
          <CardHeader>
            <div className="flex items-center gap-3 mb-2">
              <Shield className="w-8 h-8 text-red-500" />
              <CardTitle className="text-2xl text-white">Access Denied</CardTitle>
            </div>
            <CardDescription className="text-slate-400">
              Only authorized administrators can access this panel.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Button onClick={() => navigate('/')} className="w-full">
              <ArrowLeft className="w-4 h-4 mr-2" />
              Return to Home
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  // Filter questions
  const filteredQuestions = questions.filter(q => {
    if (filters.subject !== 'all' && q.subject !== filters.subject) return false;
    if (filters.level !== 'all' && q.level !== filters.level) return false;
    if (filters.difficulty !== 'all' && q.difficulty !== filters.difficulty) return false;
    if (filters.type !== 'all') {
      const firstStepType = q.steps[0]?.type;
      if (filters.type === 'true_false' && firstStepType !== 'true_false') return false;
      if (filters.type === 'mcq' && firstStepType !== 'mcq') return false;
    }
    if (filters.search) {
      const searchLower = filters.search.toLowerCase();
      if (!q.title.toLowerCase().includes(searchLower) &&
          !q.stem.toLowerCase().includes(searchLower) &&
          !q.chapter.toLowerCase().includes(searchLower)) {
        return false;
      }
    }
    return true;
  });

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

  function handleNewQuestion() {
    setMode('creating');
    setSelectedQuestionId(null);
    setForm(getEmptyForm());
  }

  function handleSelectQuestion(q: StepBasedQuestion) {
    setMode('editing');
    setSelectedQuestionId(q.id);
    
    // Convert question to form format
    const topicTagsStr = q.topicTags.join(', ');
    const steps: FormStep[] = q.steps.map(step => {
      // Pad options to 4 for form
      const paddedOptions: [string, string, string, string] = [
        step.options[0] || '',
        step.options[1] || '',
        step.options[2] || '',
        step.options[3] || ''
      ];
      
      return {
        id: step.id,
        title: step.title,
        prompt: step.prompt,
        options: paddedOptions,
        correctAnswer: step.correctAnswer,
        marks: step.marks,
        timeLimitSeconds: step.timeLimitSeconds,
        explanation: step.explanation || ''
      };
    });

    setForm({
      title: q.title,
      subject: q.subject,
      chapter: q.chapter,
      level: q.level,
      difficulty: q.difficulty,
      rankTier: q.rankTier || '',
      stem: q.stem,
      totalMarks: q.totalMarks,
      topicTags: topicTagsStr,
      steps,
      imageUrl: q.imageUrl || ''
    });
  }

  function handleDeleteClick(id: string) {
    setQuestionToDelete(id);
    setDeleteDialogOpen(true);
  }

  async function handleDeleteConfirm() {
    if (!questionToDelete) return;

    try {
      await deleteQuestion.mutateAsync(questionToDelete);
      toast.success('Question deleted successfully');
      setDeleteDialogOpen(false);
      setQuestionToDelete(null);
      if (selectedQuestionId === questionToDelete) {
        setMode('idle');
        setSelectedQuestionId(null);
      }
    } catch (error: any) {
      toast.error(error.message || 'Failed to delete question');
    }
  }

  function updateFormField(field: keyof QuestionForm, value: any) {
    setForm(prev => ({ ...prev, [field]: value }));
  }

  function updateStepField(stepIndex: number, field: keyof FormStep, value: any) {
    setForm(prev => {
      const newSteps = [...prev.steps];
      newSteps[stepIndex] = { ...newSteps[stepIndex], [field]: value };
      return { ...prev, steps: newSteps };
    });
  }

  function updateStepOption(stepIndex: number, optionIndex: number, value: string) {
    setForm(prev => {
      const newSteps = [...prev.steps];
      const newOptions = [...newSteps[stepIndex].options] as [string, string, string, string];
      newOptions[optionIndex] = value;
      newSteps[stepIndex] = { ...newSteps[stepIndex], options: newOptions };
      return { ...prev, steps: newSteps };
    });
  }

  function handleAddStep() {
    setForm(prev => ({
      ...prev,
      steps: [...prev.steps, {
        title: `Step ${prev.steps.length + 1}`,
        prompt: '',
        options: ['', '', '', ''],
        correctAnswer: 0,
        marks: 1,
        timeLimitSeconds: 30,
        explanation: ''
      }]
    }));
  }

  function handleDeleteStep(stepIndex: number) {
    if (form.steps.length <= 1) {
      toast.error('Question must have at least one step');
      return;
    }
    setForm(prev => ({
      ...prev,
      steps: prev.steps.filter((_, i) => i !== stepIndex)
    }));
  }

  // Auto-detect step type
  function detectStepType(step: FormStep): 'mcq' | 'true_false' {
    const normalize = (s: string) => s.toLowerCase().trim();
    const nonEmptyOptions = step.options.map(o => o.trim()).filter(Boolean);
    const normalized = nonEmptyOptions.map(normalize).sort().join(',');
    const isTrueFalse = nonEmptyOptions.length === 2 && normalized === 'false,true';
    return isTrueFalse ? 'true_false' : 'mcq';
  }

  async function handleSave() {
    // Validate form
    if (!form.title.trim()) {
      toast.error('Title is required');
      return;
    }
    if (!form.stem.trim()) {
      toast.error('Question stem is required');
      return;
    }
    if (form.steps.length === 0) {
      toast.error('Question must have at least one step');
      return;
    }

    // Validate steps
    for (let i = 0; i < form.steps.length; i++) {
      const step = form.steps[i];
      const nonEmptyOptions = step.options.map(o => o.trim()).filter(Boolean);
      
      if (nonEmptyOptions.length < 2) {
        toast.error(`Step ${i + 1}: Must have at least 2 options`);
        return;
      }
      
      if (step.correctAnswer < 0 || step.correctAnswer >= nonEmptyOptions.length) {
        toast.error(`Step ${i + 1}: Correct answer out of range`);
        return;
      }
    }

    setSaving(true);
    try {
      const topicTagsArray = form.topicTags
        .split(',')
        .map(t => t.trim())
        .filter(t => t.length > 0);

      // Build steps payload with auto type detection
      const stepsPayload = form.steps.map((s, i) => {
        const nonEmptyOptions = s.options.map(o => o.trim()).filter(Boolean);
        const stepType = detectStepType(s);
        
        return {
          id: s.id || `step-${i + 1}`,
          index: i, // Use 'index' not 'stepIndex'
          type: stepType,
          title: s.title,
          prompt: s.prompt,
          options: nonEmptyOptions.length === 2 && stepType === 'true_false'
            ? nonEmptyOptions
            : (nonEmptyOptions.length >= 2 ? nonEmptyOptions : ['', '', '', '']),
          correctAnswer: s.correctAnswer,
          timeLimitSeconds: s.timeLimitSeconds ?? null,
          marks: s.marks,
          explanation: s.explanation || null
        };
      });

      // Calculate total marks
      const totalMarks = stepsPayload.reduce((sum, s) => sum + s.marks, 0);

      // Build question payload
      const questionPayload: StepBasedQuestion = {
        id: selectedQuestionId || '',
        title: form.title,
        subject: form.subject,
        chapter: form.chapter,
        level: form.level,
        difficulty: form.difficulty,
        rankTier: (form.rankTier || undefined) as any,
        stem: form.stem,
        totalMarks,
        topicTags: topicTagsArray,
        steps: stepsPayload as QuestionStep[],
        imageUrl: form.imageUrl || undefined
      };

      if (mode === 'creating') {
        await addQuestion.mutateAsync(questionPayload);
        toast.success('Question created successfully!');
        setMode('idle');
        setSelectedQuestionId(null);
        setForm(getEmptyForm());
      } else if (mode === 'editing' && selectedQuestionId) {
        await updateQuestion.mutateAsync({ id: selectedQuestionId, question: questionPayload });
        toast.success('Question updated successfully!');
        setMode('idle');
        setSelectedQuestionId(null);
      }
    } catch (error: any) {
      console.error('[AdminQuestions] Save error:', error);
      toast.error(error.message || 'Failed to save question');
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900">
      <div className="container mx-auto p-6 max-w-7xl">
        {/* Header */}
        <div className="mb-6">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h1 className="text-3xl font-bold text-white">Admin Dashboard</h1>
              <p className="text-slate-400 mt-1">Manage questions and content</p>
            </div>
            <div className="flex gap-2">
              <Button variant="outline" onClick={() => navigate('/')}>
                <ArrowLeft className="w-4 h-4 mr-2" />
                Back to App
              </Button>
              {mode === 'idle' && (
                <Button onClick={handleNewQuestion}>
                  <Plus className="w-4 h-4 mr-2" />
                  New Question
                </Button>
              )}
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Left: Question List */}
          <div className={`lg:col-span-2 ${mode !== 'idle' ? 'hidden lg:block' : ''}`}>
            <Card className="bg-slate-800 border-slate-700">
              <CardHeader>
                <CardTitle className="text-white">Questions</CardTitle>
                <CardDescription className="text-slate-400">
                  {filteredQuestions.length} of {questions.length} questions
                </CardDescription>
              </CardHeader>
              <CardContent>
                {/* Filters */}
                <div className="mb-4 space-y-4">
                  <div className="flex gap-2">
                    <div className="flex-1">
                      <div className="relative">
                        <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-slate-400 w-4 h-4" />
                        <Input
                          placeholder="Search questions..."
                          value={filters.search}
                          onChange={(e) => setFilters(prev => ({ ...prev, search: e.target.value }))}
                          className="pl-10 bg-slate-700 border-slate-600 text-white placeholder:text-slate-400"
                        />
                      </div>
                    </div>
                  </div>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
                    <Select
                      value={filters.subject}
                      onValueChange={(v: any) => setFilters(prev => ({ ...prev, subject: v }))}
                    >
                      <SelectTrigger className="bg-slate-700 border-slate-600 text-white">
                        <SelectValue placeholder="Subject" />
                      </SelectTrigger>
                      <SelectContent className="bg-slate-800 border-slate-700">
                        <SelectItem value="all" className="text-white">All Subjects</SelectItem>
                        <SelectItem value="math" className="text-white">Math</SelectItem>
                        <SelectItem value="physics" className="text-white">Physics</SelectItem>
                        <SelectItem value="chemistry" className="text-white">Chemistry</SelectItem>
                      </SelectContent>
                    </Select>
                    <Select
                      value={filters.level}
                      onValueChange={(v: any) => setFilters(prev => ({ ...prev, level: v }))}
                    >
                      <SelectTrigger className="bg-slate-700 border-slate-600 text-white">
                        <SelectValue placeholder="Level" />
                      </SelectTrigger>
                      <SelectContent className="bg-slate-800 border-slate-700">
                        <SelectItem value="all" className="text-white">All Levels</SelectItem>
                        <SelectItem value="A1" className="text-white">A1</SelectItem>
                        <SelectItem value="A2" className="text-white">A2</SelectItem>
                      </SelectContent>
                    </Select>
                    <Select
                      value={filters.difficulty}
                      onValueChange={(v: any) => setFilters(prev => ({ ...prev, difficulty: v }))}
                    >
                      <SelectTrigger className="bg-slate-700 border-slate-600 text-white">
                        <SelectValue placeholder="Difficulty" />
                      </SelectTrigger>
                      <SelectContent className="bg-slate-800 border-slate-700">
                        <SelectItem value="all" className="text-white">All</SelectItem>
                        <SelectItem value="easy" className="text-white">Easy</SelectItem>
                        <SelectItem value="medium" className="text-white">Medium</SelectItem>
                        <SelectItem value="hard" className="text-white">Hard</SelectItem>
                      </SelectContent>
                    </Select>
                    <Select
                      value={filters.type}
                      onValueChange={(v: any) => setFilters(prev => ({ ...prev, type: v }))}
                    >
                      <SelectTrigger className="bg-slate-700 border-slate-600 text-white">
                        <SelectValue placeholder="Type" />
                      </SelectTrigger>
                      <SelectContent className="bg-slate-800 border-slate-700">
                        <SelectItem value="all" className="text-white">All Types</SelectItem>
                        <SelectItem value="true_false" className="text-white">True/False</SelectItem>
                        <SelectItem value="mcq" className="text-white">MCQ</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                {/* Question Table */}
                {loadingQuestions ? (
                  <div className="flex items-center justify-center py-12">
                    <Loader2 className="w-6 h-6 animate-spin text-slate-400" />
                  </div>
                ) : filteredQuestions.length === 0 ? (
                  <div className="text-center py-12 text-slate-400">
                    No questions found
                  </div>
                ) : (
                  <div className="border border-slate-700 rounded-lg overflow-hidden">
                    <Table>
                      <TableHeader>
                        <TableRow className="border-slate-700 hover:bg-slate-800">
                          <TableHead className="text-white">Title</TableHead>
                          <TableHead className="text-white">Subject</TableHead>
                          <TableHead className="text-white">Level</TableHead>
                          <TableHead className="text-white">Type</TableHead>
                          <TableHead className="text-white">Steps</TableHead>
                          <TableHead className="text-right text-white">Actions</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {filteredQuestions.map((q) => {
                          const firstStepType = q.steps[0]?.type || 'mcq';
                          return (
                            <TableRow
                              key={q.id}
                              className="cursor-pointer hover:bg-slate-800 border-slate-700"
                              onClick={() => handleSelectQuestion(q)}
                            >
                              <TableCell className="font-medium text-white">{q.title}</TableCell>
                              <TableCell>
                                <Badge variant="outline">{q.subject}</Badge>
                              </TableCell>
                              <TableCell>{q.level}</TableCell>
                              <TableCell>
                                <Badge variant={firstStepType === 'true_false' ? 'default' : 'secondary'}>
                                  {firstStepType === 'true_false' ? 'True/False' : 'MCQ'}
                                </Badge>
                              </TableCell>
                              <TableCell>{q.steps.length}</TableCell>
                              <TableCell className="text-right" onClick={(e) => e.stopPropagation()}>
                                <div className="flex justify-end gap-2">
                                  <Button
                                    variant="ghost"
                                    size="sm"
                                    onClick={() => handleSelectQuestion(q)}
                                  >
                                    <Edit2 className="w-4 h-4" />
                                  </Button>
                                  <Button
                                    variant="ghost"
                                    size="sm"
                                    onClick={() => handleDeleteClick(q.id)}
                                  >
                                    <Trash2 className="w-4 h-4 text-red-500" />
                                  </Button>
                                </div>
                              </TableCell>
                            </TableRow>
                          );
                        })}
                      </TableBody>
                    </Table>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>

          {/* Right: Editor */}
          <div className={`${mode === 'idle' ? 'hidden lg:block' : ''}`}>
            <Card className="bg-slate-800 border-slate-700">
              <CardHeader>
                <div className="flex items-center justify-between">
                  <CardTitle className="text-white">
                    {mode === 'creating' ? 'Create Question' : mode === 'editing' ? 'Edit Question' : 'Question Editor'}
                  </CardTitle>
                  {mode !== 'idle' && (
                    <Button variant="ghost" size="sm" onClick={() => {
                      setMode('idle');
                      setSelectedQuestionId(null);
                    }}>
                      <X className="w-4 h-4" />
                    </Button>
                  )}
                </div>
                <CardDescription className="text-slate-400">
                  {mode === 'idle' ? 'Select a question to edit or create a new one' : 'Fill in the question details'}
                </CardDescription>
              </CardHeader>
              <CardContent>
                {mode === 'idle' ? (
                  <div className="text-center py-12 text-slate-400">
                    <p>Select a question from the list or create a new one</p>
                  </div>
                ) : (
                  <div className="space-y-6 max-h-[calc(100vh-300px)] overflow-y-auto pr-2">
                    {/* Basic Info */}
                    <div className="space-y-4">
                      <div>
                        <Label className="text-white">Title *</Label>
                        <Input
                          value={form.title}
                          onChange={(e) => updateFormField('title', e.target.value)}
                          placeholder="Question title"
                          className="bg-slate-700 border-slate-600 text-white placeholder:text-slate-400"
                        />
                      </div>
                      <div className="grid grid-cols-2 gap-4">
                        <div>
                          <Label className="text-white">Subject *</Label>
                          <Select
                            value={form.subject}
                            onValueChange={(v: any) => updateFormField('subject', v)}
                          >
                            <SelectTrigger className="bg-slate-700 border-slate-600 text-white">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent className="bg-slate-800 border-slate-700">
                              <SelectItem value="math" className="text-white">Math</SelectItem>
                              <SelectItem value="physics" className="text-white">Physics</SelectItem>
                              <SelectItem value="chemistry" className="text-white">Chemistry</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>
                        <div>
                          <Label className="text-white">Level *</Label>
                          <Select
                            value={form.level}
                            onValueChange={(v: any) => updateFormField('level', v)}
                          >
                            <SelectTrigger className="bg-slate-700 border-slate-600 text-white">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent className="bg-slate-800 border-slate-700">
                              <SelectItem value="A1" className="text-white">A1</SelectItem>
                              <SelectItem value="A2" className="text-white">A2</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>
                      </div>
                      <div className="grid grid-cols-2 gap-4">
                        <div>
                          <Label className="text-white">Difficulty *</Label>
                          <Select
                            value={form.difficulty}
                            onValueChange={(v: any) => updateFormField('difficulty', v)}
                          >
                            <SelectTrigger className="bg-slate-700 border-slate-600 text-white">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent className="bg-slate-800 border-slate-700">
                              <SelectItem value="easy" className="text-white">Easy</SelectItem>
                              <SelectItem value="medium" className="text-white">Medium</SelectItem>
                              <SelectItem value="hard" className="text-white">Hard</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>
                        <div>
                          <Label className="text-white">Chapter</Label>
                          <Input
                            value={form.chapter}
                            onChange={(e) => updateFormField('chapter', e.target.value)}
                            placeholder="Chapter name"
                            className="bg-slate-700 border-slate-600 text-white placeholder:text-slate-400"
                          />
                        </div>
                      </div>
                      <div>
                        <Label className="text-white">Question Stem *</Label>
                        <Textarea
                          value={form.stem}
                          onChange={(e) => updateFormField('stem', e.target.value)}
                          placeholder="Main question text"
                          rows={3}
                          className="bg-slate-700 border-slate-600 text-white placeholder:text-slate-400"
                        />
                      </div>
                      <div>
                        <Label className="text-white">Topic Tags (comma-separated)</Label>
                        <Input
                          value={form.topicTags}
                          onChange={(e) => updateFormField('topicTags', e.target.value)}
                          placeholder="tag1, tag2, tag3"
                          className="bg-slate-700 border-slate-600 text-white placeholder:text-slate-400"
                        />
                      </div>
                    </div>

                    {/* Steps */}
                    <div className="space-y-4">
                      <div className="flex items-center justify-between">
                        <Label className="text-lg font-semibold text-white">Steps</Label>
                        <Button variant="outline" size="sm" onClick={handleAddStep}>
                          <Plus className="w-4 h-4 mr-2" />
                          Add Step
                        </Button>
                      </div>
                      {form.steps.map((step, stepIndex) => {
                        const stepType = detectStepType(step);
                        const nonEmptyOptions = step.options.map(o => o.trim()).filter(Boolean);
                        return (
                          <Card key={stepIndex} className="p-4 bg-slate-700 border-slate-600">
                            <div className="flex items-center justify-between mb-4">
                              <div className="flex items-center gap-2">
                                <Badge className="bg-slate-600 text-white">Step {stepIndex + 1}</Badge>
                                <Badge variant={stepType === 'true_false' ? 'default' : 'secondary'}>
                                  {stepType === 'true_false' ? (
                                    <><CheckCircle2 className="w-3 h-3 mr-1" /> True/False</>
                                  ) : (
                                    <>MCQ</>
                                  )}
                                </Badge>
                              </div>
                              {form.steps.length > 1 && (
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  onClick={() => handleDeleteStep(stepIndex)}
                                >
                                  <Trash2 className="w-4 h-4 text-red-500" />
                                </Button>
                              )}
                            </div>
                            <div className="space-y-4">
                              <div>
                                <Label className="text-white">Step Title</Label>
                                <Input
                                  value={step.title}
                                  onChange={(e) => updateStepField(stepIndex, 'title', e.target.value)}
                                  className="bg-slate-800 border-slate-600 text-white placeholder:text-slate-400"
                                />
                              </div>
                              <div>
                                <Label className="text-white">Prompt</Label>
                                <Textarea
                                  value={step.prompt}
                                  onChange={(e) => updateStepField(stepIndex, 'prompt', e.target.value)}
                                  rows={2}
                                  className="bg-slate-800 border-slate-600 text-white placeholder:text-slate-400"
                                />
                              </div>
                              <div>
                                <Label className="text-white">Options</Label>
                                <div className="grid grid-cols-2 gap-2">
                                  {[0, 1, 2, 3].map((optIdx) => (
                                    <div key={optIdx} className="flex items-center gap-2">
                                      <div className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold ${
                                        step.correctAnswer === optIdx 
                                          ? 'bg-green-500 text-white' 
                                          : 'bg-slate-700 text-slate-300'
                                      }`}>
                                        {String.fromCharCode(65 + optIdx)}
                                      </div>
                                      <Input
                                        value={step.options[optIdx]}
                                        onChange={(e) => updateStepOption(stepIndex, optIdx, e.target.value)}
                                        placeholder={`Option ${String.fromCharCode(65 + optIdx)}`}
                                        className="flex-1 bg-slate-800 border-slate-600 text-white placeholder:text-slate-400"
                                      />
                                    </div>
                                  ))}
                                </div>
                                {stepType === 'true_false' && nonEmptyOptions.length === 2 && (
                                  <p className="text-xs text-green-400 mt-2">
                                    ✓ Detected as True/False question
                                  </p>
                                )}
                              </div>
                              <div className="grid grid-cols-2 gap-4">
                                <div>
                                  <Label className="text-white">Correct Answer</Label>
                                  <Select
                                    value={step.correctAnswer.toString()}
                                    onValueChange={(v) => updateStepField(stepIndex, 'correctAnswer', parseInt(v))}
                                  >
                                    <SelectTrigger className="bg-slate-800 border-slate-600 text-white">
                                      <SelectValue />
                                    </SelectTrigger>
                                    <SelectContent className="bg-slate-800 border-slate-700">
                                      {nonEmptyOptions.map((opt, idx) => (
                                        <SelectItem key={idx} value={idx.toString()} className="text-white">
                                          {String.fromCharCode(65 + idx)}: {opt || `Option ${String.fromCharCode(65 + idx)}`}
                                        </SelectItem>
                                      ))}
                                    </SelectContent>
                                  </Select>
                                </div>
                                <div>
                                  <Label className="text-white">Marks</Label>
                                  <Input
                                    type="number"
                                    value={step.marks}
                                    onChange={(e) => updateStepField(stepIndex, 'marks', parseInt(e.target.value) || 1)}
                                    min="1"
                                    className="bg-slate-800 border-slate-600 text-white placeholder:text-slate-400"
                                  />
                                </div>
                              </div>
                              <div>
                                <Label className="text-white">Explanation</Label>
                                <Textarea
                                  value={step.explanation}
                                  onChange={(e) => updateStepField(stepIndex, 'explanation', e.target.value)}
                                  rows={2}
                                  placeholder="Explanation shown after answering"
                                  className="bg-slate-800 border-slate-600 text-white placeholder:text-slate-400"
                                />
                              </div>
                            </div>
                          </Card>
                        );
                      })}
                    </div>

                    {/* Actions */}
                    <div className="flex gap-2 pt-4 border-t">
                      <Button
                        onClick={handleSave}
                        disabled={saving}
                        className="flex-1"
                      >
                        {saving ? (
                          <>
                            <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                            Saving...
                          </>
                        ) : (
                          <>
                            <Save className="w-4 h-4 mr-2" />
                            {mode === 'creating' ? 'Create Question' : 'Save Changes'}
                          </>
                        )}
                      </Button>
                      <Button
                        variant="outline"
                        onClick={() => {
                          setMode('idle');
                          setSelectedQuestionId(null);
                        }}
                      >
                        Cancel
                      </Button>
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </div>
      </div>

      {/* Delete Confirmation Dialog */}
      <Dialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete Question</DialogTitle>
            <DialogDescription>
              Are you sure you want to delete this question? This action cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteDialogOpen(false)}>
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={handleDeleteConfirm}
              disabled={deleteQuestion.isPending}
            >
              {deleteQuestion.isPending ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Deleting...
                </>
              ) : (
                'Delete'
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
