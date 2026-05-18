import { useState, useEffect, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { Home, ShoppingCart, Car, Heart, User, Music, LogOut, ArrowLeft } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { apiRequest } from "@/lib/api";
import { Budget, ExpenseItem } from "@/lib/types";
import { Button } from "@/components/ui/button";
import BudgetHeader from "@/components/BudgetHeader";
import IncomeSection from "@/components/IncomeSection";
import ExpenseCategory, { Expense } from "@/components/ExpenseCategory";
import SummaryPanel from "@/components/SummaryPanel";
import InsightsPanel from "@/components/InsightsPanel";
import BudgetSelector from "@/components/BudgetSelector";
import MembersDialog from "@/components/MembersDialog";
import { useToast } from "@/hooks/use-toast";

const Index = () => {
  const navigate = useNavigate();
  const { user, loading: authLoading, signOut } = useAuth();
  const { toast } = useToast();
  const [selectedBudgetId, setSelectedBudgetId] = useState<string | null>(null);
  const [budget, setBudget] = useState<Budget | null>(null);
  const [expenses, setExpenses] = useState<ExpenseItem[]>([]);
  const [userRole, setUserRole] = useState<string>('viewer');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!authLoading && !user) {
      navigate('/auth');
    }
  }, [user, authLoading, navigate]);

  const loadBudgetData = useCallback(async () => {
    if (!selectedBudgetId) return;
    setLoading(true);
    try {
      const [budgetRes, expensesRes] = await Promise.all([
        apiRequest<{ budget: Budget; role: string }>(`/api/budgets/${selectedBudgetId}`),
        apiRequest<{ expenses: ExpenseItem[] }>(`/api/budgets/${selectedBudgetId}/expenses`),
      ]);
      setBudget(budgetRes.budget);
      setUserRole(budgetRes.role);
      setExpenses(expensesRes.expenses);
    } catch (error) {
      toast({
        title: 'Error',
        description: error instanceof Error ? error.message : 'An error occurred',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  }, [selectedBudgetId, toast]);

  useEffect(() => {
    if (selectedBudgetId) {
      loadBudgetData();
    }
  }, [selectedBudgetId, loadBudgetData]);

  const handleIncomeChange = async (value: number) => {
    if (!selectedBudgetId || userRole === 'viewer') return;
    try {
      const res = await apiRequest<{ budget: Budget }>(`/api/budgets/${selectedBudgetId}`, {
        method: 'PUT',
        body: JSON.stringify({ monthly_income: value }),
      });
      setBudget(res.budget);
    } catch (error) {
      toast({
        title: 'Error',
        description: error instanceof Error ? error.message : 'An error occurred',
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
      const res = await apiRequest<{ expense: ExpenseItem }>(`/api/budgets/${selectedBudgetId}/expenses`, {
        method: 'POST',
        body: JSON.stringify({ category, name: description, amount }),
      });
      setExpenses(prev => [res.expense, ...prev]);
    } catch (error) {
      toast({
        title: 'Error',
        description: error instanceof Error ? error.message : 'An error occurred',
        variant: 'destructive',
      });
    }
  };

  const handleRemoveExpense = (_: string) => async (id: string) => {
    if (userRole === 'viewer') {
      toast({
        title: 'Permission denied',
        description: 'You need editor or admin permissions to remove expenses',
        variant: 'destructive',
      });
      return;
    }
    try {
      await apiRequest(`/api/budgets/${selectedBudgetId}/expenses/${id}`, { method: 'DELETE' });
      setExpenses(prev => prev.filter(exp => exp.id !== id));
    } catch (error) {
      toast({
        title: 'Error',
        description: error instanceof Error ? error.message : 'An error occurred',
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

  if (authLoading || (selectedBudgetId && loading)) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <p className="text-muted-foreground">Loading...</p>
      </div>
    );
  }

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

  const getExpensesByCategory = (category: string): Expense[] =>
    expenses
      .filter(exp => exp.category === category)
      .map(exp => ({ id: exp.id, description: exp.name, amount: exp.amount }));

  const categoryTotals = {
    housing: expenses.filter(e => e.category === 'housing').reduce((s, e) => s + e.amount, 0),
    groceries: expenses.filter(e => e.category === 'groceries').reduce((s, e) => s + e.amount, 0),
    transportation: expenses.filter(e => e.category === 'transportation').reduce((s, e) => s + e.amount, 0),
    health: expenses.filter(e => e.category === 'health').reduce((s, e) => s + e.amount, 0),
    personal: expenses.filter(e => e.category === 'personal').reduce((s, e) => s + e.amount, 0),
    entertainment: expenses.filter(e => e.category === 'entertainment').reduce((s, e) => s + e.amount, 0),
  };

  const totalExpenses = Object.values(categoryTotals).reduce((s, v) => s + v, 0);
  const remainingIncome = (budget?.monthly_income || 0) - totalExpenses;

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
        <IncomeSection
          monthlyIncome={budget?.monthly_income || 0}
          remainingIncome={remainingIncome}
          onIncomeChange={handleIncomeChange}
        />

        <SummaryPanel
          totalIncome={budget?.monthly_income || 0}
          totalExpenses={totalExpenses}
          netLeftover={remainingIncome}
        />

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

        <div>
          <h2 className="text-2xl font-bold mb-6">Insights & Recommendations</h2>
          <InsightsPanel totalIncome={budget?.monthly_income || 0} categoryTotals={categoryTotals} />
        </div>
      </main>
    </div>
  );
};

export default Index;
