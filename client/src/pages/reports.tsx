import { useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Download, TrendingUp, TrendingDown, BarChart3 } from "lucide-react";

export default function Reports() {
  const { toast } = useToast();
  const { isAuthenticated, isLoading } = useAuth();

  // Redirect to login if not authenticated
  useEffect(() => {
    if (!isLoading && !isAuthenticated) {
      toast({
        title: "Unauthorized",
        description: "You are logged out. Logging in again...",
        variant: "destructive",
      });
      setTimeout(() => {
        window.location.href = "/auth";
      }, 500);
    }
  }, [isAuthenticated, isLoading, toast]);

  const { data: analyticsData, isLoading: analyticsLoading } = useQuery({
    queryKey: ["/api/analytics/dashboard"],
    retry: false,
    enabled: isAuthenticated,
  });

  if (isLoading || analyticsLoading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto mb-4"></div>
          <p className="text-gray-600">Loading reports...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="px-4 py-6 sm:px-6 lg:px-8">
      {/* Header */}
      <div className="mb-8">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Reports</h1>
            <p className="mt-1 text-sm text-gray-500">Analyze your financial data and trends</p>
          </div>
          <div className="flex items-center space-x-3">
            <Select defaultValue="monthly">
              <SelectTrigger className="w-32">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="weekly">Weekly</SelectItem>
                <SelectItem value="monthly">Monthly</SelectItem>
                <SelectItem value="yearly">Yearly</SelectItem>
              </SelectContent>
                </Select>
                <Button variant="outline">
                  <Download className="w-4 h-4 mr-2" />
                  Export
                </Button>
              </div>
            </div>
          </div>

          {/* Summary Cards */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
            <Card>
              <CardContent className="p-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-gray-600">Net Income</p>
                    <p className="text-2xl font-bold text-green-600">
                      +${(((analyticsData as any)?.monthlyIncome || 0) - ((analyticsData as any)?.monthlyExpenses || 0)).toFixed(2)}
                    </p>
                  </div>
                  <TrendingUp className="h-8 w-8 text-green-600" />
                </div>
                <div className="mt-4">
                  <span className="text-sm text-green-600">+12.5%</span>
                  <span className="text-sm text-gray-500 ml-1">vs last month</span>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="p-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-gray-600">Total Expenses</p>
                    <p className="text-2xl font-bold text-red-600">
                      ${(analyticsData as any)?.monthlyExpenses?.toFixed(2) || "0.00"}
                    </p>
                  </div>
                  <TrendingDown className="h-8 w-8 text-red-600" />
                </div>
                <div className="mt-4">
                  <span className="text-sm text-red-600">+5.1%</span>
                  <span className="text-sm text-gray-500 ml-1">vs last month</span>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="p-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-gray-600">Avg. Daily Spend</p>
                    <p className="text-2xl font-bold text-gray-900">
                      ${(((analyticsData as any)?.monthlyExpenses || 0) / 30).toFixed(2)}
                    </p>
                  </div>
                  <BarChart3 className="h-8 w-8 text-primary" />
                </div>
                <div className="mt-4">
                  <span className="text-sm text-primary">-2.3%</span>
                  <span className="text-sm text-gray-500 ml-1">vs last month</span>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="p-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-gray-600">Transaction Count</p>
                    <p className="text-2xl font-bold text-gray-900">
                      {(analyticsData as any)?.recentTransactions?.length || 0}
                    </p>
                  </div>
                  <div className="bg-secondary/10 p-2 rounded-full">
                    <BarChart3 className="h-6 w-6 text-secondary" />
                  </div>
                </div>
                <div className="mt-4">
                  <span className="text-sm text-secondary">+8.2%</span>
                  <span className="text-sm text-gray-500 ml-1">vs last month</span>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Detailed Reports */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Monthly Spending Trends */}
            <Card>
              <CardHeader>
                <CardTitle>Monthly Spending Trends</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="h-64 flex items-end justify-center space-x-2">
                  <div className="text-center text-gray-500">
                    <BarChart3 className="h-16 w-16 mx-auto mb-2" />
                    <p>Chart visualization will be rendered here</p>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Category Breakdown */}
            <Card>
              <CardHeader>
                <CardTitle>Category Breakdown</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {(analyticsData as any)?.categoryExpenses?.map((category: any, index: number) => (
                    <div key={`${category.categoryName}-${index}`} className="flex items-center justify-between">
                      <div className="flex items-center space-x-3">
                        <div 
                          className="w-4 h-4 rounded-full"
                          style={{ backgroundColor: category.categoryColor }}
                        ></div>
                        <span className="text-sm font-medium">{category.categoryName}</span>
                      </div>
                      <div className="text-right">
                        <p className="text-sm font-medium">${category.total}</p>
                        <p className="text-xs text-gray-500">
                          {((category.total / ((analyticsData as any)?.monthlyExpenses || 1)) * 100).toFixed(1)}%
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </div>
    </div>
  );
}
