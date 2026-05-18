import { useState, useEffect } from 'react';
import { apiRequest } from '@/lib/api';
import { BudgetWithRole } from '@/lib/types';
import { useAuth } from '@/hooks/useAuth';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Plus, Users } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

interface BudgetSelectorProps {
  onSelectBudget: (budgetId: string) => void;
}

export default function BudgetSelector({ onSelectBudget }: BudgetSelectorProps) {
  const { user } = useAuth();
  const { toast } = useToast();
  const [budgets, setBudgets] = useState<BudgetWithRole[]>([]);
  const [isCreating, setIsCreating] = useState(false);
  const [newBudgetName, setNewBudgetName] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (user) fetchBudgets();
  }, [user]);

  const fetchBudgets = async () => {
    try {
      const data = await apiRequest<{ budgets: BudgetWithRole[] }>('/api/budgets');
      setBudgets(data.budgets);
    } catch (error) {
      toast({
        title: 'Error',
        description: error instanceof Error ? error.message : 'Failed to load budgets',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  const createBudget = async () => {
    if (!newBudgetName.trim()) return;
    try {
      await apiRequest('/api/budgets', {
        method: 'POST',
        body: JSON.stringify({ name: newBudgetName }),
      });
      toast({ title: 'Success', description: 'Budget created successfully!' });
      setNewBudgetName('');
      setIsCreating(false);
      fetchBudgets();
    } catch (error) {
      toast({
        title: 'Error',
        description: error instanceof Error ? error.message : 'Failed to create budget',
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
                    onChange={e => setNewBudgetName(e.target.value)}
                    onKeyDown={e => e.key === 'Enter' && createBudget()}
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
          {budgets.map(budget => (
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
