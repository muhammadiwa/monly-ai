import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { useQuery } from "@tanstack/react-query";
import { 
  Activity, 
  ArrowUpRight,
  ArrowDownRight,
  TrendingUp,
  Calendar
} from "lucide-react";
import { formatCurrency } from "@/lib/currencyUtils";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell } from "recharts";

interface LiveCashFlowProps {
  readonly data: any;
  readonly currency: string;
  readonly showBalance: boolean;
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

  if (!cashFlowData?.success || !cashFlowData?.data) {
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
  
  // Ensure all required properties exist with default values
  const safeFlowData = {
    dailyIncome: flowData.dailyIncome ?? 0,
    dailyExpenses: flowData.dailyExpenses ?? 0,
    dailyCashFlow: flowData.dailyCashFlow ?? 0,
    weeklyIncome: flowData.weeklyIncome ?? 0,
    weeklyExpenses: flowData.weeklyExpenses ?? 0,
    weeklyCashFlow: flowData.weeklyCashFlow ?? 0,
    monthlyIncome: flowData.monthlyIncome ?? 0,
    monthlyExpenses: flowData.monthlyExpenses ?? 0,
    monthlyCashFlow: flowData.monthlyCashFlow ?? 0,
    burnRate: flowData.burnRate ?? 0,
    currentBalance: flowData.currentBalance ?? 0,
    projectedBalance: flowData.projectedBalance ?? 0,
    cashFlowTrend: flowData.cashFlowTrend ?? []
  };
  
  const displayData = [
    {
      period: "Daily Average",
      income: safeFlowData.dailyIncome,
      expenses: safeFlowData.dailyExpenses,
      net: safeFlowData.dailyCashFlow,
      trend: safeFlowData.dailyCashFlow >= 0 ? "up" : "down"
    },
    {
      period: "This Week", 
      income: safeFlowData.weeklyIncome,
      expenses: safeFlowData.weeklyExpenses,
      net: safeFlowData.weeklyCashFlow,
      trend: safeFlowData.weeklyCashFlow >= 0 ? "up" : "down"
    },
    {
      period: "This Month",
      income: safeFlowData.monthlyIncome,
      expenses: safeFlowData.monthlyExpenses,
      net: safeFlowData.monthlyCashFlow,
      trend: safeFlowData.monthlyCashFlow >= 0 ? "up" : "down"
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
          <div key={`cashflow-${period.period.toLowerCase().replace(/\s+/g, '-')}`} className="space-y-3">
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
              value={period.income > 0 ? Math.min((period.income - period.expenses) / period.income * 100, 100) : 0} 
              className="h-2"
            />
            
            {index < displayData.length - 1 && (
              <div className="border-b border-gray-100" />
            )}
          </div>
        ))}
        
        {/* Cash Flow Trend Visualization */}
        {safeFlowData.cashFlowTrend && safeFlowData.cashFlowTrend.length > 0 && (
          <div className="mt-4">
            <div className="flex items-center justify-between mb-2">
              <h4 className="text-sm font-medium flex items-center gap-2">
                <TrendingUp className="h-4 w-4 text-blue-500" />
                <span>Cash Flow Trend</span>
              </h4>
              <span className="text-xs text-gray-500 flex items-center gap-1">
                <Calendar className="h-3 w-3" />
                <span>Last 5 weeks</span>
              </span>
            </div>
            
            <div className="h-40">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart
                  data={safeFlowData.cashFlowTrend.map((item: any) => ({
                    ...item,
                    value: item.amount,
                    // Use the new label property if available, otherwise fall back to date formatting
                    name: item.label || item.date,
                  }))}
                  margin={{ top: 0, right: 0, left: 0, bottom: 0 }}
                >
                  <CartesianGrid strokeDasharray="3 3" vertical={false} />
                  <XAxis 
                    dataKey="name" 
                    tick={{ fontSize: 10 }}
                    tickLine={false}
                  />
                  <YAxis 
                    hide 
                    tickLine={false}
                  />
                  <Tooltip 
                    formatter={(value: number) => formatCurrency(value, currency)}
                    labelFormatter={(label) => `${label}`}
                    contentStyle={{ fontSize: '12px' }}
                  />
                  <Bar 
                    dataKey="value" 
                    radius={[4, 4, 0, 0]}
                  >
                    {safeFlowData.cashFlowTrend.map((entry: any, index: number) => (
                      <Cell 
                        key={`cell-${index}`} 
                        fill={entry.amount >= 0 ? '#10B981' : '#EF4444'} 
                      />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>
        )}
        
        {/* Projections Section */}
        <div className="mt-4 pt-4 border-t border-gray-100">
          <div className="flex items-center justify-between mb-3">
            <h4 className="text-sm font-medium text-gray-700">Current Balance</h4>
            <span className={`text-sm font-medium ${safeFlowData.currentBalance >= 0 ? 'text-green-600' : 'text-red-600'}`}>
              {showBalance ? formatCurrency(safeFlowData.currentBalance, currency) : '••••••'}
            </span>
          </div>
          
          <div className="flex items-center justify-between mb-3">
            <h4 className="text-sm font-medium text-gray-700">Projected in 3 months</h4>
            <span className={`text-sm font-medium ${safeFlowData.projectedBalance >= 0 ? 'text-green-600' : 'text-red-600'}`}>
              {showBalance ? formatCurrency(safeFlowData.projectedBalance, currency) : '••••••'}
            </span>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
