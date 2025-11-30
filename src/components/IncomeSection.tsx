import { DollarSign } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

interface IncomeSectionProps {
  monthlyIncome: number;
  remainingIncome: number;
  onIncomeChange: (value: number) => void;
}

const IncomeSection = ({ monthlyIncome, remainingIncome, onIncomeChange }: IncomeSectionProps) => {
  const isNegative = remainingIncome < 0;
  
  return (
    <Card className="p-6 shadow-md">
      <div className="space-y-4">
        <div>
          <Label htmlFor="monthly-income" className="flex items-center gap-2 text-lg font-semibold mb-2">
            <DollarSign className="w-5 h-5 text-primary" />
            Monthly Income
          </Label>
          <Input
            id="monthly-income"
            type="number"
            min="0"
            step="0.01"
            value={monthlyIncome || ""}
            onChange={(e) => onIncomeChange(parseFloat(e.target.value) || 0)}
            placeholder="Enter your monthly income"
            className="text-lg"
          />
        </div>
        
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-4 border-t">
          <div>
            <p className="text-sm text-muted-foreground mb-1">Total Monthly Income</p>
            <p className="text-2xl font-bold text-primary">
              ${monthlyIncome.toFixed(2)}
            </p>
          </div>
          
          <div>
            <p className="text-sm text-muted-foreground mb-1">Remaining Income</p>
            <p className={`text-2xl font-bold ${isNegative ? 'text-destructive' : 'text-success'}`}>
              {isNegative ? '-' : '+'}${Math.abs(remainingIncome).toFixed(2)}
            </p>
          </div>
        </div>
      </div>
    </Card>
  );
};

export default IncomeSection;
