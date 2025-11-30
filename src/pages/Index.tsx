import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Home, ShoppingCart, Car, Heart, User, Music, LogOut, ArrowLeft } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import BudgetHeader from "@/components/BudgetHeader";
import IncomeSection from "@/components/IncomeSection";
import ExpenseCategory, { Expense } from "@/components/ExpenseCategory";
import SummaryPanel from "@/components/SummaryPanel";
import InsightsPanel from "@/components/InsightsPanel";
import BudgetSelector from "@/components/BudgetSelector";
import MembersDialog from "@/components/MembersDialog";
import { useToast } from "@/hooks/use-toast";

interface Budget {
  id: string;
  name: string;
  monthly_income: number;
}

interface ExpenseItem {
  id: string;
  category: string;
  name: string;
  amount: number;
}

const Index = () => {
  const navigate = useNavigate();
  const { user, loading: authLoading, signOut } = useAuth();
  const { toast } = useToast();
  const [selectedBudgetId, setSelectedBudgetId] = useState<string | null>(null);
  const [budget, setBudget] = useState<Budget | null>(null);
  const [expenses, setExpenses] = useState<ExpenseItem[]>([]);
  const [userRole, setUserRole] = useState<string>('viewer');
  const [loading, setLoading] = useState(true);

  // Redirect to auth if not logged in
  useEffect(() => {
    if (!authLoading && !user) {
      navigate('/auth');
    }
  }, [user, authLoading, navigate]);

  // Load budget and expenses when budget is selected
  useEffect(() => {
    if (selectedBudgetId) {
      loadBudgetData();
      setupRealtimeSubscription();
    }
  }, [selectedBudgetId]);

  const loadBudgetData = async () => {
    if (!selectedBudgetId) return;

    try {
      // Fetch budget
      const { data: budgetData, error: budgetError } = await supabase
        .from('budgets')
        .select('*')
        .eq('id', selectedBudgetId)
        .single();

      if (budgetError) throw budgetError;
      setBudget(budgetData);

      // Fetch user's role
      const { data: memberData, error: memberError } = await supabase
        .from('budget_members')
        .select('role')
        .eq('budget_id', selectedBudgetId)
        .eq('user_id', user?.id)
        .single();

      if (memberError) throw memberError;
      setUserRole(memberData.role);

      // Fetch expenses
      const { data: expensesData, error: expensesError } = await supabase
        .from('expense_items')
        .select('*')
        .eq('budget_id', selectedBudgetId)
        .order('created_at', { ascending: false });

      if (expensesError) throw expensesError;
      setExpenses(expensesData || []);
    } catch (error: any) {
      toast({
        title: 'Error',
        description: error.message,
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  const setupRealtimeSubscription = () => {
    const channel = supabase
      .channel('budget-changes')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'budgets',
          filter: `id=eq.${selectedBudgetId}`,
        },
        (payload) => {
          if (payload.eventType === 'UPDATE') {
            setBudget(payload.new as Budget);
          }
        }
      )
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'expense_items',
          filter: `budget_id=eq.${selectedBudgetId}`,
        },
        (payload) => {
          if (payload.eventType === 'INSERT') {
            setExpenses((prev) => [payload.new as ExpenseItem, ...prev]);
          } else if (payload.eventType === 'DELETE') {
            setExpenses((prev) => prev.filter((exp) => exp.id !== payload.old.id));
          } else if (payload.eventType === 'UPDATE') {
            setExpenses((prev) =>
              prev.map((exp) => (exp.id === payload.new.id ? (payload.new as ExpenseItem) : exp))
            );
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  };

  const handleIncomeChange = async (value: number) => {
    if (!selectedBudgetId || userRole === 'viewer') return;

    try {
      const { error } = await supabase
        .from('budgets')
        .update({ monthly_income: value })
        .eq('id', selectedBudgetId);

      if (error) throw error;
    } catch (error: any) {
      toast({
        title: 'Error',
        description: error.message,
        variant: 'destructive',
      });
    }
  };

  const handleAddExpense = (category: string) => async (description: string, amount: number) => {
    if (!selectedBudgetId || userRole === 'viewer') {
      toast({
        title: 'Permission denied',
        description: 'You need editor or admin permissions to add expenses',
        variant: 'destructive',
      });
      return;
    }

    try {
      const { error } = await supabase.from('expense_items').insert([
        {
          budget_id: selectedBudgetId,
          category,
          name: description,
          amount,
          created_by: user?.id,
        },
      ]);

      if (error) throw error;
    } catch (error: any) {
      toast({
        title: 'Error',
        description: error.message,
        variant: 'destructive',
      });
    }
  };

  const handleRemoveExpense = (category: string) => async (id: string) => {
    if (userRole === 'viewer') {
      toast({
        title: 'Permission denied',
        description: 'You need editor or admin permissions to remove expenses',
        variant: 'destructive',
      });
      return;
    }

    try {
      const { error } = await supabase.from('expense_items').delete().eq('id', id);

      if (error) throw error;
    } catch (error: any) {
      toast({
        title: 'Error',
        description: error.message,
        variant: 'destructive',
      });
    }
  };

  const handleSignOut = async () => {
    await signOut();
    navigate('/auth');
  };

  const handleBackToBudgets = () => {
    setSelectedBudgetId(null);
    setBudget(null);
    setExpenses([]);
  };

  // Show loading state
  if (authLoading || (selectedBudgetId && loading)) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <p className="text-muted-foreground">Loading...</p>
      </div>
    );
  }

  // Show budget selector if no budget selected
  if (!selectedBudgetId) {
    return (
      <div>
        <div className="absolute top-4 right-4">
          <Button variant="outline" onClick={handleSignOut}>
            <LogOut className="mr-2 h-4 w-4" />
            Sign Out
          </Button>
        </div>
        <BudgetSelector onSelectBudget={setSelectedBudgetId} />
      </div>
    );
  }

  // Get expenses by category
  const getExpensesByCategory = (category: string): Expense[] => {
    return expenses
      .filter((exp) => exp.category === category)
      .map((exp) => ({
        id: exp.id,
        description: exp.name,
        amount: exp.amount,
      }));
  };

  const categoryTotals = {
    housing: expenses.filter((e) => e.category === 'housing').reduce((sum, e) => sum + e.amount, 0),
    groceries: expenses.filter((e) => e.category === 'groceries').reduce((sum, e) => sum + e.amount, 0),
    transportation: expenses.filter((e) => e.category === 'transportation').reduce((sum, e) => sum + e.amount, 0),
    health: expenses.filter((e) => e.category === 'health').reduce((sum, e) => sum + e.amount, 0),
    personal: expenses.filter((e) => e.category === 'personal').reduce((sum, e) => sum + e.amount, 0),
    entertainment: expenses.filter((e) => e.category === 'entertainment').reduce((sum, e) => sum + e.amount, 0),
  };

  const totalExpenses = Object.values(categoryTotals).reduce((sum, val) => sum + val, 0);
  const remainingIncome = (budget?.monthly_income || 0) - totalExpenses;
  const netLeftover = remainingIncome;

  return (
    <div className="min-h-screen bg-background">
      <BudgetHeader />

      <div className="container mx-auto max-w-6xl px-4 py-4">
        <div className="flex justify-between items-center mb-6">
          <Button variant="outline" onClick={handleBackToBudgets}>
            <ArrowLeft className="mr-2 h-4 w-4" />
            Back to Budgets
          </Button>
          <div className="flex items-center gap-2">
            <MembersDialog budgetId={selectedBudgetId} userRole={userRole} />
            <Button variant="outline" onClick={handleSignOut}>
              <LogOut className="mr-2 h-4 w-4" />
              Sign Out
            </Button>
          </div>
        </div>

        <div className="mb-6">
          <h1 className="text-3xl font-bold">{budget?.name}</h1>
          <p className="text-muted-foreground">
            Your role: <span className="font-medium capitalize">{userRole}</span>
          </p>
        </div>
      </div>

      <main className="container mx-auto max-w-6xl px-4 pb-8 space-y-8">
        {/* Income Section */}
        <IncomeSection
          monthlyIncome={budget?.monthly_income || 0}
          remainingIncome={remainingIncome}
          onIncomeChange={handleIncomeChange}
        />

        {/* Summary Panel */}
        <SummaryPanel
          totalIncome={budget?.monthly_income || 0}
          totalExpenses={totalExpenses}
          netLeftover={netLeftover}
        />

        {/* Expense Categories */}
        <div>
          <h2 className="text-2xl font-bold mb-6">Expense Categories</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            <ExpenseCategory
              title="Housing Expenses"
              icon={Home}
              expenses={getExpensesByCategory('housing')}
              onAddExpense={handleAddExpense('housing')}
              onRemoveExpense={handleRemoveExpense('housing')}
            />
            <ExpenseCategory
              title="Groceries"
              icon={ShoppingCart}
              expenses={getExpensesByCategory('groceries')}
              onAddExpense={handleAddExpense('groceries')}
              onRemoveExpense={handleRemoveExpense('groceries')}
            />
            <ExpenseCategory
              title="Transportation"
              icon={Car}
              expenses={getExpensesByCategory('transportation')}
              onAddExpense={handleAddExpense('transportation')}
              onRemoveExpense={handleRemoveExpense('transportation')}
            />
            <ExpenseCategory
              title="Health"
              icon={Heart}
              expenses={getExpensesByCategory('health')}
              onAddExpense={handleAddExpense('health')}
              onRemoveExpense={handleRemoveExpense('health')}
            />
            <ExpenseCategory
              title="Personal Spending"
              icon={User}
              expenses={getExpensesByCategory('personal')}
              onAddExpense={handleAddExpense('personal')}
              onRemoveExpense={handleRemoveExpense('personal')}
            />
            <ExpenseCategory
              title="Entertainment"
              icon={Music}
              expenses={getExpensesByCategory('entertainment')}
              onAddExpense={handleAddExpense('entertainment')}
              onRemoveExpense={handleRemoveExpense('entertainment')}
            />
          </div>
        </div>

        {/* Insights and Visualizations */}
        <div>
          <h2 className="text-2xl font-bold mb-6">Insights & Recommendations</h2>
          <InsightsPanel totalIncome={budget?.monthly_income || 0} categoryTotals={categoryTotals} />
        </div>
      </main>
    </div>
  );
};

export default Index;
