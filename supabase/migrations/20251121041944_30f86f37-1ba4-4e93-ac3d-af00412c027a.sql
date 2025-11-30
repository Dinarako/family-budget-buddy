-- Fix the trigger function to bypass RLS when adding the creator as admin
CREATE OR REPLACE FUNCTION public.handle_new_budget()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Insert creator as admin, bypassing RLS with SECURITY DEFINER
  INSERT INTO public.budget_members (budget_id, user_id, role)
  VALUES (NEW.id, NEW.created_by, 'admin');
  RETURN NEW;
END;
$$;