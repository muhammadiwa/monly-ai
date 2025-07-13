import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { useQuery } from "@tanstack/react-query";
import { 
  Activity, 
  TrendingUp, 
  TrendingDown,
  ArrowUpRight,
  ArrowDownRight,
  DollarSign,
  Zap
} from "lucide-react";
import { formatCurrency } from "@/lib/currencyUtils";

interface LiveCashFlowProps {
  data: any;
  currency: string;
  showBalance: boolean;
}

export default function LiveCashFlow({ data, currency, showBalance }: LiveCashFlowProps) {
  // Fetch live cash flow data from API
  const { data: cashFlowData } = useQuery({
    queryKey: ["/api/analytics/cash-flow"],
    queryFn: () => {
      const authToken = localStorage.getItem('auth-token');
      return fetch("/api/analytics/cash-flow", {
        credentials: 'include',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${authToken}`,
        },
      }).then(res => res.json());
    },
    refetchInterval: 30000, // Refetch every 30 seconds
  });

  if (!cashFlowData?.success) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Activity className="h-5 w-5 text-green-600" />
            Live Cash Flow
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-center text-gray-500 py-4">
            Loading cash flow data...
          </div>
        </CardContent>
      </Card>
    );
  }

  const flowData = cashFlowData.data;
  
  const displayData = [
    {
      period: "Daily Average",
      income: Math.abs(flowData.dailyCashFlow) > 0 ? flowData.dailyCashFlow + Math.abs(flowData.dailyCashFlow) : 0,
      expenses: Math.abs(flowData.dailyCashFlow),
      net: flowData.dailyCashFlow,
      trend: flowData.dailyCashFlow >= 0 ? "up" : "down"
    },
    {
      period: "This Week", 
      income: flowData.weeklyCashFlow >= 0 ? flowData.weeklyCashFlow + Math.abs(flowData.weeklyCashFlow) : Math.abs(flowData.weeklyCashFlow),
      expenses: Math.abs(flowData.weeklyCashFlow),
      net: flowData.weeklyCashFlow,
      trend: flowData.weeklyCashFlow >= 0 ? "up" : "down"
    },
    {
      period: "This Month",
      income: flowData.monthlyIncome,
      expenses: flowData.monthlyExpenses,
      net: flowData.monthlyCashFlow,
      trend: flowData.monthlyCashFlow >= 0 ? "up" : "down"
    }
  ];

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Activity className="h-5 w-5 text-green-600" />
          Live Cash Flow
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {displayData.map((period, index) => (
          <div key={index} className="space-y-3">
            <div className="flex items-center justify-between">
              <h4 className="font-medium text-gray-900">{period.period}</h4>
              <div className="flex items-center gap-1">
                {period.trend === 'up' ? (
                  <ArrowUpRight className="h-4 w-4 text-green-500" />
                ) : (
                  <ArrowDownRight className="h-4 w-4 text-red-500" />
                )}
                <span className={`text-sm font-medium ${period.trend === 'up' ? 'text-green-600' : 'text-red-600'}`}>
                  {showBalance ? formatCurrency(period.net, currency) : '••••••'}
                </span>
              </div>
            </div>
            
            <div className="grid grid-cols-2 gap-3 text-sm">
              <div className="flex items-center justify-between">
                <span className="text-gray-500">Income</span>
                <span className="font-medium text-green-600">
                  {showBalance ? formatCurrency(period.income, currency) : '••••••'}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-gray-500">Expenses</span>
                <span className="font-medium text-red-600">
                  {showBalance ? formatCurrency(period.expenses, currency) : '••••••'}
                </span>
              </div>
            </div>
            
            <Progress 
              value={(period.net / period.income) * 100} 
              className="h-2"
            />
            
            {index < cashFlowData.length - 1 && (
              <div className="border-b border-gray-100" />
            )}
          </div>
        ))}
        
        {/* Quick Actions */}
        <div className="mt-4 p-3 bg-gradient-to-r from-green-50 to-emerald-50 rounded-lg border border-green-200">
          <div className="flex items-center gap-2 mb-2">
            <Zap className="h-4 w-4 text-green-600" />
            <h4 className="font-medium text-green-900">Cash Flow Insights</h4>
          </div>
          <p className="text-sm text-green-700">
            Your cash flow is positive across all periods. Consider investing excess cash for better returns.
          </p>
        </div>
      </CardContent>
    </Card>
  );
}
