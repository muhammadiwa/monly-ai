import { Card, CardContent } from "@/components/ui/card";
import { Wallet, TrendingUp, TrendingDown, Target } from "lucide-react";

interface StatsCardsProps {
  data: any;
  showBalance?: boolean;
}

export default function StatsCards({ data, showBalance = true }: StatsCardsProps) {
  const savingsRate = data?.savingsRate || 0;
  const totalBalance = data?.totalBalance || 0;
  const monthlyIncome = data?.monthlyIncome || 0;
  const monthlyExpenseTotal = data?.monthlyExpenseTotal || 0;
  
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
      <Card className="bg-gradient-to-r from-blue-50 to-blue-100 border-blue-200 shadow-lg">
        <CardContent className="p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-blue-700">Total Balance</p>
              <p className="text-2xl font-bold text-blue-800">
                {showBalance ? `$${totalBalance.toFixed(2)}` : "****"}
              </p>
            </div>
            <div className="bg-blue-600 p-3 rounded-full">
              <Wallet className="h-6 w-6 text-white" />
            </div>
          </div>
          <div className="mt-4">
            <span className="text-sm text-blue-600">+12.5%</span>
            <span className="text-sm text-blue-500 ml-1">from last month</span>
          </div>
        </CardContent>
      </Card>
      
      <Card className="bg-gradient-to-r from-green-50 to-green-100 border-green-200 shadow-lg">
        <CardContent className="p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-green-700">Monthly Income</p>
              <p className="text-2xl font-bold text-green-800">
                {showBalance ? `$${monthlyIncome.toFixed(2)}` : "****"}
              </p>
            </div>
            <div className="bg-green-600 p-3 rounded-full">
              <TrendingUp className="h-6 w-6 text-white" />
            </div>
          </div>
          <div className="mt-4">
            <span className="text-sm text-green-600">+8.2%</span>
            <span className="text-sm text-green-500 ml-1">from last month</span>
          </div>
        </CardContent>
      </Card>
      
      <Card className="bg-gradient-to-r from-red-50 to-red-100 border-red-200 shadow-lg">
        <CardContent className="p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-red-700">Monthly Expenses</p>
              <p className="text-2xl font-bold text-red-800">
                {showBalance ? `$${monthlyExpenseTotal.toFixed(2)}` : "****"}
              </p>
            </div>
            <div className="bg-red-600 p-3 rounded-full">
              <TrendingDown className="h-6 w-6 text-white" />
            </div>
          </div>
          <div className="mt-4">
            <span className="text-sm text-red-600">+5.1%</span>
            <span className="text-sm text-red-500 ml-1">from last month</span>
          </div>
        </CardContent>
      </Card>
      
      <Card className="bg-gradient-to-r from-purple-50 to-purple-100 border-purple-200 shadow-lg">
        <CardContent className="p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-purple-700">Savings Rate</p>
              <p className="text-2xl font-bold text-purple-800">
                {savingsRate}%
              </p>
            </div>
            <div className="bg-purple-600 p-3 rounded-full">
              <Target className="h-6 w-6 text-white" />
            </div>
          </div>
          <div className="mt-4">
            <div className="w-full bg-gray-200 rounded-full h-2">
              <div 
                className="bg-purple-600 h-2 rounded-full transition-all duration-300" 
                style={{ width: `${Math.min(Math.abs(savingsRate), 100)}%` }}
              />
            </div>
            <span className="text-sm text-purple-500 mt-1">
              {savingsRate > 0 ? 'Above' : 'Below'} average
            </span>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
