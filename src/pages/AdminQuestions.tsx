import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useQuestions, useAddQuestion, useDeleteQuestion } from '@/hooks/useQuestions';
import { useIsAdmin } from '@/hooks/useUserRole';
import { toast } from 'sonner';
import { Trash2, Plus, ArrowLeft } from 'lucide-react';
import { StepBasedQuestion, QuestionStep } from '@/types/stepQuestion';

export default function AdminQuestions() {
  const navigate = useNavigate();
  const { isAdmin, isLoading: roleLoading } = useIsAdmin();
  const { data: questions, isLoading } = useQuestions();
  const addQuestion = useAddQuestion();
  const deleteQuestion = useDeleteQuestion();

  const [showForm, setShowForm] = useState(false);
  const [formData, setFormData] = useState({
    title: '',
    subject: 'math' as 'math' | 'physics' | 'chemistry',
    chapter: '',
    level: 'A1' as 'A1' | 'A2',
    difficulty: 'easy' as 'easy' | 'medium' | 'hard',
    questionText: '',
    totalMarks: 1,
    topicTags: '',
    stepQuestion: '',
    stepOptions: ['', '', '', ''],
    stepCorrectAnswer: 0,
    stepMarks: 1,
    stepExplanation: ''
  });

  if (roleLoading || isLoading) {
    return <div className="flex items-center justify-center min-h-screen">Loading...</div>;
  }

  if (!isAdmin) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen gap-4">
        <h1 className="text-2xl font-bold">Access Denied</h1>
        <p>You need admin privileges to access this page.</p>
        <Button onClick={() => navigate('/')}>Go Home</Button>
      </div>
    );
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    const step: QuestionStep = {
      id: 'step-1',
      question: formData.stepQuestion,
      options: formData.stepOptions.filter(o => o.trim() !== ''),
      correctAnswer: formData.stepCorrectAnswer,
      marks: formData.stepMarks,
      explanation: formData.stepExplanation
    };

    const question: Omit<StepBasedQuestion, 'id'> = {
      title: formData.title,
      subject: formData.subject,
      chapter: formData.chapter,
      level: formData.level,
      difficulty: formData.difficulty,
      questionText: formData.questionText,
      totalMarks: formData.totalMarks,
      topicTags: formData.topicTags.split(',').map(t => t.trim()).filter(t => t),
      steps: [step]
    };

    try {
      await addQuestion.mutateAsync(question);
      toast.success('Question added successfully!');
      setShowForm(false);
      setFormData({
        title: '',
        subject: 'math',
        chapter: '',
        level: 'A1',
        difficulty: 'easy',
        questionText: '',
        totalMarks: 1,
        topicTags: '',
        stepQuestion: '',
        stepOptions: ['', '', '', ''],
        stepCorrectAnswer: 0,
        stepMarks: 1,
        stepExplanation: ''
      });
    } catch (error) {
      toast.error('Failed to add question');
    }
  };

  const handleDelete = async (id: string) => {
    if (confirm('Are you sure you want to delete this question?')) {
      try {
        await deleteQuestion.mutateAsync(id);
        toast.success('Question deleted');
      } catch (error) {
        toast.error('Failed to delete question');
      }
    }
  };

  return (
    <div className="min-h-screen bg-background p-8">
      <div className="max-w-6xl mx-auto">
        <div className="flex items-center justify-between mb-8">
          <div className="flex items-center gap-4">
            <Button variant="ghost" size="icon" onClick={() => navigate('/')}>
              <ArrowLeft className="h-5 w-5" />
            </Button>
            <h1 className="text-3xl font-bold">Question Management</h1>
          </div>
          <Button onClick={() => setShowForm(!showForm)}>
            <Plus className="h-4 w-4 mr-2" />
            Add Question
          </Button>
        </div>

        {showForm && (
          <Card className="p-6 mb-8">
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="title">Title</Label>
                  <Input
                    id="title"
                    value={formData.title}
                    onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                    required
                  />
                </div>
                <div>
                  <Label htmlFor="subject">Subject</Label>
                  <Select value={formData.subject} onValueChange={(v: any) => setFormData({ ...formData, subject: v })}>
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
                  <Label htmlFor="chapter">Chapter</Label>
                  <Input
                    id="chapter"
                    value={formData.chapter}
                    onChange={(e) => setFormData({ ...formData, chapter: e.target.value })}
                    required
                  />
                </div>
                <div>
                  <Label htmlFor="level">Level</Label>
                  <Select value={formData.level} onValueChange={(v: any) => setFormData({ ...formData, level: v })}>
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
                  <Label htmlFor="difficulty">Difficulty</Label>
                  <Select value={formData.difficulty} onValueChange={(v: any) => setFormData({ ...formData, difficulty: v })}>
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
                  <Label htmlFor="totalMarks">Total Marks</Label>
                  <Input
                    id="totalMarks"
                    type="number"
                    value={formData.totalMarks}
                    onChange={(e) => setFormData({ ...formData, totalMarks: parseInt(e.target.value) })}
                    required
                  />
                </div>
              </div>

              <div>
                <Label htmlFor="questionText">Question Text</Label>
                <Textarea
                  id="questionText"
                  value={formData.questionText}
                  onChange={(e) => setFormData({ ...formData, questionText: e.target.value })}
                  required
                />
              </div>

              <div>
                <Label htmlFor="topicTags">Topic Tags (comma separated)</Label>
                <Input
                  id="topicTags"
                  value={formData.topicTags}
                  onChange={(e) => setFormData({ ...formData, topicTags: e.target.value })}
                  placeholder="algebra, quadratics, factoring"
                />
              </div>

              <div className="border-t pt-4">
                <h3 className="font-semibold mb-4">Step 1</h3>
                <div className="space-y-4">
                  <div>
                    <Label htmlFor="stepQuestion">Step Question</Label>
                    <Textarea
                      id="stepQuestion"
                      value={formData.stepQuestion}
                      onChange={(e) => setFormData({ ...formData, stepQuestion: e.target.value })}
                      required
                    />
                  </div>

                  {formData.stepOptions.map((opt, idx) => (
                    <div key={idx}>
                      <Label htmlFor={`option${idx}`}>Option {idx + 1}</Label>
                      <Input
                        id={`option${idx}`}
                        value={opt}
                        onChange={(e) => {
                          const newOptions = [...formData.stepOptions];
                          newOptions[idx] = e.target.value;
                          setFormData({ ...formData, stepOptions: newOptions });
                        }}
                        required
                      />
                    </div>
                  ))}

                  <div>
                    <Label htmlFor="correctAnswer">Correct Answer (0-3)</Label>
                    <Input
                      id="correctAnswer"
                      type="number"
                      min="0"
                      max="3"
                      value={formData.stepCorrectAnswer}
                      onChange={(e) => setFormData({ ...formData, stepCorrectAnswer: parseInt(e.target.value) })}
                      required
                    />
                  </div>

                  <div>
                    <Label htmlFor="stepExplanation">Explanation</Label>
                    <Textarea
                      id="stepExplanation"
                      value={formData.stepExplanation}
                      onChange={(e) => setFormData({ ...formData, stepExplanation: e.target.value })}
                      required
                    />
                  </div>
                </div>
              </div>

              <div className="flex gap-2">
                <Button type="submit" disabled={addQuestion.isPending}>
                  {addQuestion.isPending ? 'Adding...' : 'Add Question'}
                </Button>
                <Button type="button" variant="outline" onClick={() => setShowForm(false)}>
                  Cancel
                </Button>
              </div>
            </form>
          </Card>
        )}

        <div className="space-y-4">
          {questions?.map((q) => (
            <Card key={q.id} className="p-4">
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <h3 className="font-semibold text-lg">{q.title}</h3>
                  <p className="text-sm text-muted-foreground mt-1">{q.questionText}</p>
                  <div className="flex gap-2 mt-2">
                    <span className="text-xs bg-primary/10 text-primary px-2 py-1 rounded">{q.subject}</span>
                    <span className="text-xs bg-secondary/10 text-secondary px-2 py-1 rounded">{q.level}</span>
                    <span className="text-xs bg-accent/10 text-accent px-2 py-1 rounded">{q.difficulty}</span>
                    <span className="text-xs bg-muted px-2 py-1 rounded">{q.chapter}</span>
                  </div>
                </div>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => handleDelete(q.id)}
                  disabled={deleteQuestion.isPending}
                >
                  <Trash2 className="h-4 w-4 text-destructive" />
                </Button>
              </div>
            </Card>
          ))}
        </div>
      </div>
    </div>
  );
}
