import { DollarSign } from "lucide-react";

const BudgetHeader = () => {
  return (
    <header className="bg-primary text-primary-foreground py-8 px-4 shadow-lg">
      <div className="container mx-auto max-w-6xl">
        <div className="flex items-center gap-3 justify-center mb-2">
          <DollarSign className="w-10 h-10" />
          <h1 className="text-3xl md:text-4xl font-bold">Family Budget Calculator</h1>
        </div>
        <p className="text-center text-primary-foreground/90 text-lg">
          Track your monthly income, expenses, and savings in one place
        </p>
      </div>
    </header>
  );
};

export default BudgetHeader;
