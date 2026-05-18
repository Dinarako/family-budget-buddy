export type AppRole = 'admin' | 'editor' | 'viewer';

export interface LocalUser {
  id: string;
  email: string;
  display_name: string | null;
  avatar_url: string | null;
  created_at: string;
}

export interface Budget {
  id: string;
  name: string;
  monthly_income: number;
  created_by: string;
  created_at: string;
  updated_at: string;
}

export interface BudgetWithRole extends Budget {
  member_role: AppRole;
  member_count: number;
}

export interface ExpenseItem {
  id: string;
  budget_id: string;
  category: string;
  name: string;
  amount: number;
  created_by: string;
  created_at: string;
  updated_at: string;
}

export interface BudgetMember {
  id: string;
  user_id: string;
  role: AppRole;
  email: string;
  display_name: string | null;
  created_at: string;
}
