-- Create security definer function to check budget membership (bypasses RLS)
CREATE OR REPLACE FUNCTION public.is_budget_member(_budget_id UUID, _user_id UUID)
RETURNS BOOLEAN
LANGUAGE SQL
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.budget_members
    WHERE budget_id = _budget_id AND user_id = _user_id
  )
$$;

-- Create security definer function to check budget member role
CREATE OR REPLACE FUNCTION public.get_budget_member_role(_budget_id UUID, _user_id UUID)
RETURNS app_role
LANGUAGE SQL
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT role
  FROM public.budget_members
  WHERE budget_id = _budget_id AND user_id = _user_id
  LIMIT 1
$$;

-- Drop existing problematic policies
DROP POLICY IF EXISTS "Users can view members of budgets they belong to" ON public.budget_members;
DROP POLICY IF EXISTS "Admins can add members" ON public.budget_members;
DROP POLICY IF EXISTS "Admins can update member roles" ON public.budget_members;
DROP POLICY IF EXISTS "Admins can remove members" ON public.budget_members;

-- Recreate policies using security definer functions
CREATE POLICY "Users can view members of budgets they belong to"
  ON public.budget_members FOR SELECT
  TO authenticated
  USING (public.is_budget_member(budget_id, auth.uid()));

CREATE POLICY "Admins can add members"
  ON public.budget_members FOR INSERT
  TO authenticated
  WITH CHECK (public.get_budget_member_role(budget_id, auth.uid()) = 'admin');

CREATE POLICY "Admins can update member roles"
  ON public.budget_members FOR UPDATE
  TO authenticated
  USING (public.get_budget_member_role(budget_id, auth.uid()) = 'admin');

CREATE POLICY "Admins can remove members"
  ON public.budget_members FOR DELETE
  TO authenticated
  USING (public.get_budget_member_role(budget_id, auth.uid()) = 'admin');