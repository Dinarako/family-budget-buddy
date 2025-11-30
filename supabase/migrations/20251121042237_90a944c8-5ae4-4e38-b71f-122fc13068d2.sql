-- Fix security issues

-- 1. Fix profiles table - restrict viewing to own profile + shared budget members
DROP POLICY IF EXISTS "Profiles are viewable by authenticated users" ON public.profiles;

CREATE POLICY "Users can view own profile"
  ON public.profiles FOR SELECT
  TO authenticated
  USING (auth.uid() = id);

CREATE POLICY "Users can view profiles of shared budget members"
  ON public.profiles FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM public.budget_members bm1
      JOIN public.budget_members bm2 ON bm1.budget_id = bm2.budget_id
      WHERE bm1.user_id = auth.uid()
      AND bm2.user_id = profiles.id
    )
  );

-- 2. Add missing policies for user_roles table
-- Note: This table stores app-level roles (separate from budget roles)
-- Only allow viewing own roles, no modifications allowed by regular users

CREATE POLICY "Only system can insert user roles"
  ON public.user_roles FOR INSERT
  TO authenticated
  WITH CHECK (false);

CREATE POLICY "Only system can update user roles"
  ON public.user_roles FOR UPDATE
  TO authenticated
  USING (false);

CREATE POLICY "Only system can delete user roles"
  ON public.user_roles FOR DELETE
  TO authenticated
  USING (false);