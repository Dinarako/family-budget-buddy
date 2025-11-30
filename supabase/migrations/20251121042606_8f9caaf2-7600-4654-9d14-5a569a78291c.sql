-- Add policy to allow users to view budgets they created (in addition to member check)
CREATE POLICY "Users can view budgets they created"
  ON public.budgets FOR SELECT
  TO authenticated
  USING (auth.uid() = created_by);