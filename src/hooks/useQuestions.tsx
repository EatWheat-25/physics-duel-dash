/**
 * QUESTIONS HOOKS
 *
 * React Query hooks for CRUD operations on questions.
 * Uses centralized questionMapper for type-safe conversions.
 */

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { StepBasedQuestion, QuestionFilters, QuestionInput } from '@/types/questions';
import { dbRowsToQuestions, questionToDBRow, validateQuestion } from '@/utils/questionMapper';

/**
 * Fetch questions with optional filters
 */
export const useQuestions = (filters?: QuestionFilters) => {
  const queryClient = useQueryClient();
  
  // Real-time subscription for admin UX (game doesn't need this)
  useEffect(() => {
    const channel = supabase
      .channel('questions_changes')
      .on('postgres_changes', 
        { 
          event: '*', 
          schema: 'public', 
          table: 'questions_v2' 
        },
        () => {
          // Invalidate all question queries to refetch
          queryClient.invalidateQueries({ queryKey: ['questions'] });
        }
      )
      .subscribe();
    
    return () => {
      supabase.removeChannel(channel);
    };
  }, [queryClient]);
  
  return useQuery({
    queryKey: ['questions', filters],
    queryFn: async () => {
      console.log('🔍 useQuestions: Starting fetch with filters:', filters);

      // Sanitized server-side fetch (steps come back without answer keys).
      const { data, error } = await (supabase.rpc as any)('get_questions_for_play_v1', {
        p_subject: filters?.subject ?? null,
        p_chapter: filters?.chapter ?? null,
        p_level: filters?.level ?? null,
        p_difficulty: filters?.difficulty ?? null,
        p_rank_tier: filters?.rankTier ?? null,
        p_limit: filters?.limit ?? 500,
      });

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
      // Authorization is enforced server-side by questions_v2 RLS (admin role).
      // Convert QuestionInput to StepBasedQuestion (add id if missing)
      const stepBasedQuestion: StepBasedQuestion = {
        ...question,
        id: question.id || crypto.randomUUID()
      };

      // Validate before sending to DB
      const errors = validateQuestion(stepBasedQuestion);
      if (errors.length > 0) {
        throw new Error(`Validation failed:\n${errors.join('\n')}`);
      }

      // Convert to DB format
      const dbRow = questionToDBRow(stepBasedQuestion) as any;
      // Remove id for insert (let DB generate it)
      delete dbRow.id;

      const { data, error } = await supabase.from('questions_v2').insert([dbRow]).select().single();

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
      // Authorization is enforced server-side by questions_v2 RLS (admin role).
      // Convert QuestionInput to StepBasedQuestion (id is required)
      const stepBasedQuestion: StepBasedQuestion = {
        ...question,
        id: id // id is provided in the function parameter
      };

      // Validate before sending to DB
      const validationErrors = validateQuestion(stepBasedQuestion);
      if (validationErrors.length > 0) {
        throw new Error(`Validation failed:\n${validationErrors.join('\n')}`);
      }

      // Convert to DB format
      const dbRow = questionToDBRow(stepBasedQuestion) as any;
      // Remove id from update payload (id is in WHERE clause)
      delete dbRow.id;

      const { data, error } = await supabase
        .from('questions_v2')
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
      // Authorization is enforced server-side by questions_v2 RLS (admin role).
      const { error } = await supabase.from('questions_v2').delete().eq('id', id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['questions'] });
    },
  });
};
