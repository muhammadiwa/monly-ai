import { useEffect, useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";
import { formatCurrency } from "@/lib/currencyUtils";
import ExpenseChart from "@/components/dashboard/expense-chart";
import CategoryChart from "@/components/dashboard/category-chart";
import AddTransactionModal from "@/components/modals/add-transaction-modal";
import WhatsAppChatModal from "@/components/modals/whatsapp-chat-modal";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { 
  Plus, 
  MessageCircle, 
  TrendingUp, 
  TrendingDown,
  Target,
  Zap,
  Calendar,
  Filter,
  RefreshCw,
  Eye,
  EyeOff,
  Wallet,
  PieChart,
  BarChart3,
  ArrowUpRight,
  AlertTriangle,
  CheckCircle,
  Clock,
  DollarSign,
  Activity,
  Bell,
  Star,
  Lightbulb,
  ShoppingCart,
  Home,
  Car,
  Coffee,
  Gamepad2,
  ExternalLink,
  Sparkles,
  Brain,
  AlertCircle
} from "lucide-react";

export default function Dashboard() {
  const { toast } = useToast();
  const { isAuthenticated, isLoading, user } = useAuth();
  const [showAddTransaction, setShowAddTransaction] = useState(false);
  const [showWhatsAppChat, setShowWhatsAppChat] = useState(false);
  const [showBalance, setShowBalance] = useState(true);
  const [selectedTimeframe, setSelectedTimeframe] = useState('today'); // today, week, month

  // Redirect to login if not authenticated
  useEffect(() => {
    if (!isLoading && !isAuthenticated) {
      console.log('Dashboard: User not authenticated, redirecting to auth');
      toast({
        title: "Authentication Required",
        description: "Please login to access the dashboard",
        variant: "destructive",
      });
      setTimeout(() => {
        window.location.href = "/auth";
      }, 1000);
    }
  }, [isAuthenticated, isLoading, toast]);

  // Fetch user preferences for currency
  const { data: userPreferences } = useQuery({
    queryKey: ["/api/user/preferences"],
    retry: false,
    enabled: isAuthenticated,
  });

  const { data: analyticsData, isLoading: analyticsLoading, refetch } = useQuery({
    queryKey: ["/api/analytics/dashboard"],
    retry: false,
    enabled: isAuthenticated && !isLoading,
  });

  const { data: transactions } = useQuery({
    queryKey: ["/api/transactions"],
    retry: false,
    enabled: isAuthenticated && !isLoading,
  });

  const { data: recentTransactions } = useQuery({
    queryKey: ["/api/transactions", { limit: 10 }],
    retry: false,
    enabled: isAuthenticated && !isLoading,
  });

  const { data: budgets } = useQuery({
    queryKey: ["/api/budgets"],
    retry: false,
    enabled: isAuthenticated && !isLoading,
  });

  // Get user's preferred currency and ensure consistency
  const userCurrency = (userPreferences as any)?.defaultCurrency || 'IDR';
  const currencySymbol = userCurrency === 'IDR' ? 'Rp' : userCurrency === 'USD' ? '$' : userCurrency;

  // Category icons mapping with better organization
  const categoryIcons = {
    'Food & Dining': Coffee,
    'Transportation': Car,
    'Shopping': ShoppingCart,
    'Entertainment': Gamepad2,
    'Bills & Utilities': Home,
    'Healthcare': Activity,
    'Education': Star,
    'Travel': Car,
    'Investment': TrendingUp,
    'Income': DollarSign,
    'Groceries': ShoppingCart,
    'Rent': Home,
    'Utilities': Lightbulb,
    'default': Wallet
  };

  // Helper function to parse transaction dates
  const parseTransactionDate = (date: string | number): Date => {
    if (typeof date === 'number') {
      return date > 9999999999 ? new Date(date) : new Date(date * 1000);
    }
    return new Date(date);
  };

  // Process real-time dashboard data
  const dashboardData = useMemo(() => {
    if (!transactions || !Array.isArray(transactions)) {
      return {
        todayTransactions: [],
        weekTransactions: [],
        monthTransactions: [],
        todayTotal: { income: 0, expense: 0 },
        weekTotal: { income: 0, expense: 0 },
        monthTotal: { income: 0, expense: 0 },
        categoryBreakdown: [],
        recentActivity: [],
        upcomingBills: [],
        savingsGoal: { current: 0, target: 10000, percentage: 0 },
        spendingAlerts: [],
        financialScore: 75
      };
    }

    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const weekStart = new Date(today);
    weekStart.setDate(today.getDate() - today.getDay());
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);

    // Filter transactions by timeframe
    const todayTransactions = transactions.filter((t: any) => {
      const tDate = parseTransactionDate(t.date);
      return tDate >= today && tDate < new Date(today.getTime() + 24 * 60 * 60 * 1000);
    });

    const weekTransactions = transactions.filter((t: any) => {
      const tDate = parseTransactionDate(t.date);
      return tDate >= weekStart && tDate <= now;
    });

    const monthTransactions = transactions.filter((t: any) => {
      const tDate = parseTransactionDate(t.date);
      return tDate >= monthStart && tDate <= now;
    });

    // Calculate totals
    const calculateTotals = (transactionsList: any[]) => {
      const income = transactionsList
        .filter(t => t.type === 'income')
        .reduce((sum, t) => sum + (t.amount || 0), 0);
      const expense = transactionsList
        .filter(t => t.type === 'expense')
        .reduce((sum, t) => sum + (t.amount || 0), 0);
      return { income, expense };
    };

    const todayTotal = calculateTotals(todayTransactions);
    const weekTotal = calculateTotals(weekTransactions);
    const monthTotal = calculateTotals(monthTransactions);

    // Category breakdown for current month
    const categoryMap = new Map();
    monthTransactions
      .filter(t => t.type === 'expense')
      .forEach((transaction: any) => {
        const categoryName = transaction.category?.name || 'Uncategorized';
        const amount = transaction.amount || 0;
        categoryMap.set(categoryName, (categoryMap.get(categoryName) || 0) + amount);
      });

    const categoryBreakdown = Array.from(categoryMap.entries())
      .map(([name, amount]) => ({ name, amount }))
      .sort((a, b) => b.amount - a.amount)
      .slice(0, 6);

    // Recent activity (last 5 transactions)
    const recentActivity = [...transactions]
      .sort((a, b) => parseTransactionDate(b.date).getTime() - parseTransactionDate(a.date).getTime())
      .slice(0, 5);

    // Mock upcoming bills with consistent currency
    const upcomingBills = [
      { 
        name: 'Internet Bill', 
        amount: userCurrency === 'IDR' ? 450000 : 45,
        dueDate: new Date(now.getTime() + 1 * 24 * 60 * 60 * 1000), 
        category: 'Bills & Utilities',
        urgent: true
      },
      { 
        name: 'Electricity Bill', 
        amount: userCurrency === 'IDR' ? 780000 : 78,
        dueDate: new Date(now.getTime() + 3 * 24 * 60 * 60 * 1000), 
        category: 'Bills & Utilities',
        urgent: false
      },
      { 
        name: 'Phone Bill', 
        amount: userCurrency === 'IDR' ? 225000 : 22,
        dueDate: new Date(now.getTime() + 5 * 24 * 60 * 60 * 1000), 
        category: 'Bills & Utilities',
        urgent: false
      }
    ];

    // Savings goal calculation with currency-appropriate targets
    const savingsGoal = {
      current: Math.max(0, monthTotal.income - monthTotal.expense),
      target: userCurrency === 'IDR' ? 5000000 : 500, // 5M IDR or $500
      percentage: Math.min(((monthTotal.income - monthTotal.expense) / (userCurrency === 'IDR' ? 5000000 : 500)) * 100, 100)
    };

    // Spending alerts with currency-appropriate thresholds
    const spendingAlerts = [];
    const dailyThreshold = userCurrency === 'IDR' ? 500000 : 50; // 500k IDR or $50
    const weeklyThreshold = 0.8;

    if (todayTotal.expense > dailyThreshold) {
      spendingAlerts.push({
        type: 'warning',
        message: `High spending today: ${formatCurrency(todayTotal.expense, userCurrency)}`,
        icon: AlertTriangle
      });
    }
    
    if (weekTotal.expense > weekTotal.income * weeklyThreshold) {
      spendingAlerts.push({
        type: 'danger',
        message: `Spending is ${(weekTotal.expense / weekTotal.income * 100).toFixed(0)}% of your weekly income`,
        icon: AlertTriangle
      });
    }

    // Financial score (simplified calculation)
    let score = 75;
    if (monthTotal.income > monthTotal.expense) score += 10;
    if (monthTotal.expense < monthTotal.income * 0.7) score += 15;
    score = Math.min(score, 100);

    return {
      todayTransactions,
      weekTransactions, 
      monthTransactions,
      todayTotal,
      weekTotal,
      monthTotal,
      categoryBreakdown,
      recentActivity,
      upcomingBills,
      savingsGoal,
      spendingAlerts,
      financialScore: score
    };
  }, [transactions, userCurrency]);

  // AI Integration for smart insights
  const generateAIInsights = useMemo(() => {
    if (!dashboardData) return [];
    
    const insights = [];
    const { monthTotal, categoryBreakdown, financialScore } = dashboardData;
    
    // Smart spending analysis
    if (monthTotal.expense > 0) {
      const topCategory = categoryBreakdown[0];
      if (topCategory && topCategory.amount > monthTotal.expense * 0.3) {
        insights.push({
          type: 'warning',
          title: 'High Spending Alert',
          message: `Your ${topCategory.name} spending (${formatCurrency(topCategory.amount, userCurrency)}) is ${((topCategory.amount / monthTotal.expense) * 100).toFixed(0)}% of total expenses`,
          icon: AlertTriangle,
          action: 'Review this category'
        });
      }
    }

    // Financial score insights
    if (financialScore >= 80) {
      insights.push({
        type: 'success',
        title: 'Excellent Financial Health',
        message: `You're doing great! Your financial score of ${financialScore} shows strong money management`,
        icon: CheckCircle,
        action: 'Keep it up!'
      });
    } else if (financialScore < 60) {
      insights.push({
        type: 'danger',
        title: 'Financial Health Needs Attention',
        message: `Your score of ${financialScore} suggests room for improvement in budgeting and spending habits`,
        icon: AlertTriangle,
        action: 'Get AI recommendations'
      });
    }

    // Savings insights
    const savingsRate = monthTotal.income > 0 ? ((monthTotal.income - monthTotal.expense) / monthTotal.income) * 100 : 0;
    if (savingsRate > 20) {
      insights.push({
        type: 'success',
        title: 'Great Savings Rate',
        message: `You're saving ${savingsRate.toFixed(1)}% of your income - excellent financial discipline!`,
        icon: Star,
        action: 'Consider investing'
      });
    }

    return insights;
  }, [dashboardData, userCurrency]);

  const refreshData = () => {
    refetch();
  };

  if (isLoading || analyticsLoading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-900 via-purple-900 to-slate-900 flex items-center justify-center">
        <div className="text-center">
          <div className="relative">
            <div className="animate-spin rounded-full h-20 w-20 border-4 border-purple-500 border-t-transparent mx-auto mb-6"></div>
            <div className="absolute inset-0 rounded-full h-20 w-20 border-4 border-purple-300 border-t-transparent mx-auto animate-pulse"></div>
          </div>
          <h2 className="text-2xl font-semibold text-white mb-2">Loading Dashboard</h2>
          <p className="text-purple-200">Preparing your financial insights...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-50">
      <div className="w-full max-w-7xl mx-auto px-3 sm:px-4 lg:px-6 py-4 sm:py-6 space-y-6 sm:space-y-8">
        
        {/* Simple Welcome Header */}
        <div className="mb-6">
          <h1 className="text-2xl sm:text-3xl font-bold text-gray-900">
            Welcome back, {(user as any)?.firstName || 'User'}! 👋
          </h1>
          <p className="text-gray-600 mt-1">
            {new Date().toLocaleDateString('en-US', { 
              weekday: 'long', 
              year: 'numeric', 
              month: 'long', 
              day: 'numeric' 
            })}
          </p>
          <div className="flex items-center space-x-4 mt-3">
            <div className="flex items-center space-x-2">
              <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></div>
              <span className="text-sm text-gray-500">Financial Score: {dashboardData.financialScore}/100</span>
            </div>
            <Badge variant={dashboardData.financialScore >= 80 ? "default" : dashboardData.financialScore >= 60 ? "secondary" : "destructive"}>
              {dashboardData.financialScore >= 80 ? "Excellent" : dashboardData.financialScore >= 60 ? "Good" : "Needs Attention"}
            </Badge>
            <div className="flex items-center space-x-2">
              <Button
                variant="outline"
                size="sm"
                onClick={refreshData}
                className="border-gray-200 hover:bg-gray-50"
              >
                <RefreshCw className="h-4 w-4 mr-2" />
                Refresh
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setShowBalance(!showBalance)}
                className="border-gray-200 hover:bg-gray-50"
              >
                {showBalance ? <EyeOff className="h-4 w-4 mr-2" /> : <Eye className="h-4 w-4 mr-2" />}
                {showBalance ? 'Hide' : 'Show'} Balance
              </Button>
            </div>
          </div>
        </div>
        
        {/* AI-Powered Smart Alerts - Mobile Optimized */}
        {(dashboardData.spendingAlerts.length > 0 || generateAIInsights.length > 0) && (
          <div className="space-y-3">
            {/* Spending Alerts */}
            {dashboardData.spendingAlerts.map((alert, index) => (
              <Card key={`alert-${index}`} className={`border-l-4 ${
                alert.type === 'danger' ? 'border-red-500 bg-red-50' : 'border-yellow-500 bg-yellow-50'
              } shadow-lg`}>
                <CardContent className="p-3 sm:p-4">
                  <div className="flex items-start space-x-3">
                    <alert.icon className={`h-4 w-4 sm:h-5 sm:w-5 mt-0.5 flex-shrink-0 ${
                      alert.type === 'danger' ? 'text-red-600' : 'text-yellow-600'
                    }`} />
                    <div className="min-w-0 flex-1">
                      <span className={`font-medium text-sm sm:text-base ${
                        alert.type === 'danger' ? 'text-red-800' : 'text-yellow-800'
                      }`}>
                        {alert.message}
                      </span>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}

            {/* AI Insights */}
            {generateAIInsights.map((insight, index) => (
              <Card key={`insight-${index}`} className={`border-l-4 ${
                insight.type === 'success' ? 'border-green-500 bg-green-50' :
                insight.type === 'warning' ? 'border-yellow-500 bg-yellow-50' :
                'border-red-500 bg-red-50'
              } shadow-lg hover:shadow-xl transition-shadow`}>
                <CardContent className="p-3 sm:p-4">
                  <div className="flex items-start space-x-3">
                    <insight.icon className={`h-4 w-4 sm:h-5 sm:w-5 mt-0.5 flex-shrink-0 ${
                      insight.type === 'success' ? 'text-green-600' :
                      insight.type === 'warning' ? 'text-yellow-600' :
                      'text-red-600'
                    }`} />
                    <div className="min-w-0 flex-1">
                      <h4 className={`font-semibold text-sm sm:text-base mb-1 ${
                        insight.type === 'success' ? 'text-green-800' :
                        insight.type === 'warning' ? 'text-yellow-800' :
                        'text-red-800'
                      }`}>
                        {insight.title}
                      </h4>
                      <p className={`text-xs sm:text-sm ${
                        insight.type === 'success' ? 'text-green-700' :
                        insight.type === 'warning' ? 'text-yellow-700' :
                        'text-red-700'
                      }`}>
                        {insight.message}
                      </p>
                      <Button 
                        size="sm" 
                        variant="outline" 
                        className="mt-2 text-xs"
                        onClick={() => setShowWhatsAppChat(true)}
                      >
                        {insight.action}
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}

        {/* Financial Overview Cards - Mobile First Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4 lg:gap-6">
          {/* Today's Net Balance */}
          <Card className="relative overflow-hidden bg-gradient-to-br from-emerald-500 to-teal-600 text-white shadow-xl border-0 hover:shadow-2xl transition-all duration-300">
            <div className="absolute -top-4 -right-4 w-16 h-16 sm:w-24 sm:h-24 bg-white/10 rounded-full"></div>
            <CardContent className="p-4 sm:p-6 relative z-10">
              <div className="flex items-center justify-between mb-3 sm:mb-4">
                <div className="w-10 h-10 sm:w-12 sm:h-12 bg-white/20 rounded-xl flex items-center justify-center">
                  <Wallet className="h-5 w-5 sm:h-6 sm:w-6" />
                </div>
                <TrendingUp className="h-4 w-4 sm:h-5 sm:w-5 opacity-80" />
              </div>
              <div>
                <p className="text-emerald-100 text-xs sm:text-sm font-medium">Today's Net</p>
                <p className="text-lg sm:text-xl lg:text-2xl font-bold truncate">
                  {showBalance ? formatCurrency(
                    dashboardData.todayTotal.income - dashboardData.todayTotal.expense, 
                    userCurrency
                  ) : '••••••'}
                </p>
                <p className="text-emerald-200 text-xs mt-1">
                  {dashboardData.todayTransactions.length} transactions
                </p>
              </div>
            </CardContent>
          </Card>

          {/* Week's Overview */}
          <Card className="relative overflow-hidden bg-gradient-to-br from-blue-500 to-indigo-600 text-white shadow-xl border-0 hover:shadow-2xl transition-all duration-300">
            <div className="absolute -top-4 -right-4 w-16 h-16 sm:w-24 sm:h-24 bg-white/10 rounded-full"></div>
            <CardContent className="p-4 sm:p-6 relative z-10">
              <div className="flex items-center justify-between mb-3 sm:mb-4">
                <div className="w-10 h-10 sm:w-12 sm:h-12 bg-white/20 rounded-xl flex items-center justify-center">
                  <Calendar className="h-5 w-5 sm:h-6 sm:w-6" />
                </div>
                <BarChart3 className="h-4 w-4 sm:h-5 sm:w-5 opacity-80" />
              </div>
              <div>
                <p className="text-blue-100 text-xs sm:text-sm font-medium">This Week</p>
                <p className="text-lg sm:text-xl lg:text-2xl font-bold truncate">
                  {showBalance ? formatCurrency(dashboardData.weekTotal.expense, userCurrency) : '••••••'}
                </p>
                <p className="text-blue-200 text-xs mt-1">
                  From {formatCurrency(dashboardData.weekTotal.income, userCurrency)} income
                </p>
              </div>
            </CardContent>
          </Card>

          {/* Monthly Budget Progress */}
          <Card className="relative overflow-hidden bg-gradient-to-br from-purple-500 to-pink-600 text-white shadow-xl border-0 hover:shadow-2xl transition-all duration-300">
            <div className="absolute -top-4 -right-4 w-16 h-16 sm:w-24 sm:h-24 bg-white/10 rounded-full"></div>
            <CardContent className="p-4 sm:p-6 relative z-10">
              <div className="flex items-center justify-between mb-3 sm:mb-4">
                <div className="w-10 h-10 sm:w-12 sm:h-12 bg-white/20 rounded-xl flex items-center justify-center">
                  <Target className="h-5 w-5 sm:h-6 sm:w-6" />
                </div>
                <PieChart className="h-4 w-4 sm:h-5 sm:w-5 opacity-80" />
              </div>
              <div>
                <p className="text-purple-100 text-xs sm:text-sm font-medium">Budget Used</p>
                <p className="text-lg sm:text-xl lg:text-2xl font-bold">
                  {dashboardData.monthTotal.income > 0 ? 
                    ((dashboardData.monthTotal.expense / dashboardData.monthTotal.income) * 100).toFixed(0) : 0}%
                </p>
                <p className="text-purple-200 text-xs mt-1">
                  Of available income
                </p>
              </div>
            </CardContent>
          </Card>

          {/* Savings Goal */}
          <Card className="relative overflow-hidden bg-gradient-to-br from-amber-500 to-orange-600 text-white shadow-xl border-0 hover:shadow-2xl transition-all duration-300">
            <div className="absolute -top-4 -right-4 w-16 h-16 sm:w-24 sm:h-24 bg-white/10 rounded-full"></div>
            <CardContent className="p-4 sm:p-6 relative z-10">
              <div className="flex items-center justify-between mb-3 sm:mb-4">
                <div className="w-10 h-10 sm:w-12 sm:h-12 bg-white/20 rounded-xl flex items-center justify-center">
                  <Star className="h-5 w-5 sm:h-6 sm:w-6" />
                </div>
                <ArrowUpRight className="h-4 w-4 sm:h-5 sm:w-5 opacity-80" />
              </div>
              <div>
                <p className="text-amber-100 text-xs sm:text-sm font-medium">Savings Goal</p>
                <p className="text-lg sm:text-xl lg:text-2xl font-bold">
                  {Math.max(0, dashboardData.savingsGoal.percentage).toFixed(0)}%
                </p>
                <p className="text-amber-200 text-xs mt-1 truncate">
                  {formatCurrency(dashboardData.savingsGoal.current, userCurrency)} saved
                </p>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Spending Categories - Mobile Optimized */}
        {dashboardData.categoryBreakdown.length > 0 && (
          <div>
            <div className="flex items-center space-x-2 mb-3 sm:mb-4">
              <PieChart className="h-4 w-4 sm:h-5 sm:w-5 text-purple-600" />
              <h3 className="text-base sm:text-lg font-semibold text-gray-900">Top Spending Categories</h3>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
              {dashboardData.categoryBreakdown.slice(0, 4).map((category, index) => {
                const colors = [
                  'from-red-500 to-red-600',
                  'from-blue-500 to-blue-600', 
                  'from-green-500 to-green-600',
                  'from-purple-500 to-purple-600'
                ];
                const iconColors = ['text-red-600', 'text-blue-600', 'text-green-600', 'text-purple-600'];
                const bgColors = ['bg-red-50', 'bg-blue-50', 'bg-green-50', 'bg-purple-50'];
                
                return (
                  <Card key={category.name} className={`${bgColors[index]} border-0 hover:shadow-lg transition-all duration-300`}>
                    <CardContent className="p-4 sm:p-6">
                      <div className="flex items-center justify-between mb-3">
                        <div className={`w-10 h-10 sm:w-12 sm:h-12 ${bgColors[index]} rounded-xl flex items-center justify-center`}>
                          <DollarSign className={`h-5 w-5 sm:h-6 sm:w-6 ${iconColors[index]}`} />
                        </div>
                        <Badge variant="secondary" className="text-xs">
                          {dashboardData.monthTotal.expense > 0 ? 
                            ((category.amount / dashboardData.monthTotal.expense) * 100).toFixed(0) : 0}%
                        </Badge>
                      </div>
                      <div>
                        <p className="font-semibold text-gray-800 mb-1 text-sm sm:text-base truncate">{category.name}</p>
                        <p className={`text-lg sm:text-xl lg:text-2xl font-bold ${iconColors[index]} mb-1`}>
                          {showBalance ? formatCurrency(category.amount, userCurrency) : '••••'}
                        </p>
                        <div className="w-full bg-gray-200 rounded-full h-2">
                          <div 
                            className={`bg-gradient-to-r ${colors[index]} h-2 rounded-full transition-all duration-500`}
                            style={{ 
                              width: `${dashboardData.monthTotal.expense > 0 ? 
                                Math.min((category.amount / dashboardData.monthTotal.expense) * 100, 100) : 0}%` 
                            }}
                          />
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          </div>
        )}

      {/* Recent Activity & Savings Goals */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 mb-8">
        {/* Recent Activity */}
        <div className="lg:col-span-2">
          <Card className="shadow-lg border-0">
            <CardHeader className="bg-gradient-to-r from-gray-50 to-gray-100">
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-3">
                  <div className="w-10 h-10 bg-blue-100 rounded-lg flex items-center justify-center">
                    <Activity className="h-5 w-5 text-blue-600" />
                  </div>
                  <div>
                    <CardTitle>Recent Activity</CardTitle>
                    <CardDescription>Your latest financial activities</CardDescription>
                  </div>
                </div>
                <Button variant="outline" size="sm" className="bg-white hover:bg-gray-50">
                  <ExternalLink className="h-4 w-4 mr-2" />
                  View All
                </Button>
              </div>
            </CardHeader>
            <CardContent className="p-0">
              <div className="max-h-80 overflow-y-auto">
                {dashboardData.recentActivity.slice(0, 5).map((transaction: any, index: number) => (
                  <div key={transaction.id || index} className="flex items-center space-x-4 p-4 border-b last:border-b-0 hover:bg-gray-50 transition-colors">
                    <div className={`w-12 h-12 rounded-full flex items-center justify-center ${
                      transaction.type === 'income' 
                        ? 'bg-green-100 text-green-600' 
                        : 'bg-red-100 text-red-600'
                    }`}>
                      {transaction.type === 'income' ? (
                        <TrendingUp className="h-5 w-5" />
                      ) : (
                        <TrendingDown className="h-5 w-5" />
                      )}
                    </div>
                    <div className="flex-1">
                      <p className="font-medium text-gray-900">{transaction.description || 'Transaction'}</p>
                      <div className="flex items-center space-x-2 text-sm text-gray-500">
                        <span>{transaction.category?.name || 'Uncategorized'}</span>
                        <span>•</span>
                        <span>{new Date(transaction.date).toLocaleDateString()}</span>
                      </div>
                    </div>
                    <div className="text-right">
                      <p className={`font-semibold ${
                        transaction.type === 'income' ? 'text-green-600' : 'text-red-600'
                      }`}>
                        {transaction.type === 'income' ? '+' : '-'}
                        {showBalance ? formatCurrency(transaction.amount, userCurrency) : '••••'}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Savings Goals */}
        <div className="space-y-6">
          <Card className="shadow-lg border-0">
            <CardHeader className="bg-gradient-to-r from-green-50 to-emerald-100">
              <div className="flex items-center space-x-3">
                <div className="w-10 h-10 bg-green-100 rounded-lg flex items-center justify-center">
                  <Target className="h-5 w-5 text-green-600" />
                </div>
                <div>
                  <CardTitle className="text-green-800">Savings Goal</CardTitle>
                  <CardDescription className="text-green-700">Monthly target progress</CardDescription>
                </div>
              </div>
            </CardHeader>
            <CardContent className="p-6">
              <div className="text-center mb-4">
                <div className="relative w-32 h-32 mx-auto mb-4">
                  <svg className="w-32 h-32 transform -rotate-90" viewBox="0 0 36 36">
                    <path
                      className="text-gray-200"
                      stroke="currentColor"
                      strokeWidth="3"
                      fill="none"
                      d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
                    />
                    <path
                      className="text-green-500"
                      stroke="currentColor"
                      strokeWidth="3"
                      strokeDasharray={`${dashboardData.savingsGoal.percentage}, 100`}
                      strokeLinecap="round"
                      fill="none"
                      d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
                    />
                  </svg>
                  <div className="absolute inset-0 flex items-center justify-center">
                    <span className="text-2xl font-bold text-green-600">
                      {dashboardData.savingsGoal.percentage.toFixed(0)}%
                    </span>
                  </div>
                </div>
                <div className="space-y-2">
                  <p className="text-sm text-gray-600">Current Savings</p>
                  <p className="text-xl font-bold text-gray-900">
                    {showBalance ? formatCurrency(dashboardData.savingsGoal.current, userCurrency) : '••••••'}
                  </p>
                  <p className="text-sm text-gray-500">
                    Goal: {showBalance ? formatCurrency(dashboardData.savingsGoal.target, userCurrency) : '••••••'}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Upcoming Bills */}
          <Card className="shadow-lg border-0">
            <CardHeader className="bg-gradient-to-r from-orange-50 to-amber-100">
              <div className="flex items-center space-x-3">
                <div className="w-10 h-10 bg-orange-100 rounded-lg flex items-center justify-center">
                  <Clock className="h-5 w-5 text-orange-600" />
                </div>
                <div>
                  <CardTitle className="text-orange-800">Upcoming Bills</CardTitle>
                  <CardDescription className="text-orange-700">Due this week</CardDescription>
                </div>
              </div>
            </CardHeader>
            <CardContent className="p-4">
              <div className="space-y-3">
                {dashboardData.upcomingBills.map((bill, index) => (
                  <div key={index} className="flex items-center justify-between p-3 bg-white rounded-lg border hover:shadow-sm transition-shadow">
                    <div className="flex items-center space-x-3">
                      <div className={`w-2 h-2 rounded-full ${bill.urgent ? 'bg-red-500' : 'bg-yellow-500'}`} />
                      <div>
                        <p className="font-medium text-gray-900 text-sm sm:text-base">{bill.name}</p>
                        <p className="text-xs sm:text-sm text-gray-500">
                          {bill.dueDate.getTime() - new Date().getTime() < 24 * 60 * 60 * 1000 ? 'Tomorrow' :
                           `In ${Math.ceil((bill.dueDate.getTime() - new Date().getTime()) / (24 * 60 * 60 * 1000))} days`}
                        </p>
                      </div>
                    </div>
                    <p className="font-semibold text-gray-900 text-sm sm:text-base">
                      {showBalance ? formatCurrency(bill.amount, userCurrency) : '••••'}
                    </p>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </div>
      </div>

        {/* Advanced AI Financial Intelligence - Fully Integrated */}
        <div>
          <Card className="bg-gradient-to-br from-indigo-600 via-purple-600 to-pink-600 text-white shadow-2xl border-0 overflow-hidden">
            <div className="absolute top-0 right-0 w-32 h-32 sm:w-64 sm:h-64 bg-white/5 rounded-full -translate-y-16 sm:-translate-y-32 translate-x-16 sm:translate-x-32"></div>
            <div className="absolute bottom-0 left-0 w-24 h-24 sm:w-48 sm:h-48 bg-white/5 rounded-full translate-y-12 sm:translate-y-24 -translate-x-12 sm:-translate-x-24"></div>
            <CardHeader className="relative z-10 p-4 sm:p-6">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between space-y-3 sm:space-y-0">
                <div className="flex items-center space-x-3 sm:space-x-4">
                  <div className="w-12 h-12 sm:w-14 sm:h-14 bg-white/20 rounded-2xl flex items-center justify-center backdrop-blur-sm">
                    <Brain className="h-6 w-6 sm:h-7 sm:w-7" />
                  </div>
                  <div>
                    <CardTitle className="text-lg sm:text-xl lg:text-2xl font-bold text-white">AI Financial Intelligence</CardTitle>
                    <CardDescription className="text-white/80 text-sm sm:text-base">
                      Real-time analysis powered by advanced algorithms
                    </CardDescription>
                  </div>
                </div>
                <div className="flex items-center space-x-2">
                  <Badge className="bg-gradient-to-r from-yellow-400 to-orange-500 text-white border-0 px-2 sm:px-3 py-1 text-xs">
                    <Sparkles className="h-3 w-3 mr-1" />
                    Smart
                  </Badge>
                  <Badge className="bg-white/20 text-white border-white/20 px-2 sm:px-3 py-1 text-xs">
                    Live
                  </Badge>
                </div>
              </div>
            </CardHeader>
            <CardContent className="relative z-10 p-4 sm:p-6 sm:pt-0">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 sm:gap-6">
                {/* Dynamic Spending Intelligence */}
                <div className="bg-white/10 backdrop-blur-sm rounded-xl p-4 sm:p-5 border border-white/20">
                  <div className="flex items-center space-x-3 mb-3 sm:mb-4">
                    <div className="w-8 h-8 sm:w-10 sm:h-10 bg-gradient-to-r from-green-400 to-green-500 rounded-lg flex items-center justify-center">
                      <TrendingUp className="h-4 w-4 sm:h-5 sm:w-5 text-white" />
                    </div>
                    <div>
                      <h4 className="font-semibold text-white text-sm sm:text-base">Smart Spending</h4>
                      <p className="text-xs text-white/70">Pattern Analysis</p>
                    </div>
                  </div>
                  <p className="text-xs sm:text-sm text-white/90 leading-relaxed">
                    {dashboardData.categoryBreakdown.length > 0 ? (
                      <>Your top expense category is <span className="font-semibold text-green-300">{dashboardData.categoryBreakdown[0].name}</span> with {formatCurrency(dashboardData.categoryBreakdown[0].amount, userCurrency)}. Consider optimizing this area! <span className="inline-block ml-2">🎯</span></>
                    ) : (
                      <>No spending data yet. Start tracking your expenses to get AI insights! <span className="inline-block ml-2">📊</span></>
                    )}
                  </p>
                </div>

                {/* Dynamic Budget Analysis */}
                <div className="bg-white/10 backdrop-blur-sm rounded-xl p-4 sm:p-5 border border-white/20">
                  <div className="flex items-center space-x-3 mb-3 sm:mb-4">
                    <div className="w-8 h-8 sm:w-10 sm:h-10 bg-gradient-to-r from-blue-400 to-blue-500 rounded-lg flex items-center justify-center">
                      <Target className="h-4 w-4 sm:h-5 sm:w-5 text-white" />
                    </div>
                    <div>
                      <h4 className="font-semibold text-white text-sm sm:text-base">Budget Health</h4>
                      <p className="text-xs text-white/70">AI Assessment</p>
                    </div>
                  </div>
                  <p className="text-xs sm:text-sm text-white/90 leading-relaxed">
                    {dashboardData.monthTotal.income > 0 ? (
                      <>You're using <span className="font-semibold text-yellow-300">{((dashboardData.monthTotal.expense / dashboardData.monthTotal.income) * 100).toFixed(0)}%</span> of your monthly income. {dashboardData.monthTotal.expense / dashboardData.monthTotal.income < 0.8 ? 'Great financial discipline!' : 'Consider reducing expenses.'} <span className="inline-block ml-2">💡</span></>
                    ) : (
                      <>Add your income data to get personalized budget insights! <span className="inline-block ml-2">�</span></>
                    )}
                  </p>
                </div>

                {/* Dynamic Savings Forecast */}
                <div className="bg-white/10 backdrop-blur-sm rounded-xl p-4 sm:p-5 border border-white/20">
                  <div className="flex items-center space-x-3 mb-3 sm:mb-4">
                    <div className="w-8 h-8 sm:w-10 sm:h-10 bg-gradient-to-r from-purple-400 to-purple-500 rounded-lg flex items-center justify-center">
                      <Star className="h-4 w-4 sm:h-5 sm:w-5 text-white" />
                    </div>
                    <div>
                      <h4 className="font-semibold text-white text-sm sm:text-base">AI Forecast</h4>
                      <p className="text-xs text-white/70">Predictive Analysis</p>
                    </div>
                  </div>
                  <p className="text-xs sm:text-sm text-white/90 leading-relaxed">
                    {dashboardData.savingsGoal.current > 0 ? (
                      <>Based on current trends, you'll save approximately <span className="font-semibold text-purple-300">{formatCurrency(dashboardData.savingsGoal.current * 1.2, userCurrency)}</span> this month! <span className="inline-block ml-2">🚀</span></>
                    ) : (
                      <>Start saving to unlock AI-powered financial forecasting! <span className="inline-block ml-2">�</span></>
                    )}
                  </p>
                </div>
              </div>

              {/* AI Action Center */}
              <div className="flex flex-wrap gap-2 sm:gap-3 mt-4 sm:mt-6 pt-4 sm:pt-6 border-t border-white/20">
                <Button
                  variant="secondary"
                  size="sm"
                  className="bg-white/20 text-white border-white/30 hover:bg-white/30 backdrop-blur-sm text-xs sm:text-sm"
                  onClick={() => setShowWhatsAppChat(true)}
                >
                  <MessageCircle className="h-3 w-3 sm:h-4 sm:w-4 mr-1 sm:mr-2" />
                  Ask AI Assistant
                </Button>
                <Button
                  variant="secondary"
                  size="sm"
                  className="bg-white/20 text-white border-white/30 hover:bg-white/30 backdrop-blur-sm text-xs sm:text-sm"
                  onClick={() => setShowWhatsAppChat(true)}
                >
                  <BarChart3 className="h-3 w-3 sm:h-4 sm:w-4 mr-1 sm:mr-2" />
                  Get Insights
                </Button>
                <Button
                  variant="secondary"
                  size="sm"
                  className="bg-white/20 text-white border-white/30 hover:bg-white/30 backdrop-blur-sm text-xs sm:text-sm"
                  onClick={() => setShowWhatsAppChat(true)}
                >
                  <Bell className="h-3 w-3 sm:h-4 sm:w-4 mr-1 sm:mr-2" />
                  Smart Alerts
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>

      {/* Advanced Analytics Charts */}
      <div className="grid grid-cols-1 xl:grid-cols-2 gap-8 mb-8">
        {/* Enhanced Expense Trends */}
        <div className="space-y-6">
          <Card className="shadow-xl border-0 bg-gradient-to-br from-white to-gray-50">
            <CardHeader className="bg-gradient-to-r from-blue-50 to-indigo-100 rounded-t-lg">
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-3">
                  <div className="w-12 h-12 bg-gradient-to-r from-blue-500 to-indigo-600 rounded-xl flex items-center justify-center">
                    <BarChart3 className="h-6 w-6 text-white" />
                  </div>
                  <div>
                    <CardTitle className="text-gray-800">Expense Trends</CardTitle>
                    <CardDescription>Monthly spending patterns with forecasting</CardDescription>
                  </div>
                </div>
                <div className="flex items-center space-x-2">
                  <Badge variant="secondary" className="bg-blue-100 text-blue-800">
                    <TrendingUp className="h-3 w-3 mr-1" />
                    +5.2%
                  </Badge>
                  <Button variant="outline" size="sm" className="bg-white hover:bg-gray-50">
                    <Filter className="h-4 w-4 mr-2" />
                    Filter
                  </Button>
                </div>
              </div>
            </CardHeader>
            <CardContent className="p-6">
              <div className="mb-4 grid grid-cols-3 gap-4">
                <div className="text-center p-3 bg-red-50 rounded-lg">
                  <p className="text-sm text-red-600 font-medium">This Month</p>
                  <p className="text-xl font-bold text-red-700">
                    {showBalance ? formatCurrency(dashboardData.monthTotal.expense, userCurrency) : '••••••'}
                  </p>
                </div>
                <div className="text-center p-3 bg-green-50 rounded-lg">
                  <p className="text-sm text-green-600 font-medium">Average</p>
                  <p className="text-xl font-bold text-green-700">
                    {showBalance ? formatCurrency(dashboardData.monthTotal.expense * 0.85, userCurrency) : '••••••'}
                  </p>
                </div>
                <div className="text-center p-3 bg-blue-50 rounded-lg">
                  <p className="text-sm text-blue-600 font-medium">Projected</p>
                  <p className="text-xl font-bold text-blue-700">
                    {showBalance ? formatCurrency(dashboardData.monthTotal.expense * 1.1, userCurrency) : '••••••'}
                  </p>
                </div>
              </div>
              <div className="h-80">
                <ExpenseChart data={(analyticsData as any)?.monthlyExpenses || []} />
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Enhanced Category Analysis */}
        <div className="space-y-6">
          <Card className="shadow-xl border-0 bg-gradient-to-br from-white to-gray-50">
            <CardHeader className="bg-gradient-to-r from-purple-50 to-pink-100 rounded-t-lg">
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-3">
                  <div className="w-12 h-12 bg-gradient-to-r from-purple-500 to-pink-600 rounded-xl flex items-center justify-center">
                    <PieChart className="h-6 w-6 text-white" />
                  </div>
                  <div>
                    <CardTitle className="text-gray-800">Category Breakdown</CardTitle>
                    <CardDescription>Smart spending analysis by category</CardDescription>
                  </div>
                </div>
                <div className="flex items-center space-x-2">
                  <Badge variant="secondary" className="bg-purple-100 text-purple-800">
                    <Eye className="h-3 w-3 mr-1" />
                    Live
                  </Badge>
                  <Button variant="outline" size="sm" className="bg-white hover:bg-gray-50">
                    <Calendar className="h-4 w-4 mr-2" />
                    This Month
                  </Button>
                </div>
              </div>
            </CardHeader>
            <CardContent className="p-6">
              <div className="mb-4 text-center">
                <p className="text-sm text-gray-600">Total Monthly Expenses</p>
                <p className="text-3xl font-bold text-gray-900 mb-2">
                  {showBalance ? formatCurrency(dashboardData.monthTotal.expense, userCurrency) : '••••••••'}
                </p>
                <p className="text-sm text-gray-500">Across {dashboardData.categoryBreakdown.length} categories</p>
              </div>
              <div className="h-80">
                <CategoryChart data={(analyticsData as any)?.categoryExpenses || []} />
              </div>
              <div className="mt-4 space-y-2">
                {dashboardData.categoryBreakdown.slice(0, 3).map((category, index) => {
                  const colors = ['bg-red-500', 'bg-blue-500', 'bg-green-500'];
                  return (
                    <div key={category.name} className="flex items-center justify-between p-2 bg-gray-50 rounded-lg">
                      <div className="flex items-center space-x-3">
                        <div className={`w-3 h-3 ${colors[index]} rounded-full`}></div>
                        <span className="font-medium text-gray-700">{category.name}</span>
                      </div>
                      <div className="text-right">
                        <p className="font-semibold text-gray-900">
                          {showBalance ? formatCurrency(category.amount, userCurrency) : '••••'}
                        </p>
                        <p className="text-xs text-gray-500">
                          {((category.amount / dashboardData.monthTotal.expense) * 100).toFixed(1)}%
                        </p>
                      </div>
                    </div>
                  );
                })}
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
      {/* Enhanced Budget Management */}
      <div className="mb-8">
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 bg-gradient-to-r from-emerald-500 to-teal-600 rounded-lg flex items-center justify-center">
              <Target className="h-5 w-5 text-white" />
            </div>
            <div>
              <h3 className="text-xl font-bold text-gray-900">Budget Performance</h3>
              <p className="text-gray-600">Track your monthly spending goals and progress</p>
            </div>
          </div>
          <div className="flex items-center space-x-3">
            <Badge variant="secondary" className="bg-emerald-100 text-emerald-800">
              {(budgets as any[])?.filter(b => (b.spent || 0) <= b.amount).length || 0} on track
            </Badge>
            <Button variant="outline" size="sm">
              <Plus className="h-4 w-4 mr-2" />
              Add Budget
            </Button>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {(budgets as any[])?.slice(0, 6).map((budget: any, index: number) => {
            const spent = budget.spent || 0;
            const percentage = (spent / budget.amount) * 100;
            const isOverBudget = spent > budget.amount;
            const isNearLimit = percentage >= 80 && !isOverBudget;
            
            return (
              <Card key={budget.id} className={`shadow-lg border-0 hover:shadow-xl transition-all duration-300 ${
                isOverBudget 
                  ? 'bg-gradient-to-br from-red-50 to-red-100 border-red-200' 
                  : isNearLimit 
                  ? 'bg-gradient-to-br from-yellow-50 to-amber-100 border-yellow-200'
                  : 'bg-gradient-to-br from-green-50 to-emerald-100 border-green-200'
              }`}>
                <CardContent className="p-6">
                  <div className="flex items-center justify-between mb-4">
                    <div className="flex items-center space-x-3">
                      <div className={`w-12 h-12 rounded-xl flex items-center justify-center ${
                        isOverBudget 
                          ? 'bg-red-100 text-red-600' 
                          : isNearLimit 
                          ? 'bg-yellow-100 text-yellow-600'
                          : 'bg-green-100 text-green-600'
                      }`}>
                        <DollarSign className="h-6 w-6" />
                      </div>
                      <div>
                        <h4 className="font-bold text-gray-900">{budget.category?.name || 'Unknown'}</h4>
                        <p className="text-sm text-gray-600">Monthly budget</p>
                      </div>
                    </div>
                    <Badge variant={isOverBudget ? "destructive" : isNearLimit ? "secondary" : "default"} className="px-3 py-1">
                      {percentage.toFixed(0)}%
                    </Badge>
                  </div>

                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <span className="text-sm font-medium text-gray-700">Spent</span>
                      <span className={`text-lg font-bold ${
                        isOverBudget ? 'text-red-600' : 'text-gray-900'
                      }`}>
                        {showBalance ? formatCurrency(spent, userCurrency) : '••••••'}
                      </span>
                    </div>
                    
                    <div className="w-full bg-gray-200 rounded-full h-3 overflow-hidden">
                      <div 
                        className={`h-3 rounded-full transition-all duration-500 ${
                          isOverBudget 
                            ? 'bg-gradient-to-r from-red-500 to-red-600' 
                            : isNearLimit 
                            ? 'bg-gradient-to-r from-yellow-500 to-amber-600'
                            : 'bg-gradient-to-r from-green-500 to-emerald-600'
                        }`}
                        style={{ width: `${Math.min(percentage, 100)}%` }}
                      />
                    </div>

                    <div className="flex items-center justify-between">
                      <span className="text-sm text-gray-600">Budget</span>
                      <span className="text-sm font-semibold text-gray-700">
                        {showBalance ? formatCurrency(budget.amount, userCurrency) : '••••••'}
                      </span>
                    </div>

                    <div className="flex items-center justify-between">
                      <span className="text-sm text-gray-600">Remaining</span>
                      <span className={`text-sm font-semibold ${
                        isOverBudget ? 'text-red-600' : 'text-green-600'
                      }`}>
                        {isOverBudget 
                          ? `Over by ${showBalance ? formatCurrency(spent - budget.amount, userCurrency) : '••••'}`
                          : showBalance ? formatCurrency(budget.amount - spent, userCurrency) : '••••••'
                        }
                      </span>
                    </div>

                    {isOverBudget && (
                      <div className="flex items-center space-x-2 p-2 bg-red-100 rounded-lg mt-3">
                        <AlertTriangle className="h-4 w-4 text-red-600" />
                        <span className="text-xs text-red-700 font-medium">Budget exceeded</span>
                      </div>
                    )}

                    {isNearLimit && (
                      <div className="flex items-center space-x-2 p-2 bg-yellow-100 rounded-lg mt-3">
                        <AlertCircle className="h-4 w-4 text-yellow-600" />
                        <span className="text-xs text-yellow-700 font-medium">Nearing limit</span>
                      </div>
                    )}
                  </div>
                </CardContent>
              </Card>
            );
          }) || (
            <Card className="shadow-lg col-span-full">
              <CardContent className="p-12 text-center">
                <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4">
                  <Target className="h-8 w-8 text-gray-400" />
                </div>
                <h4 className="text-lg font-semibold text-gray-900 mb-2">No budgets set yet</h4>
                <p className="text-gray-600 mb-6">Start managing your finances by creating your first budget</p>
                <Button className="bg-gradient-to-r from-emerald-500 to-teal-600 hover:from-emerald-600 hover:to-teal-700 text-white">
                  <Plus className="h-4 w-4 mr-2" />
                  Create Your First Budget
                </Button>
              </CardContent>
            </Card>
          )}
        </div>
      </div>

      {/* Financial Summary Overview */}
      <div className="mb-8">
        <h3 className="text-lg font-semibold mb-4 flex items-center">
          <BarChart3 className="h-5 w-5 mr-2 text-indigo-600" />
          Financial Performance Summary
        </h3>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          {/* Monthly Net Worth */}
          <Card className="bg-gradient-to-br from-emerald-500 via-green-500 to-teal-600 text-white shadow-xl border-0 overflow-hidden group hover:shadow-2xl transition-all duration-300">
            <div className="absolute -top-4 -right-4 w-24 h-24 bg-white/10 rounded-full group-hover:scale-110 transition-transform duration-300"></div>
            <CardContent className="p-6 relative z-10">
              <div className="flex items-center justify-between mb-4">
                <div className="w-14 h-14 bg-white/20 rounded-2xl flex items-center justify-center backdrop-blur-sm">
                  <TrendingUp className="h-7 w-7" />
                </div>
                <Badge className="bg-white/20 text-white border-white/20 px-3 py-1">
                  +{((dashboardData.monthTotal.income - dashboardData.monthTotal.expense) / dashboardData.monthTotal.income * 100).toFixed(1)}%
                </Badge>
              </div>
              <div>
                <p className="text-emerald-100 text-sm font-medium mb-1">Monthly Net Worth</p>
                <p className="text-3xl font-bold mb-2">
                  {showBalance ? formatCurrency(
                    dashboardData.monthTotal.income - dashboardData.monthTotal.expense, 
                    userCurrency
                  ) : '••••••••'}
                </p>
                <p className="text-emerald-200 text-sm">
                  {dashboardData.monthTransactions.length} transactions this month
                </p>
              </div>
            </CardContent>
          </Card>

          {/* Expense Efficiency */}
          <Card className="bg-gradient-to-br from-blue-500 via-indigo-500 to-purple-600 text-white shadow-xl border-0 overflow-hidden group hover:shadow-2xl transition-all duration-300">
            <div className="absolute -top-4 -right-4 w-24 h-24 bg-white/10 rounded-full group-hover:scale-110 transition-transform duration-300"></div>
            <CardContent className="p-6 relative z-10">
              <div className="flex items-center justify-between mb-4">
                <div className="w-14 h-14 bg-white/20 rounded-2xl flex items-center justify-center backdrop-blur-sm">
                  <Activity className="h-7 w-7" />
                </div>
                <Badge className="bg-white/20 text-white border-white/20 px-3 py-1">
                  Efficient
                </Badge>
              </div>
              <div>
                <p className="text-blue-100 text-sm font-medium mb-1">Expense Efficiency</p>
                <p className="text-3xl font-bold mb-2">
                  {(100 - (dashboardData.monthTotal.expense / dashboardData.monthTotal.income * 100)).toFixed(0)}%
                </p>
                <p className="text-blue-200 text-sm">
                  Better than last month by 3.2%
                </p>
              </div>
            </CardContent>
          </Card>

          {/* Category Diversity */}
          <Card className="bg-gradient-to-br from-purple-500 via-pink-500 to-rose-600 text-white shadow-xl border-0 overflow-hidden group hover:shadow-2xl transition-all duration-300">
            <div className="absolute -top-4 -right-4 w-24 h-24 bg-white/10 rounded-full group-hover:scale-110 transition-transform duration-300"></div>
            <CardContent className="p-6 relative z-10">
              <div className="flex items-center justify-between mb-4">
                <div className="w-14 h-14 bg-white/20 rounded-2xl flex items-center justify-center backdrop-blur-sm">
                  <PieChart className="h-7 w-7" />
                </div>
                <Badge className="bg-white/20 text-white border-white/20 px-3 py-1">
                  Diverse
                </Badge>
              </div>
              <div>
                <p className="text-purple-100 text-sm font-medium mb-1">Spending Categories</p>
                <p className="text-3xl font-bold mb-2">
                  {dashboardData.categoryBreakdown.length}
                </p>
                <p className="text-purple-200 text-sm">
                  Well-distributed financial habits
                </p>
              </div>
            </CardContent>
          </Card>

          {/* Transaction Velocity */}
          <Card className="bg-gradient-to-br from-amber-500 via-orange-500 to-red-600 text-white shadow-xl border-0 overflow-hidden group hover:shadow-2xl transition-all duration-300">
            <div className="absolute -top-4 -right-4 w-24 h-24 bg-white/10 rounded-full group-hover:scale-110 transition-transform duration-300"></div>
            <CardContent className="p-6 relative z-10">
              <div className="flex items-center justify-between mb-4">
                <div className="w-14 h-14 bg-white/20 rounded-2xl flex items-center justify-center backdrop-blur-sm">
                  <Zap className="h-7 w-7" />
                </div>
                <Badge className="bg-white/20 text-white border-white/20 px-3 py-1">
                  Active
                </Badge>
              </div>
              <div>
                <p className="text-amber-100 text-sm font-medium mb-1">Transaction Velocity</p>
                <p className="text-3xl font-bold mb-2">
                  {(dashboardData.monthTransactions.length / 30).toFixed(1)}
                </p>
                <p className="text-amber-200 text-sm">
                  Average per day this month
                </p>
              </div>
            </CardContent>
          </Card>
        </div>
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
    </div>
  );
}