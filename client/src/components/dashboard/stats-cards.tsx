import { Card, CardContent } from "@/components/ui/card";
import { Wallet, TrendingUp, TrendingDown, Target } from "lucide-react";

interface StatsCardsProps {
  data: any;
}

export default function StatsCards({ data }: StatsCardsProps) {
  const savingsPercentage = data?.savingsGoal?.percentage || 0;
  
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
      <Card className="border-0 shadow-sm">
        <CardContent className="p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600">Total Balance</p>
              <p className="text-2xl font-bold text-gray-900">
                ${data?.totalBalance?.toFixed(2) || "0.00"}
              </p>
            </div>
            <div className="bg-primary/10 p-3 rounded-full">
              <Wallet className="h-6 w-6 text-primary" />
            </div>
          </div>
          <div className="mt-4">
            <span className="text-sm text-green-600">+12.5%</span>
            <span className="text-sm text-gray-500 ml-1">from last month</span>
          </div>
        </CardContent>
      </Card>
      
      <Card className="border-0 shadow-sm">
        <CardContent className="p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600">Monthly Income</p>
              <p className="text-2xl font-bold text-green-600">
                ${data?.monthlyIncome?.toFixed(2) || "0.00"}
              </p>
            </div>
            <div className="bg-green-100 p-3 rounded-full">
              <TrendingUp className="h-6 w-6 text-green-600" />
            </div>
          </div>
          <div className="mt-4">
            <span className="text-sm text-green-600">+8.2%</span>
            <span className="text-sm text-gray-500 ml-1">from last month</span>
          </div>
        </CardContent>
      </Card>
      
      <Card className="border-0 shadow-sm">
        <CardContent className="p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600">Monthly Expenses</p>
              <p className="text-2xl font-bold text-red-600">
                ${data?.monthlyExpenses?.toFixed(2) || "0.00"}
              </p>
            </div>
            <div className="bg-red-100 p-3 rounded-full">
              <TrendingDown className="h-6 w-6 text-red-600" />
            </div>
          </div>
          <div className="mt-4">
            <span className="text-sm text-red-600">+5.1%</span>
            <span className="text-sm text-gray-500 ml-1">from last month</span>
          </div>
        </CardContent>
      </Card>
      
      <Card className="border-0 shadow-sm">
        <CardContent className="p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600">Savings Goal</p>
              <p className="text-2xl font-bold text-blue-600">
                {savingsPercentage.toFixed(0)}%
              </p>
            </div>
            <div className="bg-blue-100 p-3 rounded-full">
              <Target className="h-6 w-6 text-blue-600" />
            </div>
          </div>
          <div className="mt-4">
            <div className="w-full bg-gray-200 rounded-full h-2">
              <div 
                className="bg-blue-600 h-2 rounded-full transition-all duration-300" 
                style={{ width: `${Math.min(savingsPercentage, 100)}%` }}
              />
            </div>
            <span className="text-sm text-gray-500 mt-1">
              ${data?.savingsGoal?.current?.toFixed(2) || "0"} of ${data?.savingsGoal?.target?.toFixed(2) || "0"}
            </span>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
