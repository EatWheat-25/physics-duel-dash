/*
  # Secure User Roles RLS Policies

  1. Changes
    - Remove client-side role insertion capability
    - Only service_role (edge functions) can manage roles
    - Users can view their own roles
    - Admins can view all roles

  2. Security
    - Prevents users from self-assigning admin roles
    - Role assignment must go through edge functions
*/

-- Drop existing policies that allow client-side insertion
DROP POLICY IF EXISTS "Admins can manage all roles" ON public.user_roles;
DROP POLICY IF EXISTS "Users can view their own roles" ON public.user_roles;

-- Recreate policies with secure access control
-- Only service role can insert/update/delete roles (via edge functions)
CREATE POLICY "Service role can manage roles"
ON public.user_roles
FOR ALL
TO service_role
USING (true)
WITH CHECK (true);

-- Users can view their own roles
CREATE POLICY "Users can view own roles"
ON public.user_roles
FOR SELECT
TO authenticated
USING (auth.uid() = user_id);

-- Admins can view all roles (for management)
CREATE POLICY "Admins can view all roles"
ON public.user_roles
FOR SELECT
TO authenticated
USING (public.has_role(auth.uid(), 'admin'));
