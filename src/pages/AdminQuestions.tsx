import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useIsAdmin } from '@/hooks/useUserRole';
import { useQuestions, useAddQuestion, useDeleteQuestion } from '@/hooks/useQuestions';
import { StepBasedQuestion, RankTier } from '@/types/stepQuestion';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { toast } from '@/hooks/use-toast';
import { Loader2, ArrowLeft, Plus, Trash2, Settings as SettingsIcon, Trophy, ChevronDown, Image as ImageIcon, X } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { Badge } from '@/components/ui/badge';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';

interface CommonMetadata {
  subject: 'math' | 'physics' | 'chemistry';
  level: 'A1' | 'A2';
  chapter: string;
  rankTier: RankTier;
}

const rankTierColors: Record<RankTier, string> = {
  'Bronze': 'bg-amber-700 text-white',
  'Silver': 'bg-gray-400 text-white',
  'Gold': 'bg-yellow-500 text-white',
  'Diamond': 'bg-cyan-500 text-white',
  'Unbeatable': 'bg-purple-600 text-white',
  'Pocket Calculator': 'bg-gradient-to-r from-purple-600 to-pink-600 text-white'
};

const rankTierEmojis: Record<RankTier, string> = {
  'Bronze': '🥉',
  'Silver': '🥈',
  'Gold': '🥇',
  'Diamond': '💎',
  'Unbeatable': '👑',
  'Pocket Calculator': '🧮'
};

export default function AdminQuestions() {
  const navigate = useNavigate();
  const { isAdmin, isLoading: roleLoading } = useIsAdmin();
  const { data: questions, isLoading: questionsLoading } = useQuestions();
  const addQuestion = useAddQuestion();
  const deleteQuestion = useDeleteQuestion();

  // Two-step flow state
  const [step, setStep] = useState<'metadata' | 'questions'>('metadata');
  const [metadata, setMetadata] = useState<CommonMetadata>({
    subject: 'math',
    level: 'A1',
    chapter: '',
    rankTier: 'Bronze'
  });

  // Filter state
  const [filterRankTier, setFilterRankTier] = useState<RankTier | 'all'>('all');

  // Question form state
  const [questionForm, setQuestionForm] = useState({
    questionText: '',
    numberOfSteps: 1,
    difficulty: 'medium' as 'easy' | 'medium' | 'hard',
    imageFile: null as File | null,
    steps: [
      {
        stepQuestion: '',
        option1: '',
        option2: '',
        option3: '',
        option4: '',
        correctAnswer: 0,
        explanation: ''
      }
    ]
  });

  if (roleLoading || questionsLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin" />
      </div>
    );
  }

  if (!isAdmin) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Card>
          <CardContent className="p-6">
            <p className="text-destructive">Access denied. Admin privileges required.</p>
            <Button onClick={() => navigate('/dashboard')} className="mt-4">
              Back to Dashboard
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  const handleMetadataSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!metadata.chapter.trim()) {
      toast({
        title: "Error",
        description: "Please enter a chapter name",
        variant: "destructive"
      });
      return;
    }
    setStep('questions');
  };

  const handleQuestionSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    // Validate main question text
    if (!questionForm.questionText.trim()) {
      toast({
        title: "Error",
        description: "Please enter the full question text",
        variant: "destructive"
      });
      return;
    }

    // Validate all steps
    for (let i = 0; i < questionForm.steps.length; i++) {
      const step = questionForm.steps[i];
      if (!step.stepQuestion.trim() || !step.option1.trim() || !step.option2.trim() || 
          !step.option3.trim() || !step.option4.trim() || !step.explanation.trim()) {
        toast({
          title: "Error",
          description: `Please fill in all fields for Step ${i + 1}`,
          variant: "destructive"
        });
        return;
      }
    }

    let imageUrl = null;

    // Upload image if provided
    if (questionForm.imageFile) {
      try {
        const fileExt = questionForm.imageFile.name.split('.').pop();
        const fileName = `${Math.random().toString(36).substring(2)}-${Date.now()}.${fileExt}`;
        const filePath = `${fileName}`;

        const { error: uploadError } = await supabase.storage
          .from('question-images')
          .upload(filePath, questionForm.imageFile);

        if (uploadError) throw uploadError;

        const { data: { publicUrl } } = supabase.storage
          .from('question-images')
          .getPublicUrl(filePath);

        imageUrl = publicUrl;
      } catch (error) {
        toast({
          title: "Error",
          description: "Failed to upload image",
          variant: "destructive"
        });
        return;
      }
    }

    // Auto-generate title from question text (first 50 chars)
    const autoTitle = questionForm.questionText.substring(0, 50) + (questionForm.questionText.length > 50 ? '...' : '');

    // Build steps array with proper structure
    const stepsArray = questionForm.steps.map((step, index) => ({
      id: `step-${index + 1}`,
      question: step.stepQuestion,
      options: [step.option1, step.option2, step.option3, step.option4],
      correctAnswer: step.correctAnswer,
      marks: 1, // Each step worth 1 mark
      explanation: step.explanation
    }));

    const newQuestion: Omit<StepBasedQuestion, 'id'> & { image_url?: string | null } = {
      title: autoTitle,
      subject: metadata.subject,
      chapter: metadata.chapter,
      level: metadata.level,
      difficulty: questionForm.difficulty,
      rankTier: metadata.rankTier,
      totalMarks: questionForm.numberOfSteps, // Total marks = number of steps
      questionText: questionForm.questionText,
      topicTags: [],
      steps: stepsArray,
      image_url: imageUrl
    };

    try {
      await addQuestion.mutateAsync(newQuestion);
      toast({
        title: "Success",
        description: `Question with ${questionForm.numberOfSteps} step(s) added successfully!`
      });
      
      // Reset question form
      setQuestionForm({
        questionText: '',
        numberOfSteps: 1,
        difficulty: 'medium',
        imageFile: null,
        steps: [
          {
            stepQuestion: '',
            option1: '',
            option2: '',
            option3: '',
            option4: '',
            correctAnswer: 0,
            explanation: ''
          }
        ]
      });
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to add question",
        variant: "destructive"
      });
    }
  };

  const handleNumberOfStepsChange = (value: number) => {
    const newSteps = Array.from({ length: value }, (_, i) => 
      questionForm.steps[i] || {
        stepQuestion: '',
        option1: '',
        option2: '',
        option3: '',
        option4: '',
        correctAnswer: 0,
        explanation: ''
      }
    );
    setQuestionForm({ ...questionForm, numberOfSteps: value, steps: newSteps });
  };

  const updateStep = (index: number, field: string, value: any) => {
    const newSteps = [...questionForm.steps];
    newSteps[index] = { ...newSteps[index], [field]: value };
    setQuestionForm({ ...questionForm, steps: newSteps });
  };

  const handleDelete = async (id: string) => {
    if (confirm('Are you sure you want to delete this question?')) {
      try {
        await deleteQuestion.mutateAsync(id);
        toast({
          title: "Success",
          description: "Question deleted successfully"
        });
      } catch (error) {
        toast({
          title: "Error",
          description: "Failed to delete question",
          variant: "destructive"
        });
      }
    }
  };

  const filteredQuestions = filterRankTier === 'all' 
    ? questions 
    : questions?.filter(q => q.rankTier === filterRankTier);

  // Step 1: Set Common Metadata
  if (step === 'metadata') {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 to-purple-50 p-6">
        <div className="max-w-2xl mx-auto">
          <Button
            variant="ghost"
            onClick={() => navigate('/dashboard')}
            className="mb-4"
          >
            <ArrowLeft className="mr-2 h-4 w-4" />
            Back to Dashboard
          </Button>

          <Card className="shadow-lg">
            <CardHeader>
              <CardTitle className="text-2xl flex items-center gap-2">
                <SettingsIcon className="h-6 w-6" />
                Set Question Metadata
              </CardTitle>
              <p className="text-sm text-muted-foreground">
                Configure common settings for all questions you'll add in this session
              </p>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleMetadataSubmit} className="space-y-6">
                <div className="space-y-2">
                  <Label htmlFor="subject">Subject *</Label>
                  <Select
                    value={metadata.subject}
                    onValueChange={(value: 'math' | 'physics' | 'chemistry') =>
                      setMetadata({ ...metadata, subject: value })
                    }
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="math">Mathematics</SelectItem>
                      <SelectItem value="physics">Physics</SelectItem>
                      <SelectItem value="chemistry">Chemistry</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="level">Level *</Label>
                  <Select
                    value={metadata.level}
                    onValueChange={(value: 'A1' | 'A2') =>
                      setMetadata({ ...metadata, level: value })
                    }
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="A1">A1 (AS Level)</SelectItem>
                      <SelectItem value="A2">A2 (A Level)</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="chapter">Chapter *</Label>
                  <Input
                    id="chapter"
                    value={metadata.chapter}
                    onChange={(e) => setMetadata({ ...metadata, chapter: e.target.value })}
                    placeholder="e.g., Quadratic Equations"
                    required
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="rankTier">Rank Tier *</Label>
                  <Select
                    value={metadata.rankTier}
                    onValueChange={(value: RankTier) =>
                      setMetadata({ ...metadata, rankTier: value })
                    }
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {(['Bronze', 'Silver', 'Gold', 'Diamond', 'Unbeatable', 'Pocket Calculator'] as RankTier[]).map(tier => (
                        <SelectItem key={tier} value={tier}>
                          <span className="flex items-center gap-2">
                            {rankTierEmojis[tier]} {tier}
                          </span>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <p className="text-xs text-muted-foreground">
                    Questions will be shown to players at this rank bracket
                  </p>
                </div>

                <div className="bg-blue-50 p-4 rounded-lg border border-blue-200">
                  <h4 className="font-semibold mb-2">Summary</h4>
                  <div className="space-y-1 text-sm">
                    <p><strong>Subject:</strong> {metadata.subject}</p>
                    <p><strong>Level:</strong> {metadata.level}</p>
                    <p><strong>Chapter:</strong> {metadata.chapter || '(not set)'}</p>
                    <p className="flex items-center gap-2">
                      <strong>Rank Tier:</strong> 
                      <Badge className={rankTierColors[metadata.rankTier]}>
                        {rankTierEmojis[metadata.rankTier]} {metadata.rankTier}
                      </Badge>
                    </p>
                  </div>
                </div>

                <Button type="submit" className="w-full" size="lg">
                  Continue to Add Questions
                  <Plus className="ml-2 h-4 w-4" />
                </Button>
              </form>
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  // Step 2: Add Questions
  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-purple-50 p-6">
      <div className="max-w-6xl mx-auto">
        <div className="flex items-center justify-between mb-6">
          <Button
            variant="ghost"
            onClick={() => setStep('metadata')}
          >
            <ArrowLeft className="mr-2 h-4 w-4" />
            Change Metadata Settings
          </Button>
          
          <Button
            variant="outline"
            onClick={() => navigate('/dashboard')}
          >
            Back to Dashboard
          </Button>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Left Column: Add Question Form */}
          <Card className="shadow-lg">
            <CardHeader>
              <CardTitle className="text-xl flex items-center gap-2">
                <Plus className="h-5 w-5" />
                Add New Question
              </CardTitle>
              <div className="flex flex-wrap gap-2 mt-2">
                <Badge variant="secondary">{metadata.subject}</Badge>
                <Badge variant="secondary">{metadata.level}</Badge>
                <Badge variant="secondary">{metadata.chapter}</Badge>
                <Badge className={rankTierColors[metadata.rankTier]}>
                  {rankTierEmojis[metadata.rankTier]} {metadata.rankTier}
                </Badge>
              </div>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleQuestionSubmit} className="space-y-6">
                {/* Main Question Text */}
                <div className="space-y-2">
                  <Label htmlFor="questionText">Full Question Text *</Label>
                  <Textarea
                    id="questionText"
                    value={questionForm.questionText}
                    onChange={(e) => setQuestionForm({ ...questionForm, questionText: e.target.value })}
                    placeholder="The complete question as it appears in the exam"
                    rows={3}
                    required
                  />
                </div>

                {/* Image Upload */}
                <div className="space-y-2">
                  <Label htmlFor="questionImage">Question Diagram (Optional)</Label>
                  <div className="space-y-2">
                    {questionForm.imageFile ? (
                      <div className="relative border rounded-lg p-4 bg-muted/50">
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          className="absolute top-2 right-2"
                          onClick={() => setQuestionForm({ ...questionForm, imageFile: null })}
                        >
                          <X className="h-4 w-4" />
                        </Button>
                        <div className="flex items-center gap-3">
                          <ImageIcon className="h-8 w-8 text-muted-foreground" />
                          <div className="flex-1">
                            <p className="text-sm font-medium">{questionForm.imageFile.name}</p>
                            <p className="text-xs text-muted-foreground">
                              {(questionForm.imageFile.size / 1024).toFixed(1)} KB
                            </p>
                          </div>
                        </div>
                        <img 
                          src={URL.createObjectURL(questionForm.imageFile)} 
                          alt="Preview" 
                          className="mt-3 max-h-48 rounded border"
                        />
                      </div>
                    ) : (
                      <label className="flex flex-col items-center justify-center border-2 border-dashed rounded-lg p-6 cursor-pointer hover:bg-muted/50 transition-colors">
                        <ImageIcon className="h-10 w-10 text-muted-foreground mb-2" />
                        <span className="text-sm text-muted-foreground">
                          Click to upload diagram or image
                        </span>
                        <span className="text-xs text-muted-foreground mt-1">
                          PNG, JPG, or WEBP (max 5MB)
                        </span>
                        <input
                          id="questionImage"
                          type="file"
                          accept="image/*"
                          className="hidden"
                          onChange={(e) => {
                            const file = e.target.files?.[0];
                            if (file) {
                              if (file.size > 5 * 1024 * 1024) {
                                toast({
                                  title: "Error",
                                  description: "Image must be smaller than 5MB",
                                  variant: "destructive"
                                });
                                return;
                              }
                              setQuestionForm({ ...questionForm, imageFile: file });
                            }
                          }}
                        />
                      </label>
                    )}
                  </div>
                </div>

                {/* Number of Steps Selector */}
                <div className="space-y-2">
                  <Label htmlFor="numberOfSteps">Number of Steps (Marks) *</Label>
                  <Input
                    id="numberOfSteps"
                    type="number"
                    min="1"
                    max="20"
                    value={questionForm.numberOfSteps}
                    onChange={(e) => handleNumberOfStepsChange(parseInt(e.target.value) || 1)}
                  />
                  <p className="text-xs text-muted-foreground">
                    Total marks = Number of steps (1-20)
                  </p>
                </div>

                {/* Difficulty Selector */}
                <div className="space-y-2">
                  <Label htmlFor="difficulty">Difficulty *</Label>
                  <Select
                    value={questionForm.difficulty}
                    onValueChange={(value: 'easy' | 'medium' | 'hard') =>
                      setQuestionForm({ ...questionForm, difficulty: value })
                    }
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

                {/* Steps Accordion */}
                <div className="space-y-2">
                  <Label className="text-base">Question Steps</Label>
                  <p className="text-xs text-muted-foreground mb-2">
                    Fill in each step with a sub-question and 4 options. The last step should contain the final answer.
                  </p>
                  
                  <Accordion type="single" collapsible className="w-full">
                    {questionForm.steps.map((step, index) => (
                      <AccordionItem key={index} value={`step-${index}`}>
                        <AccordionTrigger className="hover:no-underline">
                          <div className="flex items-center gap-2">
                            <Badge variant={step.stepQuestion ? "default" : "secondary"}>
                              Step {index + 1}
                            </Badge>
                            {step.stepQuestion && (
                              <span className="text-sm text-muted-foreground truncate max-w-[200px]">
                                {step.stepQuestion.substring(0, 40)}...
                              </span>
                            )}
                          </div>
                        </AccordionTrigger>
                        <AccordionContent>
                          <div className="space-y-4 pt-4">
                            {/* Step Question */}
                            <div className="space-y-2">
                              <Label htmlFor={`stepQuestion-${index}`}>
                                Sub-Question {index === questionForm.steps.length - 1 ? "(Final Answer)" : ""} *
                              </Label>
                              <Textarea
                                id={`stepQuestion-${index}`}
                                value={step.stepQuestion}
                                onChange={(e) => updateStep(index, 'stepQuestion', e.target.value)}
                                placeholder={index === questionForm.steps.length - 1 ? "What is the final answer?" : "What did you do in this step?"}
                                rows={2}
                                required
                              />
                            </div>

                            {/* Options Grid */}
                            <div className="grid grid-cols-2 gap-3">
                              <div className="space-y-2">
                                <Label htmlFor={`option1-${index}`}>Option 1 *</Label>
                                <Input
                                  id={`option1-${index}`}
                                  value={step.option1}
                                  onChange={(e) => updateStep(index, 'option1', e.target.value)}
                                  required
                                />
                              </div>
                              <div className="space-y-2">
                                <Label htmlFor={`option2-${index}`}>Option 2 *</Label>
                                <Input
                                  id={`option2-${index}`}
                                  value={step.option2}
                                  onChange={(e) => updateStep(index, 'option2', e.target.value)}
                                  required
                                />
                              </div>
                              <div className="space-y-2">
                                <Label htmlFor={`option3-${index}`}>Option 3 *</Label>
                                <Input
                                  id={`option3-${index}`}
                                  value={step.option3}
                                  onChange={(e) => updateStep(index, 'option3', e.target.value)}
                                  required
                                />
                              </div>
                              <div className="space-y-2">
                                <Label htmlFor={`option4-${index}`}>Option 4 *</Label>
                                <Input
                                  id={`option4-${index}`}
                                  value={step.option4}
                                  onChange={(e) => updateStep(index, 'option4', e.target.value)}
                                  required
                                />
                              </div>
                            </div>

                            {/* Correct Answer */}
                            <div className="space-y-2">
                              <Label htmlFor={`correctAnswer-${index}`}>Correct Answer *</Label>
                              <Select
                                value={step.correctAnswer.toString()}
                                onValueChange={(value) => updateStep(index, 'correctAnswer', parseInt(value))}
                              >
                                <SelectTrigger>
                                  <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                  <SelectItem value="0">Option 1</SelectItem>
                                  <SelectItem value="1">Option 2</SelectItem>
                                  <SelectItem value="2">Option 3</SelectItem>
                                  <SelectItem value="3">Option 4</SelectItem>
                                </SelectContent>
                              </Select>
                            </div>

                            {/* Explanation */}
                            <div className="space-y-2">
                              <Label htmlFor={`explanation-${index}`}>Explanation *</Label>
                              <Textarea
                                id={`explanation-${index}`}
                                value={step.explanation}
                                onChange={(e) => updateStep(index, 'explanation', e.target.value)}
                                placeholder="Explain why this is the correct answer"
                                rows={2}
                                required
                              />
                            </div>
                          </div>
                        </AccordionContent>
                      </AccordionItem>
                    ))}
                  </Accordion>
                </div>

                <Button
                  type="submit"
                  className="w-full"
                  disabled={addQuestion.isPending}
                >
                  {addQuestion.isPending ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Adding...
                    </>
                  ) : (
                    <>
                      <Plus className="mr-2 h-4 w-4" />
                      Add Question ({questionForm.numberOfSteps} {questionForm.numberOfSteps === 1 ? 'Step' : 'Steps'})
                    </>
                  )}
                </Button>
              </form>
            </CardContent>
          </Card>

          {/* Right Column: Questions List */}
          <div className="space-y-4">
            <Card className="shadow-lg">
              <CardHeader>
                <CardTitle className="text-xl flex items-center justify-between">
                  <span className="flex items-center gap-2">
                    <Trophy className="h-5 w-5" />
                    All Questions ({filteredQuestions?.length || 0})
                  </span>
                </CardTitle>
                <div className="space-y-2">
                  <Label>Filter by Rank Tier</Label>
                  <Select
                    value={filterRankTier}
                    onValueChange={(value: RankTier | 'all') => setFilterRankTier(value)}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Tiers</SelectItem>
                      {(['Bronze', 'Silver', 'Gold', 'Diamond', 'Unbeatable', 'Pocket Calculator'] as RankTier[]).map(tier => (
                        <SelectItem key={tier} value={tier}>
                          {rankTierEmojis[tier]} {tier}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </CardHeader>
            </Card>

            <div className="space-y-3 max-h-[800px] overflow-y-auto pr-2">
              {filteredQuestions?.map((question) => (
                <Card key={question.id} className="hover:shadow-md transition-shadow">
                  <CardContent className="p-4">
                    <div className="flex justify-between items-start gap-3">
                      <div className="flex-1 space-y-2">
                        <h3 className="font-semibold text-sm">{question.title}</h3>
                        <div className="flex flex-wrap gap-1">
                          <Badge variant="outline" className="text-xs">{question.subject}</Badge>
                          <Badge variant="outline" className="text-xs">{question.level}</Badge>
                          <Badge variant="outline" className="text-xs">{question.chapter}</Badge>
                          <Badge className={`text-xs ${rankTierColors[question.rankTier]}`}>
                            {rankTierEmojis[question.rankTier]} {question.rankTier}
                          </Badge>
                        </div>
                        <p className="text-xs text-muted-foreground line-clamp-2">
                          {question.questionText}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          {question.totalMarks} mark(s) • {question.steps.length} step(s)
                        </p>
                      </div>
                      <Button
                        variant="destructive"
                        size="icon"
                        onClick={() => handleDelete(question.id)}
                        disabled={deleteQuestion.isPending}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
