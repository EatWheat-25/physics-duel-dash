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
import { useAuth } from '@/contexts/AuthContext';

const ADMIN_EMAIL = 'noffalnawaz65@gmail.com';

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

      let query = supabase.from('questions_v2').select('*');

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
  const { user } = useAuth();

  return useMutation({
    mutationFn: async (question: QuestionInput) => {
      // Server-side email validation
      if (user?.email !== ADMIN_EMAIL) {
        throw new Error('Unauthorized: Admin access required');
      }

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
  const { user } = useAuth();

  return useMutation({
    mutationFn: async ({ id, question }: { id: string; question: QuestionInput }) => {
      // Server-side email validation
      if (user?.email !== ADMIN_EMAIL) {
        throw new Error('Unauthorized: Admin access required');
      }

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
  const { user } = useAuth();

  return useMutation({
    mutationFn: async (id: string) => {
      // Server-side email validation
      if (user?.email !== ADMIN_EMAIL) {
        throw new Error('Unauthorized: Admin access required');
      }

      const { error } = await supabase.from('questions_v2').delete().eq('id', id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['questions'] });
    },
  });
};
