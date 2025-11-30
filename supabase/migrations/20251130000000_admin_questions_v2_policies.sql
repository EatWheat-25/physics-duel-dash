-- RLS policies for admin CRUD operations on questions_v2
-- Assumes: user.user_metadata.role = 'admin' for admin users

-- Allow admins to INSERT questions
CREATE POLICY "admins_can_insert_questions_v2"
  ON public.questions_v2
  FOR INSERT
  TO authenticated
  WITH CHECK (
    (auth.jwt() ->> 'user_metadata')::jsonb ->> 'role' = 'admin'
  );

-- Allow admins to UPDATE questions
CREATE POLICY "admins_can_update_questions_v2"
  ON public.questions_v2
  FOR UPDATE
  TO authenticated
  USING (
    (auth.jwt() ->> 'user_metadata')::jsonb ->> 'role' = 'admin'
  )
  WITH CHECK (
    (auth.jwt() ->> 'user_metadata')::jsonb ->> 'role' = 'admin'
  );

-- Allow admins to DELETE questions
CREATE POLICY "admins_can_delete_questions_v2"
  ON public.questions_v2
  FOR DELETE
  TO authenticated
  USING (
    (auth.jwt() ->> 'user_metadata')::jsonb ->> 'role' = 'admin'
  );
