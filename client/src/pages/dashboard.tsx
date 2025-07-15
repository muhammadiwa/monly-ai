import React, { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";
import { formatCurrency } from "@/lib/currencyUtils";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { 
  TrendingUp,
  TrendingDown,
  Eye,
  EyeOff,
  Wallet,
  Sparkles,
  RefreshCw,
  Plus,
  Shield
} from "lucide-react";
import AddTransactionModal from "@/components/modals/add-transaction-modal";

// Real-time components
import PredictiveAnalytics from "@/components/dashboard/predictive-analytics";
import LiveCashFlow from "@/components/dashboard/live-cashflow";
import AIFinancialIntelligence from "@/components/dashboard/ai-financial-intelligence";

// Helper functions
const getFinancialScoreStyles = (score: number) => {
  if (score >= 80) return {
    bgClass: 'bg-gradient-to-br from-green-50 to-emerald-100',
    iconClass: 'text-green-600',
    textClass: 'text-green-700',
    labelClass: 'text-green-600',
    label: 'Excellent'
  };
  if (score >= 60) return {
    bgClass: 'bg-gradient-to-br from-blue-50 to-blue-100',
    iconClass: 'text-blue-600',
    textClass: 'text-blue-700',
    labelClass: 'text-blue-600',
    label: 'Good'
  };
  if (score >= 40) return {
    bgClass: 'bg-gradient-to-br from-yellow-50 to-amber-100',
    iconClass: 'text-yellow-600',
    textClass: 'text-yellow-700',
    labelClass: 'text-yellow-600',
    label: 'Fair'
  };
  return {
    bgClass: 'bg-gradient-to-br from-red-50 to-red-100',
    iconClass: 'text-red-600',
    textClass: 'text-red-700',
    labelClass: 'text-red-600',
    label: 'Poor'
  };
};

const getNetWorthChangeStyles = (percentage: number) => {
  const isPositive = percentage >= 0;
  return {
    textClass: isPositive ? 'text-green-600' : 'text-red-600',
    icon: isPositive ? TrendingUp : TrendingDown,
    sign: isPositive ? '+' : ''
  };
};

const getCashFlowStyles = (amount: number) => {
  const isPositive = amount >= 0;
  return {
    bgClass: isPositive ? 'bg-gradient-to-br from-green-50 to-emerald-100' : 'bg-gradient-to-br from-red-50 to-red-100',
    iconClass: isPositive ? 'text-green-600' : 'text-red-600',
    textClass: isPositive ? 'text-green-700' : 'text-red-700',
    icon: isPositive ? TrendingUp : TrendingDown
  };
};

const getSpendingStyles = (budgetUsed: number) => {
  if (budgetUsed >= 80) {
    return {
      bgClass: 'bg-gradient-to-br from-red-50 to-red-100',
      iconClass: 'text-red-600',
      textClass: 'text-red-700',
      progressClass: 'text-red-600'
    };
  } else if (budgetUsed >= 60) {
    return {
      bgClass: 'bg-gradient-to-br from-yellow-50 to-amber-100',
      iconClass: 'text-yellow-600',
      textClass: 'text-yellow-700',
      progressClass: 'text-yellow-600'
    };
  } else {
    return {
      bgClass: 'bg-gradient-to-br from-orange-50 to-amber-100',
      iconClass: 'text-orange-600',
      textClass: 'text-orange-700',
      progressClass: 'text-orange-600'
    };
  }
};

export default function Dashboard() {
  const { toast } = useToast();
  const { isAuthenticated, isLoading, user } = useAuth();
  const [showBalance, setShowBalance] = useState(true);
  const [showAddTransaction, setShowAddTransaction] = useState(false);

  // Real-time data fetching with intervals
  const { data: dashboardData, refetch: refetchDashboard } = useQuery({
    queryKey: ["/api/analytics/dashboard"],
    // refetchInterval: 5000, // Update every 5 seconds
    enabled: isAuthenticated && !isLoading,
  });

  const { data: aiInsights, refetch: refetchAI } = useQuery({
    queryKey: ["/api/ai/insights"],
    refetchInterval: 30000, // Update every 30 seconds
    enabled: isAuthenticated && !isLoading,
  });

  const { data: predictions } = useQuery({
    queryKey: ["/api/ai/predictions"],
    refetchInterval: 60000, // Update every minute
    enabled: isAuthenticated && !isLoading,
  });

  // Real data queries
  const { data: transactions } = useQuery({
    queryKey: ["/api/transactions"],
    enabled: isAuthenticated && !isLoading,
  });

  const { data: budgets } = useQuery({
    queryKey: ["/api/budgets"],
    enabled: isAuthenticated && !isLoading,
  });

  const { data: userPreferences } = useQuery({
    queryKey: ["/api/user/preferences"],
    enabled: isAuthenticated,
  });

  // Helper functions to reduce complexity
  const calculateFinancialScore = (savingsRate: number, monthlyIncome: number, monthlyExpenses: number) => {
    let score = 50; // Base score
    if (savingsRate >= 20) score += 30;
    else if (savingsRate >= 10) score += 20;
    else if (savingsRate >= 5) score += 10;
    
    if (monthlyIncome > 0) score += 10;
    if (monthlyExpenses > monthlyIncome) score -= 20;

    return Math.max(0, Math.min(100, score));
  };

  const calculateRiskLevel = (weeklyBudgetUsed: number) => {
    if (weeklyBudgetUsed > 80) return 'high';
    if (weeklyBudgetUsed > 60) return 'medium';
    return 'low';
  };

  const calculateInvestmentGrowth = (savingsRate: number) => {
    if (savingsRate > 15) return 8.5;
    if (savingsRate > 10) return 5.2;
    return 2.1;
  };

  const userCurrency = (userPreferences as any)?.defaultCurrency || 'IDR';

  // Calculate real financial data from dashboard API and transactions
  const financialData = useMemo(() => {
    // If we have dashboard data from API, use it as base
    if (dashboardData) {
      const data = dashboardData as any;
      
      // Calculate additional metrics from transactions if available
      let todaySpending = 0;
      let weeklyBudgetUsed = 0;
      let netWorthChange = 0;
      
      if (transactions && Array.isArray(transactions)) {
        const now = new Date();
        const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
        const startOfWeek = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
        
        // Calculate today's spending from transactions
        todaySpending = transactions
          .filter((t: any) => {
            const tDate = new Date(t.date * 1000); // Convert Unix timestamp to Date
            return tDate >= startOfToday && t.type === 'expense';
          })
          .reduce((sum: number, t: any) => sum + t.amount, 0);
        
        // Calculate weekly budget usage
        const weeklyBudgetLimit = budgets && Array.isArray(budgets) ? 
          budgets.reduce((sum: number, b: any) => sum + (b.amount / 4), 0) : 1000;
        const weeklySpending = transactions
          .filter((t: any) => {
            const tDate = new Date(t.date * 1000);
            return tDate >= startOfWeek && t.type === 'expense';
          })
          .reduce((sum: number, t: any) => sum + t.amount, 0);
        weeklyBudgetUsed = weeklyBudgetLimit > 0 ? 
          Math.round((weeklySpending / weeklyBudgetLimit) * 100) : 0;
      }
      
      // Calculate financial score based on real data
      const monthlyIncome = data.monthlyIncome || 0;
      const monthlyExpenses = data.monthlyExpenseTotal || 0;
      const savingsRate = parseFloat(data.savingsRate) || 0;
      const netWorth = data.totalBalance || 0; // Use actual total balance from database
      
      const financialScore = calculateFinancialScore(savingsRate, monthlyIncome, monthlyExpenses);
      
      // Estimate net worth change (simple calculation based on savings rate)
      netWorthChange = savingsRate > 0 ? Math.min(savingsRate * 0.5, 15) : -Math.abs(savingsRate * 0.3);
      
      return {
        financialScore,
        netWorth,
        monthlyIncome,
        monthlyExpenses,
        savingsRate,
        todaySpending,
        weeklyBudgetUsed,
        cashFlowTrend: netWorth > 0 ? 'positive' : 'negative',
        riskLevel: calculateRiskLevel(weeklyBudgetUsed),
        investmentGrowth: calculateInvestmentGrowth(savingsRate),
        goalProgress: Math.min(100, savingsRate * 3),
        netWorthChange: Math.round(netWorthChange * 10) / 10,
        isNetWorthPositive: netWorthChange >= 0
      };
    }
    
    // Fallback: if no dashboard data, calculate from transactions only
    if (!transactions || !Array.isArray(transactions)) {
      return {
        netWorth: 0,
        monthlyIncome: 0,
        monthlyExpenses: 0,
        savingsRate: 0,
        financialScore: 0,
        todaySpending: 0,
        weeklyBudgetUsed: 0,
        cashFlowTrend: 'neutral',
        riskLevel: 'medium',
        investmentGrowth: 0,
        goalProgress: 0,
        netWorthChange: 0,
        isNetWorthPositive: false
      };
    }

    const now = new Date();
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const startOfWeek = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);

    // Filter transactions for different periods
    const monthlyTransactions = transactions.filter((t: any) => {
      const tDate = new Date(t.date * 1000); // Convert Unix timestamp
      return tDate >= startOfMonth;
    });
    const todayTransactions = transactions.filter((t: any) => {
      const tDate = new Date(t.date * 1000);
      return tDate >= startOfToday;
    });
    const weeklyTransactions = transactions.filter((t: any) => {
      const tDate = new Date(t.date * 1000);
      return tDate >= startOfWeek;
    });

    // Get previous month transactions for comparison
    const lastMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    const endOfLastMonth = new Date(now.getFullYear(), now.getMonth(), 0);
    const lastMonthTransactions = transactions.filter((t: any) => {
      const tDate = new Date(t.date * 1000);
      return tDate >= lastMonth && tDate <= endOfLastMonth;
    });

    // Calculate income and expenses
    const monthlyIncome = monthlyTransactions
      .filter((t: any) => t.type === 'income')
      .reduce((sum: number, t: any) => sum + t.amount, 0);
    
    const monthlyExpenses = monthlyTransactions
      .filter((t: any) => t.type === 'expense')
      .reduce((sum: number, t: any) => sum + t.amount, 0);

    const todaySpending = todayTransactions
      .filter((t: any) => t.type === 'expense')
      .reduce((sum: number, t: any) => sum + t.amount, 0);

    // Calculate last month data for comparison
    const lastMonthIncome = lastMonthTransactions
      .filter((t: any) => t.type === 'income')
      .reduce((sum: number, t: any) => sum + t.amount, 0);
    
    const lastMonthExpenses = lastMonthTransactions
      .filter((t: any) => t.type === 'expense')
      .reduce((sum: number, t: any) => sum + t.amount, 0);

    const lastMonthNetWorth = lastMonthIncome - lastMonthExpenses;

    // Calculate savings rate
    const savingsRate = monthlyIncome > 0 ? 
      Math.round(((monthlyIncome - monthlyExpenses) / monthlyIncome) * 100) : 0;

    // Calculate financial score using helper function
    const financialScore = calculateFinancialScore(savingsRate, monthlyIncome, monthlyExpenses);

    // Calculate net worth (current month cash flow)
    const netWorth = monthlyIncome - monthlyExpenses;

    // Calculate net worth change percentage
    const netWorthChange = lastMonthNetWorth !== 0 ? 
      ((netWorth - lastMonthNetWorth) / Math.abs(lastMonthNetWorth)) * 100 : 0;

    // Calculate weekly budget usage
    const weeklyBudgetLimit = budgets && Array.isArray(budgets) ? 
      budgets.reduce((sum: number, b: any) => sum + (b.amount / 4), 0) : 1000;
    const weeklySpending = weeklyTransactions
      .filter((t: any) => t.type === 'expense')
      .reduce((sum: number, t: any) => sum + t.amount, 0);
    const weeklyBudgetUsed = weeklyBudgetLimit > 0 ? 
      Math.round((weeklySpending / weeklyBudgetLimit) * 100) : 0;

    return {
      netWorth,
      monthlyIncome,
      monthlyExpenses,
      monthlyCashFlow: monthlyIncome - monthlyExpenses, // Add monthly cash flow calculation
      savingsRate,
      financialScore,
      todaySpending,
      weeklyBudgetUsed,
      cashFlowTrend: monthlyIncome > monthlyExpenses ? 'positive' : 'negative',
      riskLevel: calculateRiskLevel(weeklyBudgetUsed),
      investmentGrowth: calculateInvestmentGrowth(savingsRate),
      goalProgress: Math.min(100, savingsRate * 3),
      netWorthChange: Math.round(netWorthChange * 10) / 10,
      isNetWorthPositive: netWorthChange >= 0
    };
  }, [dashboardData, transactions, budgets]);

  // Combine dashboard API data with local calculations
  const combinedData = useMemo(() => {
    const apiData = dashboardData as any;
    
    if (apiData) {
      // Use API data directly for all calculations - backend now handles everything
      const netWorthChange = apiData.changes?.incomeChange ? 
        parseFloat(apiData.changes.incomeChange) : 0;
      
      return {
        financialScore: apiData.financialScore || 0, // Backend calculated
        netWorth: apiData.totalBalance || 0, // Backend data
        monthlyIncome: apiData.monthlyIncome || 0, // Backend data
        monthlyExpenses: apiData.monthlyExpenseTotal || 0, // Backend data
        monthlyCashFlow: apiData.monthlyCashFlow || 0, // Backend calculated
        savingsRate: parseFloat(apiData.savingsRate) || 0, // Backend calculated
        todaySpending: apiData.todaySpending || 0, // Backend data
        weeklyBudgetUsed: apiData.weeklyBudgetUsed || 0, // Backend calculated
        cashFlowTrend: (apiData.monthlyCashFlow || 0) > 0 ? 'positive' : 'negative',
        riskLevel: calculateRiskLevel(apiData.weeklyBudgetUsed || 0),
        investmentGrowth: parseFloat(apiData.investmentGrowth) || 0,
        goalProgress: Math.min(100, (parseFloat(apiData.savingsRate) || 0) * 3),
        netWorthChange: Math.round(netWorthChange * 10) / 10,
        isNetWorthPositive: netWorthChange >= 0
      };
    }
    
    // Fallback: if no dashboard data, calculate from transactions only
    return financialData;
  }, [dashboardData, financialData]);

  // Type-safe data access
  const safeData = {
    financialScore: combinedData?.financialScore || 0,
    netWorth: combinedData?.netWorth || 0,
    monthlyIncome: combinedData?.monthlyIncome || 0,
    monthlyExpenses: combinedData?.monthlyExpenses || 0,
    monthlyCashFlow: combinedData?.monthlyCashFlow || 0, // Use backend calculated cash flow
    savingsRate: combinedData?.savingsRate || 0,
    todaySpending: combinedData?.todaySpending || 0,
    weeklyBudgetUsed: combinedData?.weeklyBudgetUsed || 0,
    cashFlowTrend: combinedData?.cashFlowTrend || 'neutral',
    riskLevel: combinedData?.riskLevel || 'medium',
    investmentGrowth: combinedData?.investmentGrowth || 0,
    goalProgress: combinedData?.goalProgress || 0,
    netWorthChange: combinedData?.netWorthChange || 0,
    isNetWorthPositive: combinedData?.isNetWorthPositive || false
  };

  const handleRefresh = () => {
    refetchDashboard();
    refetchAI();
    toast({
      title: "Data Updated",
      description: "Dashboard refreshed with latest information",
    });
  };

  if (!isAuthenticated && !isLoading) {
    window.location.href = "/auth";
    return null;
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  return (
    <div className="w-full max-w-none space-y-3 sm:space-y-4 lg:space-y-6 p-3 sm:p-4 lg:p-6">
      {/* Header with AI-powered greeting */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3 md:gap-4">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <h1 className="text-xl md:text-2xl lg:text-3xl font-bold bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent">
              Good {(() => {
                const hour = new Date().getHours();
                if (hour < 12) return 'Morning';
                if (hour < 17) return 'Afternoon';
                return 'Evening';
              })()}, {user?.firstName || 'User'}
            </h1>
            <Sparkles className="h-4 w-4 md:h-5 md:w-5 lg:h-6 lg:w-6 text-purple-500" />
          </div>
          <p className="text-sm md:text-base text-muted-foreground">
            Your financial intelligence at a glance • Updated {new Date().toLocaleTimeString()}
          </p>
        </div>
        
        <div className="flex flex-wrap items-center gap-2 md:gap-3">
          <Button
            variant="outline"
            size="sm"
            onClick={handleRefresh}
            className="gap-2 text-xs md:text-sm"
          >
            <RefreshCw className="h-3 w-3 md:h-4 md:w-4" />
            <span className="hidden sm:inline">Refresh</span>
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => setShowBalance(!showBalance)}
            className="gap-2 text-xs md:text-sm"
          >
            {showBalance ? <EyeOff className="h-3 w-3 md:h-4 md:w-4" /> : <Eye className="h-3 w-3 md:h-4 md:w-4" />}
            <span className="hidden sm:inline">{showBalance ? 'Hide' : 'Show'}</span>
          </Button>
          <Button
            onClick={() => setShowAddTransaction(true)}
            className="gap-2 bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 text-xs md:text-sm"
          >
            <Plus className="h-3 w-3 md:h-4 md:w-4" />
            Add Transaction
          </Button>
        </div>
      </div>

      {/* Financial Score & Quick Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4 lg:gap-6">
        {/* Financial Score */}
        <Card className="relative overflow-hidden">
          <div className={`absolute inset-0 ${getFinancialScoreStyles(safeData.financialScore).bgClass}`} />
          <CardHeader className="relative pb-2">
            <div className="flex items-center justify-between">
              <CardTitle className="text-sm font-medium text-gray-600">Financial Score</CardTitle>
              <Shield className={`h-4 w-4 ${getFinancialScoreStyles(safeData.financialScore).iconClass}`} />
            </div>
          </CardHeader>
          <CardContent className="relative">
            <div className="flex items-center gap-3">
              <div className={`text-3xl font-bold ${getFinancialScoreStyles(safeData.financialScore).textClass}`}>
                {safeData.financialScore}
              </div>
              <div className="flex-1">
                <Progress value={safeData.financialScore} className="h-2" />
                <p className={`text-xs mt-1 ${getFinancialScoreStyles(safeData.financialScore).labelClass}`}>
                  {getFinancialScoreStyles(safeData.financialScore).label}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Net Worth */}
        <Card className="relative overflow-hidden">
          <div className="absolute inset-0 bg-gradient-to-br from-blue-50 to-indigo-100" />
          <CardHeader className="relative pb-2">
            <div className="flex items-center justify-between">
              <CardTitle className="text-sm font-medium text-gray-600">Net Worth</CardTitle>
              <TrendingUp className="h-4 w-4 text-blue-600" />
            </div>
          </CardHeader>
          <CardContent className="relative">
            <div className="text-2xl font-bold text-blue-700">
              {showBalance ? formatCurrency(safeData.netWorth, userCurrency) : '••••••'}
            </div>
            <div className="flex items-center gap-1 mt-1">
              {React.createElement(getNetWorthChangeStyles(safeData.netWorthChange).icon, { 
                className: `h-3 w-3 ${getNetWorthChangeStyles(safeData.netWorthChange).textClass.replace('text-', 'text-')}`
              })}
              <span className={`text-xs ${getNetWorthChangeStyles(safeData.netWorthChange).textClass}`}>
                {getNetWorthChangeStyles(safeData.netWorthChange).sign}{Math.abs(safeData.netWorthChange)}% this month
              </span>
            </div>
          </CardContent>
        </Card>

        {/* Monthly Cash Flow */}
        <Card className="relative overflow-hidden">
          <div className={`absolute inset-0 ${getCashFlowStyles(safeData.monthlyCashFlow).bgClass}`} />
          <CardHeader className="relative pb-2">
            <div className="flex items-center justify-between">
              <CardTitle className="text-sm font-medium text-gray-600">Monthly Cash Flow</CardTitle>
              {React.createElement(getCashFlowStyles(safeData.monthlyCashFlow).icon, { 
                className: `h-4 w-4 ${getCashFlowStyles(safeData.monthlyCashFlow).iconClass}` 
              })}
            </div>
          </CardHeader>
          <CardContent className="relative">
            <div className={`text-2xl font-bold ${getCashFlowStyles(safeData.monthlyCashFlow).textClass}`}>
              {showBalance ? formatCurrency(safeData.monthlyCashFlow, userCurrency) : '••••••'}
            </div>
            <div className="flex items-center justify-between mt-1">
              <span className="text-xs text-gray-500">Savings Rate</span>
              <span className={`text-xs font-medium ${safeData.savingsRate >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                {safeData.savingsRate}%
              </span>
            </div>
          </CardContent>
        </Card>

        {/* Today's Spending */}
        <Card className="relative overflow-hidden">
          <div className={`absolute inset-0 ${getSpendingStyles(safeData.weeklyBudgetUsed).bgClass}`} />
          <CardHeader className="relative pb-2">
            <div className="flex items-center justify-between">
              <CardTitle className="text-sm font-medium text-gray-600">Today's Spending</CardTitle>
              <Wallet className={`h-4 w-4 ${getSpendingStyles(safeData.weeklyBudgetUsed).iconClass}`} />
            </div>
          </CardHeader>
          <CardContent className="relative">
            <div className={`text-2xl font-bold ${getSpendingStyles(safeData.weeklyBudgetUsed).textClass}`}>
              {showBalance ? formatCurrency(safeData.todaySpending, userCurrency) : '••••••'}
            </div>
            <div className="flex items-center gap-1 mt-1">
              <Progress value={safeData.weeklyBudgetUsed} className="flex-1 h-1" />
              <span className={`text-xs ${getSpendingStyles(safeData.weeklyBudgetUsed).progressClass}`}>
                {safeData.weeklyBudgetUsed}% of weekly budget
              </span>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Main Dashboard Grid */}
      <div className="grid grid-cols-1 xl:grid-cols-3 gap-3 sm:gap-4 lg:gap-6">
        {/* Left Column - AI Insights & Analytics */}
        <div className="lg:col-span-2 space-y-3 sm:space-y-4 lg:space-y-6">
          {/* AI Financial Intelligence */}
          <AIFinancialIntelligence 
            currency={userCurrency}
            showBalance={showBalance}
          />

          {/* Predictive Analytics */}
          <PredictiveAnalytics 
            predictions={predictions}
            currency={userCurrency}
            showBalance={showBalance}
          />
        </div>

        {/* Right Column - Live Data & Actions */}
        <div className="space-y-6">
          {/* Live Cash Flow */}
          <LiveCashFlow 
            data={safeData}
            currency={userCurrency}
            showBalance={showBalance}
          />
        </div>
      </div>

      {/* Add Transaction Modal */}
      <AddTransactionModal 
        isOpen={showAddTransaction}
        onClose={() => setShowAddTransaction(false)}
      />
    </div>
  );
}
