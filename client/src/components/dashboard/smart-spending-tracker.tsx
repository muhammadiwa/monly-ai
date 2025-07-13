import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { 
  Target, 
  TrendingUp, 
  AlertCircle,
  ShoppingCart,
  Coffee,
  Car,
  Home,
  Gamepad2
} from "lucide-react";
import { formatCurrency } from "@/lib/currencyUtils";

interface SmartSpendingTrackerProps {
  data: any;
  currency: string;
  showBalance: boolean;
}

export default function SmartSpendingTracker({ data, currency, showBalance }: SmartSpendingTrackerProps) {
  const categoryData = [
    {
      name: "Food & Dining",
      spent: currency === 'IDR' ? 2850000 : 285,
      budget: currency === 'IDR' ? 3500000 : 350,
      icon: Coffee,
      color: "bg-orange-100 text-orange-700",
      trend: "+12%"
    },
    {
      name: "Transportation", 
      spent: currency === 'IDR' ? 1250000 : 125,
      budget: currency === 'IDR' ? 2000000 : 200,
      icon: Car,
      color: "bg-blue-100 text-blue-700",
      trend: "-8%"
    },
    {
      name: "Shopping",
      spent: currency === 'IDR' ? 1850000 : 185,
      budget: currency === 'IDR' ? 1500000 : 150,
      icon: ShoppingCart,
      color: "bg-red-100 text-red-700",
      trend: "+23%"
    },
    {
      name: "Bills & Utilities",
      spent: currency === 'IDR' ? 1450000 : 145,
      budget: currency === 'IDR' ? 1600000 : 160,
      icon: Home,
      color: "bg-green-100 text-green-700",
      trend: "-5%"
    },
    {
      name: "Entertainment",
      spent: currency === 'IDR' ? 750000 : 75,
      budget: currency === 'IDR' ? 800000 : 80,
      icon: Gamepad2,
      color: "bg-purple-100 text-purple-700",
      trend: "+7%"
    }
  ];

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Target className="h-5 w-5 text-green-600" />
          Smart Spending Tracker
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {categoryData.map((category, index) => {
          const percentage = (category.spent / category.budget) * 100;
          const isOverBudget = percentage > 100;
          const isNearLimit = percentage > 80 && percentage <= 100;
          const Icon = category.icon;
          
          return (
            <div key={index} className="space-y-2">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className={`p-2 rounded-lg ${category.color}`}>
                    <Icon className="h-4 w-4" />
                  </div>
                  <div>
                    <h4 className="font-medium text-gray-900">{category.name}</h4>
                    <p className="text-sm text-gray-500">
                      {showBalance ? formatCurrency(category.spent, currency) : '••••••'} of{' '}
                      {showBalance ? formatCurrency(category.budget, currency) : '••••••'}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <Badge variant={isOverBudget ? "destructive" : isNearLimit ? "secondary" : "default"}>
                    {category.trend}
                  </Badge>
                  {isOverBudget && <AlertCircle className="h-4 w-4 text-red-500" />}
                </div>
              </div>
              
              <Progress 
                value={Math.min(percentage, 100)} 
                className={`h-2 ${isOverBudget ? 'bg-red-100' : isNearLimit ? 'bg-yellow-100' : ''}`}
              />
              
              <div className="flex justify-between text-xs">
                <span className="text-gray-500">{percentage.toFixed(0)}% used</span>
                <span className={`font-medium ${isOverBudget ? 'text-red-600' : 'text-gray-700'}`}>
                  {isOverBudget 
                    ? `Over by ${showBalance ? formatCurrency(category.spent - category.budget, currency) : '••••'}`
                    : `${showBalance ? formatCurrency(category.budget - category.spent, currency) : '••••'} remaining`
                  }
                </span>
              </div>
            </div>
          );
        })}
        
        {/* AI Recommendations */}
        <div className="mt-4 p-3 bg-blue-50 rounded-lg border border-blue-200">
          <div className="flex items-start gap-2">
            <TrendingUp className="h-4 w-4 text-blue-600 mt-0.5" />
            <div>
              <h4 className="text-sm font-medium text-blue-900">AI Recommendation</h4>
              <p className="text-xs text-blue-700 mt-1">
                Consider reducing shopping expenses by 15% to stay within budget. 
                Try setting a weekly spending limit.
              </p>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
