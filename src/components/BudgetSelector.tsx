import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Plus, Users } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

interface Budget {
  id: string;
  name: string;
  monthly_income: number;
  created_at: string;
  member_role: string;
  member_count: number;
}

interface BudgetSelectorProps {
  onSelectBudget: (budgetId: string) => void;
}

export default function BudgetSelector({ onSelectBudget }: BudgetSelectorProps) {
  const { user } = useAuth();
  const { toast } = useToast();
  const [budgets, setBudgets] = useState<Budget[]>([]);
  const [isCreating, setIsCreating] = useState(false);
  const [newBudgetName, setNewBudgetName] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (user) {
      fetchBudgets();
    }
  }, [user]);

  const fetchBudgets = async () => {
    try {
      const { data, error } = await supabase
        .from('budgets')
        .select(`
          id,
          name,
          monthly_income,
          created_at,
          budget_members!inner (
            role,
            user_id
          )
        `)
        .eq('budget_members.user_id', user?.id);

      if (error) throw error;

      // Transform data to include role and count
      const budgetsWithDetails = await Promise.all(
        (data || []).map(async (budget: any) => {
          const { count } = await supabase
            .from('budget_members')
            .select('*', { count: 'exact', head: true })
            .eq('budget_id', budget.id);

          return {
            id: budget.id,
            name: budget.name,
            monthly_income: budget.monthly_income,
            created_at: budget.created_at,
            member_role: budget.budget_members[0]?.role || 'viewer',
            member_count: count || 0,
          };
        })
      );

      setBudgets(budgetsWithDetails);
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

  const createBudget = async () => {
    if (!newBudgetName.trim()) return;

    try {
      const { data, error } = await supabase
        .from('budgets')
        .insert([
          {
            name: newBudgetName,
            monthly_income: 0,
            created_by: user?.id,
          },
        ])
        .select()
        .single();

      if (error) throw error;

      toast({
        title: 'Success',
        description: 'Budget created successfully!',
      });

      setNewBudgetName('');
      setIsCreating(false);
      fetchBudgets();
    } catch (error: any) {
      toast({
        title: 'Error',
        description: error.message,
        variant: 'destructive',
      });
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <p className="text-muted-foreground">Loading budgets...</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-background to-secondary/20 p-4">
      <div className="max-w-4xl mx-auto py-8">
        <div className="flex justify-between items-center mb-6">
          <div>
            <h1 className="text-3xl font-bold">Your Budgets</h1>
            <p className="text-muted-foreground">Select a budget or create a new one</p>
          </div>
          <Button onClick={() => setIsCreating(!isCreating)}>
            <Plus className="mr-2 h-4 w-4" />
            New Budget
          </Button>
        </div>

        {isCreating && (
          <Card className="mb-6">
            <CardHeader>
              <CardTitle>Create New Budget</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="budget-name">Budget Name</Label>
                  <Input
                    id="budget-name"
                    placeholder="Family Budget 2024"
                    value={newBudgetName}
                    onChange={(e) => setNewBudgetName(e.target.value)}
                  />
                </div>
                <div className="flex gap-2">
                  <Button onClick={createBudget}>Create</Button>
                  <Button variant="outline" onClick={() => setIsCreating(false)}>
                    Cancel
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        <div className="grid gap-4 md:grid-cols-2">
          {budgets.map((budget) => (
            <Card
              key={budget.id}
              className="cursor-pointer hover:shadow-lg transition-shadow"
              onClick={() => onSelectBudget(budget.id)}
            >
              <CardHeader>
                <div className="flex justify-between items-start">
                  <CardTitle>{budget.name}</CardTitle>
                  <Badge variant="secondary">{budget.member_role}</Badge>
                </div>
                <CardDescription>
                  Monthly Income: ${budget.monthly_income.toFixed(2)}
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="flex items-center text-sm text-muted-foreground">
                  <Users className="mr-2 h-4 w-4" />
                  {budget.member_count} {budget.member_count === 1 ? 'member' : 'members'}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>

        {budgets.length === 0 && !isCreating && (
          <Card>
            <CardContent className="flex flex-col items-center justify-center py-12">
              <p className="text-muted-foreground mb-4">No budgets yet</p>
              <Button onClick={() => setIsCreating(true)}>
                <Plus className="mr-2 h-4 w-4" />
                Create Your First Budget
              </Button>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}
