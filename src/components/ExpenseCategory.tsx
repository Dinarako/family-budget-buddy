import { useState } from "react";
import { Plus, Trash2, LucideIcon } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";

export interface Expense {
  id: string;
  description: string;
  amount: number;
}

interface ExpenseCategoryProps {
  title: string;
  icon: LucideIcon;
  expenses: Expense[];
  onAddExpense: (description: string, amount: number) => void;
  onRemoveExpense: (id: string) => void;
}

const ExpenseCategory = ({ 
  title, 
  icon: Icon, 
  expenses, 
  onAddExpense,
  onRemoveExpense 
}: ExpenseCategoryProps) => {
  const [description, setDescription] = useState("");
  const [amount, setAmount] = useState("");

  const handleAdd = () => {
    if (description.trim() && amount && parseFloat(amount) > 0) {
      onAddExpense(description.trim(), parseFloat(amount));
      setDescription("");
      setAmount("");
    }
  };

  const categoryTotal = expenses.reduce((sum, exp) => sum + exp.amount, 0);

  return (
    <Card className="p-6 shadow-md hover:shadow-lg transition-shadow">
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Icon className="w-6 h-6 text-primary" />
            <h3 className="text-xl font-semibold">{title}</h3>
          </div>
          {categoryTotal > 0 && (
            <span className="text-lg font-bold text-primary">
              ${categoryTotal.toFixed(2)}
            </span>
          )}
        </div>

        <div className="space-y-3">
          <div>
            <Label htmlFor={`${title}-desc`} className="text-sm">
              Expense Description
            </Label>
            <Input
              id={`${title}-desc`}
              type="text"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="e.g., Water bill"
              className="mt-1"
            />
          </div>

          <div>
            <Label htmlFor={`${title}-amount`} className="text-sm">
              Amount ($)
            </Label>
            <Input
              id={`${title}-amount`}
              type="number"
              min="0"
              step="0.01"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              placeholder="0.00"
              className="mt-1"
            />
          </div>

          <Button 
            onClick={handleAdd}
            className="w-full bg-primary hover:bg-primary/90"
          >
            <Plus className="w-4 h-4 mr-2" />
            Add Expense
          </Button>
        </div>

        {expenses.length > 0 && (
          <div className="space-y-2 pt-3 border-t">
            <p className="text-sm font-medium text-muted-foreground">Expenses:</p>
            {expenses.map((expense) => (
              <div
                key={expense.id}
                className="flex items-center justify-between p-3 bg-muted rounded-lg"
              >
                <div className="flex-1">
                  <p className="font-medium">{expense.description}</p>
                  <p className="text-sm text-primary font-semibold">
                    ${expense.amount.toFixed(2)}
                  </p>
                </div>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => onRemoveExpense(expense.id)}
                  className="text-destructive hover:text-destructive hover:bg-destructive/10"
                >
                  <Trash2 className="w-4 h-4" />
                </Button>
              </div>
            ))}
          </div>
        )}
      </div>
    </Card>
  );
};

export default ExpenseCategory;
