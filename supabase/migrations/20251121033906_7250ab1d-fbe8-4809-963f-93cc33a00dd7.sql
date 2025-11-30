-- Create profiles table
CREATE TABLE public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  display_name TEXT,
  avatar_url TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Profiles are viewable by authenticated users"
  ON public.profiles FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Users can update own profile"
  ON public.profiles FOR UPDATE
  TO authenticated
  USING (auth.uid() = id);

CREATE POLICY "Users can insert own profile"
  ON public.profiles FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = id);

-- Create app_role enum
CREATE TYPE public.app_role AS ENUM ('admin', 'editor', 'viewer');

-- Create user_roles table
CREATE TABLE public.user_roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role app_role NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(user_id, role)
);

ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own roles"
  ON public.user_roles FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

-- Security definer function to check roles
CREATE OR REPLACE FUNCTION public.has_role(_user_id UUID, _role app_role)
RETURNS BOOLEAN
LANGUAGE SQL
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.user_roles
    WHERE user_id = _user_id AND role = _role
  )
$$;

-- Create budgets table
CREATE TABLE public.budgets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  monthly_income DECIMAL(10,2) NOT NULL DEFAULT 0,
  created_by UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.budgets ENABLE ROW LEVEL SECURITY;

-- Create budget_members table for role-based access
CREATE TABLE public.budget_members (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  budget_id UUID NOT NULL REFERENCES public.budgets(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role app_role NOT NULL DEFAULT 'viewer',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(budget_id, user_id)
);

ALTER TABLE public.budget_members ENABLE ROW LEVEL SECURITY;

-- RLS for budgets - users can see budgets they're members of
CREATE POLICY "Users can view budgets they're members of"
  ON public.budgets FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.budget_members
      WHERE budget_members.budget_id = budgets.id
      AND budget_members.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can create budgets"
  ON public.budgets FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = created_by);

CREATE POLICY "Admins and editors can update budgets"
  ON public.budgets FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.budget_members
      WHERE budget_members.budget_id = budgets.id
      AND budget_members.user_id = auth.uid()
      AND budget_members.role IN ('admin', 'editor')
    )
  );

CREATE POLICY "Admins can delete budgets"
  ON public.budgets FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.budget_members
      WHERE budget_members.budget_id = budgets.id
      AND budget_members.user_id = auth.uid()
      AND budget_members.role = 'admin'
    )
  );

-- RLS for budget_members
CREATE POLICY "Users can view members of budgets they belong to"
  ON public.budget_members FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.budget_members AS bm
      WHERE bm.budget_id = budget_members.budget_id
      AND bm.user_id = auth.uid()
    )
  );

CREATE POLICY "Admins can add members"
  ON public.budget_members FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.budget_members AS bm
      WHERE bm.budget_id = budget_members.budget_id
      AND bm.user_id = auth.uid()
      AND bm.role = 'admin'
    )
  );

CREATE POLICY "Admins can update member roles"
  ON public.budget_members FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.budget_members AS bm
      WHERE bm.budget_id = budget_members.budget_id
      AND bm.user_id = auth.uid()
      AND bm.role = 'admin'
    )
  );

CREATE POLICY "Admins can remove members"
  ON public.budget_members FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.budget_members AS bm
      WHERE bm.budget_id = budget_members.budget_id
      AND bm.user_id = auth.uid()
      AND bm.role = 'admin'
    )
  );

-- Create expense_items table
CREATE TABLE public.expense_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  budget_id UUID NOT NULL REFERENCES public.budgets(id) ON DELETE CASCADE,
  category TEXT NOT NULL,
  name TEXT NOT NULL,
  amount DECIMAL(10,2) NOT NULL,
  created_by UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.expense_items ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view expense items for budgets they're members of"
  ON public.expense_items FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.budget_members
      WHERE budget_members.budget_id = expense_items.budget_id
      AND budget_members.user_id = auth.uid()
    )
  );

CREATE POLICY "Editors and admins can add expense items"
  ON public.expense_items FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.budget_members
      WHERE budget_members.budget_id = expense_items.budget_id
      AND budget_members.user_id = auth.uid()
      AND budget_members.role IN ('admin', 'editor')
    )
  );

CREATE POLICY "Editors and admins can update expense items"
  ON public.expense_items FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.budget_members
      WHERE budget_members.budget_id = expense_items.budget_id
      AND budget_members.user_id = auth.uid()
      AND budget_members.role IN ('admin', 'editor')
    )
  );

CREATE POLICY "Editors and admins can delete expense items"
  ON public.expense_items FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.budget_members
      WHERE budget_members.budget_id = expense_items.budget_id
      AND budget_members.user_id = auth.uid()
      AND budget_members.role IN ('admin', 'editor')
    )
  );

-- Trigger to automatically create profile on signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (id, display_name)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'display_name', split_part(NEW.email, '@', 1))
  );
  RETURN NEW;
END;
$$;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- Trigger to automatically add creator as admin when budget is created
CREATE OR REPLACE FUNCTION public.handle_new_budget()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.budget_members (budget_id, user_id, role)
  VALUES (NEW.id, NEW.created_by, 'admin');
  RETURN NEW;
END;
$$;

CREATE TRIGGER on_budget_created
  AFTER INSERT ON public.budgets
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_budget();

-- Update timestamp triggers
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

CREATE TRIGGER update_profiles_updated_at
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_budgets_updated_at
  BEFORE UPDATE ON public.budgets
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_expense_items_updated_at
  BEFORE UPDATE ON public.expense_items
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Enable realtime for collaboration
ALTER PUBLICATION supabase_realtime ADD TABLE public.budgets;
ALTER PUBLICATION supabase_realtime ADD TABLE public.expense_items;
ALTER PUBLICATION supabase_realtime ADD TABLE public.budget_members;