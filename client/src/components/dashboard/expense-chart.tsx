import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

interface ExpenseChartProps {
  data: any[];
}

export default function ExpenseChart({ data }: ExpenseChartProps) {
  // Generate mock data for the chart bars
  const chartData = data.length > 0 ? data.slice(0, 6) : [
    { month: "Jan", amount: 2500 },
    { month: "Feb", amount: 3200 },
    { month: "Mar", amount: 1800 },
    { month: "Apr", amount: 3600 },
    { month: "May", amount: 2800 },
    { month: "Jun", amount: 2200 },
  ];

  const maxAmount = Math.max(...chartData.map(d => d.amount || 0));

  return (
    <Card className="border-0 shadow-sm">
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="text-lg font-semibold">Monthly Expenses</CardTitle>
          <Select defaultValue="6months">
            <SelectTrigger className="w-32">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="6months">Last 6 months</SelectItem>
              <SelectItem value="12months">Last 12 months</SelectItem>
              <SelectItem value="year">This year</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </CardHeader>
      <CardContent>
        <div className="h-64 flex items-end justify-center space-x-2">
          {chartData.map((item, index) => {
            const height = maxAmount > 0 ? (item.amount / maxAmount) * 100 : 20;
            
            return (
              <div
                key={index}
                className="flex-1 bg-primary/20 hover:bg-primary/30 transition-colors cursor-pointer rounded-t"
                style={{ height: `${height}%` }}
                title={`${item.month}: $${item.amount}`}
              >
                <div className="h-full bg-primary rounded-t" />
              </div>
            );
          })}
        </div>
        <div className="flex justify-between mt-4 text-sm text-gray-600">
          {chartData.map((item, index) => (
            <span key={index}>{item.month}</span>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
