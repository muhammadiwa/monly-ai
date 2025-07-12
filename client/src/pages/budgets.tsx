import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";
import Sidebar from "@/components/layout/sidebar";
import MobileHeader from "@/components/layout/mobile-header";
import MobileNav from "@/components/layout/mobile-nav";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { Plus, Target, AlertTriangle } from "lucide-react";

export default function Budgets() {
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
      return;
    }
  }, [isAuthenticated, isLoading, toast]);

  const { data: budgets, isLoading: budgetsLoading } = useQuery({
    queryKey: ["/api/budgets"],
    retry: false,
    enabled: isAuthenticated,
  });

  if (isLoading || budgetsLoading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto mb-4"></div>
          <p className="text-gray-600">Loading budgets...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <Sidebar />
      <MobileHeader />
      
      <div className="lg:pl-64">
        <div className="px-4 py-6 sm:px-6 lg:px-8">
          {/* Header */}
          <div className="mb-8">
            <div className="flex items-center justify-between">
              <div>
                <h1 className="text-2xl font-bold text-gray-900">Budgets</h1>
                <p className="mt-1 text-sm text-gray-500">Set and track your spending goals</p>
              </div>
              <Button className="bg-primary hover:bg-primary/90">
                <Plus className="w-4 h-4 mr-2" />
                Create Budget
              </Button>
            </div>
          </div>

          {/* Budget Overview */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
            <Card>
              <CardContent className="p-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-gray-600">Total Budget</p>
                    <p className="text-2xl font-bold text-gray-900">$3,500</p>
                  </div>
                  <Target className="h-8 w-8 text-primary" />
                </div>
              </CardContent>
            </Card>
            
            <Card>
              <CardContent className="p-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-gray-600">Spent</p>
                    <p className="text-2xl font-bold text-red-600">$2,150</p>
                  </div>
                  <AlertTriangle className="h-8 w-8 text-red-500" />
                </div>
              </CardContent>
            </Card>
            
            <Card>
              <CardContent className="p-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-gray-600">Remaining</p>
                    <p className="text-2xl font-bold text-green-600">$1,350</p>
                  </div>
                  <div className="bg-green-100 p-2 rounded-full">
                    <Target className="h-6 w-6 text-green-600" />
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Budget Categories */}
          <Card>
            <CardHeader>
              <CardTitle>Budget Categories</CardTitle>
            </CardHeader>
            <CardContent>
              {!budgets || budgets.length === 0 ? (
                <div className="text-center py-12">
                  <Target className="mx-auto h-12 w-12 text-gray-400 mb-4" />
                  <p className="text-gray-500 mb-4">No budgets set yet</p>
                  <Button>Create your first budget</Button>
                </div>
              ) : (
                <div className="space-y-6">
                  {/* Mock budget data - replace with actual data */}
                  {[
                    { category: "Food & Dining", budget: 800, spent: 650, color: "bg-primary" },
                    { category: "Transportation", budget: 400, spent: 320, color: "bg-secondary" },
                    { category: "Shopping", budget: 600, spent: 480, color: "bg-warning" },
                    { category: "Entertainment", budget: 300, spent: 280, color: "bg-danger" },
                  ].map((item, index) => {
                    const percentage = (item.spent / item.budget) * 100;
                    const isOverBudget = percentage > 100;
                    const isNearLimit = percentage > 80;
                    
                    return (
                      <div key={index} className="space-y-2">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center space-x-3">
                            <div className={`w-3 h-3 rounded-full ${item.color}`}></div>
                            <span className="font-medium">{item.category}</span>
                            {isOverBudget && (
                              <Badge variant="destructive" className="text-xs">
                                Over Budget
                              </Badge>
                            )}
                            {isNearLimit && !isOverBudget && (
                              <Badge variant="secondary" className="text-xs">
                                Near Limit
                              </Badge>
                            )}
                          </div>
                          <div className="text-right">
                            <p className="text-sm font-medium">
                              ${item.spent} / ${item.budget}
                            </p>
                            <p className="text-xs text-gray-500">
                              {percentage.toFixed(1)}%
                            </p>
                          </div>
                        </div>
                        <Progress 
                          value={Math.min(percentage, 100)} 
                          className={`h-2 ${isOverBudget ? 'bg-red-100' : isNearLimit ? 'bg-yellow-100' : 'bg-gray-200'}`}
                        />
                        <div className="flex justify-between text-xs text-gray-500">
                          <span>Remaining: ${Math.max(0, item.budget - item.spent)}</span>
                          <span>{Math.max(0, 100 - percentage).toFixed(1)}% left</span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>

      <MobileNav />
    </div>
  );
}
