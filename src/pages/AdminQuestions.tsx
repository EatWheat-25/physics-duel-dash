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
import { Loader2, ArrowLeft, Plus, Trash2, Settings as SettingsIcon, Trophy } from 'lucide-react';
import { Badge } from '@/components/ui/badge';

interface CommonMetadata {
  subject: 'math' | 'physics' | 'chemistry';
  level: 'A1' | 'A2';
  chapter: string;
  rankTier: RankTier;
  difficulty: 'easy' | 'medium' | 'hard';
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
    rankTier: 'Bronze',
    difficulty: 'medium'
  });

  // Filter state
  const [filterRankTier, setFilterRankTier] = useState<RankTier | 'all'>('all');

  // Question form state
  const [questionForm, setQuestionForm] = useState({
    questionText: '',
    stepQuestion: '',
    option1: '',
    option2: '',
    option3: '',
    option4: '',
    correctAnswer: 0,
    explanation: '',
    marks: 1
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

    if (!questionForm.questionText.trim() || 
        !questionForm.stepQuestion.trim() || !questionForm.option1.trim() ||
        !questionForm.option2.trim() || !questionForm.option3.trim() || 
        !questionForm.option4.trim() || !questionForm.explanation.trim()) {
      toast({
        title: "Error",
        description: "Please fill in all required fields",
        variant: "destructive"
      });
      return;
    }

    // Auto-generate title from question text (first 50 chars)
    const autoTitle = questionForm.questionText.substring(0, 50) + (questionForm.questionText.length > 50 ? '...' : '');

    const newQuestion: Omit<StepBasedQuestion, 'id'> = {
      title: autoTitle,
      subject: metadata.subject,
      chapter: metadata.chapter,
      level: metadata.level,
      difficulty: metadata.difficulty,
      rankTier: metadata.rankTier,
      totalMarks: questionForm.marks,
      questionText: questionForm.questionText,
      topicTags: [],
      steps: [
        {
          id: 'step-1',
          question: questionForm.stepQuestion,
          options: [
            questionForm.option1,
            questionForm.option2,
            questionForm.option3,
            questionForm.option4
          ],
          correctAnswer: questionForm.correctAnswer,
          marks: questionForm.marks,
          explanation: questionForm.explanation
        }
      ]
    };

    try {
      await addQuestion.mutateAsync(newQuestion);
      toast({
        title: "Success",
        description: "Question added successfully!"
      });
      
      // Reset question form
      setQuestionForm({
        questionText: '',
        stepQuestion: '',
        option1: '',
        option2: '',
        option3: '',
        option4: '',
        correctAnswer: 0,
        explanation: '',
        marks: 1
      });
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to add question",
        variant: "destructive"
      });
    }
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

                <div className="space-y-2">
                  <Label htmlFor="difficulty">Difficulty *</Label>
                  <Select
                    value={metadata.difficulty}
                    onValueChange={(value: 'easy' | 'medium' | 'hard') =>
                      setMetadata({ ...metadata, difficulty: value })
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

                <div className="bg-blue-50 p-4 rounded-lg border border-blue-200">
                  <h4 className="font-semibold mb-2">Summary</h4>
                  <div className="space-y-1 text-sm">
                    <p><strong>Subject:</strong> {metadata.subject}</p>
                    <p><strong>Level:</strong> {metadata.level}</p>
                    <p><strong>Chapter:</strong> {metadata.chapter || '(not set)'}</p>
                    <p><strong>Difficulty:</strong> {metadata.difficulty}</p>
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
                <Badge variant="secondary">{metadata.difficulty}</Badge>
                <Badge className={rankTierColors[metadata.rankTier]}>
                  {rankTierEmojis[metadata.rankTier]} {metadata.rankTier}
                </Badge>
              </div>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleQuestionSubmit} className="space-y-4">
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

                <div className="space-y-2">
                  <Label htmlFor="stepQuestion">Step Question *</Label>
                  <Textarea
                    id="stepQuestion"
                    value={questionForm.stepQuestion}
                    onChange={(e) => setQuestionForm({ ...questionForm, stepQuestion: e.target.value })}
                    placeholder="The specific step or part of the question"
                    rows={2}
                    required
                  />
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-2">
                    <Label htmlFor="option1">Option 1 *</Label>
                    <Input
                      id="option1"
                      value={questionForm.option1}
                      onChange={(e) => setQuestionForm({ ...questionForm, option1: e.target.value })}
                      required
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="option2">Option 2 *</Label>
                    <Input
                      id="option2"
                      value={questionForm.option2}
                      onChange={(e) => setQuestionForm({ ...questionForm, option2: e.target.value })}
                      required
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="option3">Option 3 *</Label>
                    <Input
                      id="option3"
                      value={questionForm.option3}
                      onChange={(e) => setQuestionForm({ ...questionForm, option3: e.target.value })}
                      required
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="option4">Option 4 *</Label>
                    <Input
                      id="option4"
                      value={questionForm.option4}
                      onChange={(e) => setQuestionForm({ ...questionForm, option4: e.target.value })}
                      required
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="correctAnswer">Correct Answer (0-3) *</Label>
                  <Select
                    value={questionForm.correctAnswer.toString()}
                    onValueChange={(value) => setQuestionForm({ ...questionForm, correctAnswer: parseInt(value) })}
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

                <div className="space-y-2">
                  <Label htmlFor="explanation">Explanation *</Label>
                  <Textarea
                    id="explanation"
                    value={questionForm.explanation}
                    onChange={(e) => setQuestionForm({ ...questionForm, explanation: e.target.value })}
                    placeholder="Explain why this is the correct answer"
                    rows={3}
                    required
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="marks">Marks</Label>
                  <Input
                    id="marks"
                    type="number"
                    min="1"
                    value={questionForm.marks}
                    onChange={(e) => setQuestionForm({ ...questionForm, marks: parseInt(e.target.value) })}
                  />
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
                      Add Question
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
