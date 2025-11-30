import { Card } from "@/components/ui/card";
import { PieChart, Pie, Cell, ResponsiveContainer, Legend, Tooltip } from "recharts";
import { AlertCircle, CheckCircle, Lightbulb } from "lucide-react";

interface CategoryExpense {
  name: string;
  value: number;
  color: string;
}

interface InsightsPanelProps {
  totalIncome: number;
  categoryTotals: {
    housing: number;
    groceries: number;
    transportation: number;
    health: number;
    personal: number;
    entertainment: number;
  };
}

const InsightsPanel = ({ totalIncome, categoryTotals }: InsightsPanelProps) => {
  const chartData: CategoryExpense[] = [
    { name: "Housing", value: categoryTotals.housing, color: "hsl(var(--housing))" },
    { name: "Groceries", value: categoryTotals.groceries, color: "hsl(var(--groceries))" },
    { name: "Transportation", value: categoryTotals.transportation, color: "hsl(var(--transportation))" },
    { name: "Health", value: categoryTotals.health, color: "hsl(var(--health))" },
    { name: "Personal", value: categoryTotals.personal, color: "hsl(var(--personal))" },
    { name: "Entertainment", value: categoryTotals.entertainment, color: "hsl(var(--entertainment))" },
  ].filter(item => item.value > 0);

  const totalExpenses = Object.values(categoryTotals).reduce((sum, val) => sum + val, 0);
  const savingsRate = totalIncome > 0 ? ((totalIncome - totalExpenses) / totalIncome) * 100 : 0;
  
  // Calculate category percentages
  const housingPercent = totalIncome > 0 ? (categoryTotals.housing / totalIncome) * 100 : 0;
  const transportationPercent = totalIncome > 0 ? (categoryTotals.transportation / totalIncome) * 100 : 0;
  const entertainmentPercent = totalIncome > 0 ? (categoryTotals.entertainment / totalIncome) * 100 : 0;
  const spendingRate = 100 - savingsRate;

  const warnings = [];
  const tips = [];

  // Savings recommendations
  if (savingsRate > 20) {
    tips.push("Great job! You're saving more than 20% of your income.");
  } else if (savingsRate >= 10) {
    tips.push("You're on the right track! Try to increase your savings rate to 20% or more.");
  } else if (spendingRate > 90) {
    warnings.push("You're spending over 90% of your income. Consider reducing expenses in one or two categories.");
  } else {
    tips.push("Try to aim for at least 10-20% of your income going into savings.");
  }

  // Category warnings
  if (housingPercent > 30) {
    warnings.push("Your housing costs are above the typical 30% benchmark.");
  }
  if (transportationPercent > 20) {
    warnings.push("Transportation costs exceed the recommended 15-20% of income.");
  }
  if (entertainmentPercent > 10) {
    warnings.push("Entertainment spending is above the recommended 10% of income.");
  }

  return (
    <div className="space-y-6">
      {/* Pie Chart */}
      {chartData.length > 0 && (
        <Card className="p-6 shadow-md">
          <h2 className="text-2xl font-bold mb-6">Expense Distribution</h2>
          <ResponsiveContainer width="100%" height={300}>
            <PieChart>
              <Pie
                data={chartData}
                cx="50%"
                cy="50%"
                labelLine={false}
                label={({ name, percent }) => `${name}: ${(percent * 100).toFixed(0)}%`}
                outerRadius={100}
                fill="#8884d8"
                dataKey="value"
              >
                {chartData.map((entry, index) => (
                  <Cell key={`cell-${index}`} fill={entry.color} />
                ))}
              </Pie>
              <Tooltip formatter={(value: number) => `$${value.toFixed(2)}`} />
              <Legend />
            </PieChart>
          </ResponsiveContainer>
        </Card>
      )}

      {/* Savings Tips */}
      {tips.length > 0 && (
        <Card className="p-6 shadow-md bg-success/5 border-success/20">
          <div className="flex items-start gap-3">
            <CheckCircle className="w-6 h-6 text-success flex-shrink-0 mt-1" />
            <div>
              <h3 className="text-lg font-semibold mb-2 text-success">Savings Insights</h3>
              <ul className="space-y-1">
                {tips.map((tip, index) => (
                  <li key={index} className="text-sm">{tip}</li>
                ))}
              </ul>
            </div>
          </div>
        </Card>
      )}

      {/* Warnings */}
      {warnings.length > 0 && (
        <Card className="p-6 shadow-md bg-warning/5 border-warning/20">
          <div className="flex items-start gap-3">
            <AlertCircle className="w-6 h-6 text-warning flex-shrink-0 mt-1" />
            <div>
              <h3 className="text-lg font-semibold mb-2 text-warning">Budget Alerts</h3>
              <ul className="space-y-1">
                {warnings.map((warning, index) => (
                  <li key={index} className="text-sm">{warning}</li>
                ))}
              </ul>
            </div>
          </div>
        </Card>
      )}

      {/* General Recommendations */}
      <Card className="p-6 shadow-md bg-secondary/10 border-secondary/20">
        <div className="flex items-start gap-3">
          <Lightbulb className="w-6 h-6 text-secondary-foreground flex-shrink-0 mt-1" />
          <div>
            <h3 className="text-lg font-semibold mb-2">Budget Tips</h3>
            <ul className="space-y-2 text-sm">
              <li>• Housing should ideally be 25-30% of your income</li>
              <li>• Transportation costs should stay under 15-20%</li>
              <li>• Entertainment should be limited to 5-10%</li>
              <li>• Aim to save at least 20% of your monthly income</li>
            </ul>
          </div>
        </div>
      </Card>
    </div>
  );
};

export default InsightsPanel;
