import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { StepBasedQuestion } from '@/types/stepQuestion';

export const useQuestions = (filters?: {
  subject?: string;
  chapter?: string;
  level?: 'A1' | 'A2';
  difficulty?: 'easy' | 'medium' | 'hard';
  rankTier?: string;
}) => {
  return useQuery({
    queryKey: ['questions', filters],
    queryFn: async () => {
      let query = supabase.from('questions').select('*');

      if (filters?.subject) query = query.eq('subject', filters.subject);
      if (filters?.chapter) query = query.eq('chapter', filters.chapter);
      if (filters?.level) query = query.eq('level', filters.level);
      if (filters?.difficulty) query = query.eq('difficulty', filters.difficulty);
      if (filters?.rankTier) query = query.eq('rank_tier', filters.rankTier);

      const { data, error } = await query.order('created_at', { ascending: false });
      
      if (error) throw error;
      
      return (data || []).map(q => ({
        id: q.id,
        title: q.title,
        subject: q.subject as 'math' | 'physics' | 'chemistry',
        chapter: q.chapter,
        level: q.level as 'A1' | 'A2',
        difficulty: q.difficulty as 'easy' | 'medium' | 'hard',
        rankTier: q.rank_tier as any,
        totalMarks: q.total_marks,
        questionText: q.question_text,
        topicTags: q.topic_tags || [],
        steps: q.steps as any
      })) as StepBasedQuestion[];
    }
  });
};

export const useAddQuestion = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (question: Omit<StepBasedQuestion, 'id'>) => {
      const { data, error } = await supabase
        .from('questions')
        .insert({
          title: question.title,
          subject: question.subject,
          chapter: question.chapter,
          level: question.level,
          difficulty: question.difficulty,
          rank_tier: question.rankTier,
          question_text: question.questionText,
          total_marks: question.totalMarks,
          topic_tags: question.topicTags,
          steps: question.steps as any
        })
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['questions'] });
    }
  });
};

export const useUpdateQuestion = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, question }: { id: string; question: Omit<StepBasedQuestion, 'id'> }) => {
      const { data, error } = await supabase
        .from('questions')
        .update({
          title: question.title,
          subject: question.subject,
          chapter: question.chapter,
          level: question.level,
          difficulty: question.difficulty,
          rank_tier: question.rankTier,
          question_text: question.questionText,
          total_marks: question.totalMarks,
          topic_tags: question.topicTags,
          steps: question.steps as any
        })
        .eq('id', id)
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['questions'] });
    }
  });
};

export const useDeleteQuestion = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from('questions')
        .delete()
        .eq('id', id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['questions'] });
    }
  });
};
