interface BudgetBarProps {
  spent: number;
  total?: number;
}

export default function BudgetBar({ spent, total = 100 }: BudgetBarProps) {
  const remaining = total - spent;
  const pct = Math.min(100, (spent / total) * 100);

  return (
    <div className="budget-bar">
      <div className="budget-bar__labels">
        <span className="budget-bar__spent">Spent: ${spent.toFixed(1)}M</span>
        <span className="budget-bar__remaining">Remaining: ${remaining.toFixed(1)}M</span>
      </div>
      <div className="budget-bar__track">
        <div className="budget-bar__fill" style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
}
