import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";
import StatsCards from "@/components/dashboard/stats-cards";
import ExpenseChart from "@/components/dashboard/expense-chart";
import CategoryChart from "@/components/dashboard/category-chart";
import RecentTransactions from "@/components/dashboard/recent-transactions";
import AddTransactionModal from "@/components/modals/add-transaction-modal";
import WhatsAppChatModal from "@/components/modals/whatsapp-chat-modal";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { 
  Plus, 
  MessageCircle, 
  TrendingUp, 
  Target,
  Zap,
  Calendar,
  Filter,
  Download,
  RefreshCw,
  Eye,
  EyeOff
} from "lucide-react";

export default function Dashboard() {
  const { toast } = useToast();
  const { isAuthenticated, isLoading, user } = useAuth();
  const [showAddTransaction, setShowAddTransaction] = useState(false);
  const [showWhatsAppChat, setShowWhatsAppChat] = useState(false);
  const [showBalance, setShowBalance] = useState(true);

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

  const { data: analyticsData, isLoading: analyticsLoading, refetch } = useQuery({
    queryKey: ["/api/analytics/dashboard"],
    retry: false,
    enabled: isAuthenticated,
  });

  const { data: recentTransactions } = useQuery({
    queryKey: ["/api/transactions", { limit: 10 }],
    retry: false,
    enabled: isAuthenticated,
  });

  const { data: budgets } = useQuery({
    queryKey: ["/api/budgets"],
    retry: false,
    enabled: isAuthenticated,
  });

  const refreshData = () => {
    refetch();
  };

  if (isLoading || analyticsLoading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-16 w-16 border-4 border-green-600 border-t-transparent mx-auto mb-6"></div>
          <h2 className="text-2xl font-semibold text-gray-900 mb-2">Loading your dashboard</h2>
          <p className="text-gray-600">Preparing your financial insights...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="px-4 py-6 sm:px-6 lg:px-8">
      {/* Dashboard Header */}
      <div className="mb-8">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">
              Welcome back, {(user as any)?.firstName || 'User'}! 👋
            </h1>
            <p className="mt-2 text-lg text-gray-600">
              Here's your financial overview for today
            </p>
          </div>
          <div className="flex items-center space-x-3">
            <Button
              variant="outline"
              onClick={refreshData}
              className="hidden sm:flex"
            >
              <RefreshCw className="h-4 w-4 mr-2" />
              Refresh
            </Button>
            <Button
              variant="outline"
              onClick={() => setShowBalance(!showBalance)}
              className="hidden sm:flex"
            >
              {showBalance ? (
                <EyeOff className="h-4 w-4 mr-2" />
              ) : (
                <Eye className="h-4 w-4 mr-2" />
              )}
              {showBalance ? 'Hide' : 'Show'} Balance
            </Button>
            <Button
              onClick={() => setShowWhatsAppChat(true)}
              className="bg-green-600 hover:bg-green-700 text-white shadow-lg"
            >
              <MessageCircle className="h-4 w-4 mr-2" />
              AI Chat
            </Button>
            <Button
              onClick={() => setShowAddTransaction(true)}
              className="bg-blue-600 hover:bg-blue-700 text-white shadow-lg"
            >
              <Plus className="h-4 w-4 mr-2" />
              Add Transaction
            </Button>
          </div>
        </div>
      </div>

      {/* Quick Actions */}
      <div className="mb-8">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <Card className="cursor-pointer hover:shadow-lg transition-shadow bg-gradient-to-r from-green-500 to-green-600 text-white">
            <CardContent className="p-4">
              <div className="flex items-center space-x-3">
                <div className="w-10 h-10 bg-white/20 rounded-lg flex items-center justify-center">
                  <Plus className="h-5 w-5" />
                </div>
                <div>
                  <p className="font-medium">Add Expense</p>
                  <p className="text-sm opacity-90">Quick entry</p>
                </div>
              </div>
            </CardContent>
          </Card>
          
          <Card className="cursor-pointer hover:shadow-lg transition-shadow bg-gradient-to-r from-blue-500 to-blue-600 text-white">
            <CardContent className="p-4">
              <div className="flex items-center space-x-3">
                <div className="w-10 h-10 bg-white/20 rounded-lg flex items-center justify-center">
                  <MessageCircle className="h-5 w-5" />
                </div>
                <div>
                  <p className="font-medium">AI Assistant</p>
                  <p className="text-sm opacity-90">Chat support</p>
                </div>
              </div>
            </CardContent>
          </Card>
          
          <Card className="cursor-pointer hover:shadow-lg transition-shadow bg-gradient-to-r from-purple-500 to-purple-600 text-white">
            <CardContent className="p-4">
              <div className="flex items-center space-x-3">
                <div className="w-10 h-10 bg-white/20 rounded-lg flex items-center justify-center">
                  <Target className="h-5 w-5" />
                </div>
                <div>
                  <p className="font-medium">Set Budget</p>
                  <p className="text-sm opacity-90">Monthly goals</p>
                </div>
              </div>
            </CardContent>
          </Card>
          
          <Card className="cursor-pointer hover:shadow-lg transition-shadow bg-gradient-to-r from-orange-500 to-orange-600 text-white">
            <CardContent className="p-4">
              <div className="flex items-center space-x-3">
                <div className="w-10 h-10 bg-white/20 rounded-lg flex items-center justify-center">
                  <Download className="h-5 w-5" />
                </div>
                <div>
                  <p className="font-medium">Export Data</p>
                  <p className="text-sm opacity-90">Download CSV</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="mb-8">
        <StatsCards data={analyticsData} showBalance={showBalance} />
      </div>

      {/* AI Insights */}
      <div className="mb-8">
        <Card className="bg-gradient-to-r from-green-600 to-blue-600 text-white">
          <CardHeader>
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-3">
                <div className="w-10 h-10 bg-white/20 rounded-lg flex items-center justify-center">
                  <Zap className="h-5 w-5" />
                </div>
                <div>
                  <CardTitle className="text-white">AI Financial Insights</CardTitle>
                  <CardDescription className="text-white/80">
                    Personalized recommendations based on your spending patterns
                  </CardDescription>
                </div>
              </div>
              <Badge className="bg-white/20 text-white border-white/20">
                New
              </Badge>
            </div>
          </CardHeader>
          <CardContent>
            <div className="grid md:grid-cols-2 gap-4">
              <div className="bg-white/10 rounded-lg p-4">
                <div className="flex items-center space-x-2 mb-2">
                  <TrendingUp className="h-4 w-4" />
                  <span className="font-medium">Spending Trend</span>
                </div>
                <p className="text-sm opacity-90">
                  You're spending 12% less on dining out this month compared to last month. Great job!
                </p>
              </div>
              <div className="bg-white/10 rounded-lg p-4">
                <div className="flex items-center space-x-2 mb-2">
                  <Target className="h-4 w-4" />
                  <span className="font-medium">Budget Alert</span>
                </div>
                <p className="text-sm opacity-90">
                  You're 75% through your monthly grocery budget. Consider meal planning to save more.
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Charts and Recent Transactions */}
      <div className="grid grid-cols-1 xl:grid-cols-2 gap-8 mb-8">
        <div className="space-y-8">
          <Card className="shadow-lg">
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle>Monthly Expenses</CardTitle>
                  <CardDescription>Your spending trend over the last 6 months</CardDescription>
                </div>
                <Button variant="outline" size="sm">
                  <Filter className="h-4 w-4 mr-2" />
                  Filter
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              <ExpenseChart data={(analyticsData as any)?.monthlyExpenses || []} />
            </CardContent>
          </Card>
          
          <Card className="shadow-lg">
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle>Spending by Category</CardTitle>
                  <CardDescription>Where your money goes this month</CardDescription>
                </div>
                <Button variant="outline" size="sm">
                  <Calendar className="h-4 w-4 mr-2" />
                  This Month
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              <CategoryChart data={(analyticsData as any)?.categoryExpenses || []} />
            </CardContent>
          </Card>
        </div>
        
        <div className="space-y-8">
          <Card className="shadow-lg">
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle>Recent Transactions</CardTitle>
                  <CardDescription>Your latest financial activities</CardDescription>
                </div>
                <Button variant="outline" size="sm">
                  View All
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              <RecentTransactions transactions={(recentTransactions as any[]) || []} />
            </CardContent>
          </Card>
          
          {/* Budget Progress */}
          <Card className="shadow-lg">
            <CardHeader>
              <CardTitle>Budget Progress</CardTitle>
              <CardDescription>How you're doing with your monthly budgets</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {(budgets as any[])?.slice(0, 3).map((budget: any) => (
                  <div key={budget.id} className="space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="font-medium">{budget.category?.name || 'Unknown'}</span>
                      <span className="text-sm text-gray-600">
                        ${budget.spent || 0} / ${budget.amount}
                      </span>
                    </div>
                    <div className="w-full bg-gray-200 rounded-full h-2">
                      <div 
                        className="bg-green-600 h-2 rounded-full transition-all duration-300"
                        style={{ width: `${Math.min((budget.spent || 0) / budget.amount * 100, 100)}%` }}
                      ></div>
                    </div>
                  </div>
                )) || (
                  <div className="text-center py-8 text-gray-500">
                    <Target className="h-12 w-12 mx-auto mb-4 opacity-50" />
                    <p>No budgets set yet</p>
                    <Button className="mt-4" size="sm">
                      Create Your First Budget
                    </Button>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Quick Stats */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
        <Card className="bg-gradient-to-r from-green-50 to-green-100 border-green-200">
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-green-700">This Month</p>
                <p className="text-2xl font-bold text-green-800">
                  {showBalance ? '$2,350' : '****'}
                </p>
                <p className="text-sm text-green-600">+12% from last month</p>
              </div>
              <div className="w-12 h-12 bg-green-600 rounded-full flex items-center justify-center">
                <TrendingUp className="h-6 w-6 text-white" />
              </div>
            </div>
          </CardContent>
        </Card>
        
        <Card className="bg-gradient-to-r from-blue-50 to-blue-100 border-blue-200">
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-blue-700">Transactions</p>
                <p className="text-2xl font-bold text-blue-800">47</p>
                <p className="text-sm text-blue-600">+3 this week</p>
              </div>
              <div className="w-12 h-12 bg-blue-600 rounded-full flex items-center justify-center">
                <Zap className="h-6 w-6 text-white" />
              </div>
            </div>
          </CardContent>
        </Card>
        
        <Card className="bg-gradient-to-r from-purple-50 to-purple-100 border-purple-200">
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-purple-700">Savings Rate</p>
                <p className="text-2xl font-bold text-purple-800">23%</p>
                <p className="text-sm text-purple-600">Above average</p>
              </div>
              <div className="w-12 h-12 bg-purple-600 rounded-full flex items-center justify-center">
                <Target className="h-6 w-6 text-white" />
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Modals */}
      <AddTransactionModal 
        isOpen={showAddTransaction} 
        onClose={() => setShowAddTransaction(false)} 
      />
      
      <WhatsAppChatModal 
        isOpen={showWhatsAppChat} 
        onClose={() => setShowWhatsAppChat(false)} 
      />
    </div>
  );
}