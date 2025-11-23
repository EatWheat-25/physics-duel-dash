/**
 * QUESTIONS HOOKS
 *
 * React Query hooks for CRUD operations on questions.
 * Uses centralized questionMapper for type-safe conversions.
 */

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { StepBasedQuestion, QuestionFilters, QuestionInput } from '@/types/questions';
import { dbRowsToQuestions, questionToDBRow, validateQuestion } from '@/utils/questionMapper';

/**
 * Fetch questions with optional filters
 */
export const useQuestions = (filters?: QuestionFilters) => {
  return useQuery({
    queryKey: ['questions', filters],
    queryFn: async () => {
      console.log('🔍 useQuestions: Starting fetch with filters:', filters);

      let query = supabase.from('questions').select('*, question_steps(*)');

      if (filters?.subject) query = query.eq('subject', filters.subject);
      if (filters?.chapter) query = query.eq('chapter', filters.chapter);
      if (filters?.level) query = query.eq('level', filters.level);
      if (filters?.difficulty) query = query.eq('difficulty', filters.difficulty);
      if (filters?.rankTier) query = query.eq('rank_tier', filters.rankTier);

      // Apply limit if specified
      if (filters?.limit) query = query.limit(filters.limit);

      const { data, error } = await query.order('created_at', { ascending: false });

      console.log('📊 useQuestions: Raw data from Supabase:', data);
      console.log('📊 useQuestions: Data count:', data?.length || 0);
      console.log('❌ useQuestions: Error:', error);

      if (error) {
        console.error('❌ useQuestions: Supabase error:', error);
        throw error;
      }

      // Use centralized mapper
      const mappedQuestions = dbRowsToQuestions((data || []) as any);
      console.log('✅ useQuestions: Mapped questions:', mappedQuestions.length);

      return mappedQuestions;
    },
  });
};

/**
 * Add a new question to the database
 */
export const useAddQuestion = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (question: QuestionInput) => {
      // Validate before sending to DB
      const errors = validateQuestion(question);
      if (errors.length > 0) {
        throw new Error(`Validation failed:\n${errors.join('\n')}`);
      }

      // Convert to DB format
      const dbRow = questionToDBRow(question) as any;

      const { data, error } = await supabase.from('questions').insert([dbRow]).select().single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['questions'] });
    },
  });
};

/**
 * Update an existing question
 */
export const useUpdateQuestion = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, question }: { id: string; question: QuestionInput }) => {
      // Validate before sending to DB
      const errors = validateQuestion(question);
      if (errors.length > 0) {
        throw new Error(`Validation failed:\n${errors.join('\n')}`);
      }

      // Convert to DB format
      const dbRow = questionToDBRow({ ...question, id }) as any;

      const { data, error } = await supabase
        .from('questions')
        .update(dbRow)
        .eq('id', id)
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['questions'] });
    },
  });
};

/**
 * Delete a question from the database
 */
export const useDeleteQuestion = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('questions').delete().eq('id', id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['questions'] });
    },
  });
};
