import { Card } from "@/components/ui/card";
import { TrendingDown, TrendingUp, Wallet } from "lucide-react";

interface SummaryPanelProps {
  totalIncome: number;
  totalExpenses: number;
  netLeftover: number;
}

const SummaryPanel = ({ totalIncome, totalExpenses, netLeftover }: SummaryPanelProps) => {
  const isPositive = netLeftover >= 0;
  const percentSpent = totalIncome > 0 ? (totalExpenses / totalIncome) * 100 : 0;

  return (
    <Card className="p-6 shadow-md bg-card">
      <h2 className="text-2xl font-bold mb-6 flex items-center gap-2">
        <Wallet className="w-6 h-6 text-primary" />
        Financial Summary
      </h2>
      
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="space-y-2">
          <p className="text-sm text-muted-foreground">Total Income</p>
          <p className="text-3xl font-bold text-primary">
            ${totalIncome.toFixed(2)}
          </p>
        </div>

        <div className="space-y-2">
          <p className="text-sm text-muted-foreground">Total Expenses</p>
          <p className="text-3xl font-bold text-foreground">
            ${totalExpenses.toFixed(2)}
          </p>
          <p className="text-xs text-muted-foreground">
            {percentSpent.toFixed(1)}% of income
          </p>
        </div>

        <div className="space-y-2">
          <p className="text-sm text-muted-foreground">Net Monthly Leftover</p>
          <div className="flex items-center gap-2">
            {isPositive ? (
              <TrendingUp className="w-6 h-6 text-success" />
            ) : (
              <TrendingDown className="w-6 h-6 text-destructive" />
            )}
            <p className={`text-3xl font-bold ${isPositive ? 'text-success' : 'text-destructive'}`}>
              {isPositive ? '+' : '-'}${Math.abs(netLeftover).toFixed(2)}
            </p>
          </div>
        </div>
      </div>
    </Card>
  );
};

export default SummaryPanel;
