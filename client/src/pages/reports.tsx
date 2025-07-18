import { useState, useEffect, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";
import { formatCurrency, getUserCurrency } from "@/lib/currencyUtils";
import { DateRangePicker } from "@/components/ui/date-picker";
import { format } from "date-fns";
import { DateRange } from "react-day-picker";

import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { 
  Download, 
  TrendingUp, 
  TrendingDown, 
  BarChart3, 
  PieChart,
  Target,
  ArrowUpRight,
  ArrowDownRight,
  Activity,
  CreditCard,
  Wallet,
  FileText,
  AlertTriangle
} from "lucide-react";
import { Bar, BarChart, ResponsiveContainer, XAxis, YAxis, Tooltip, Legend, Cell, Area, AreaChart } from "recharts";

export default function Reports() {
  const { toast } = useToast();
  const { isAuthenticated, isLoading } = useAuth();
  const [selectedPeriod, setSelectedPeriod] = useState("monthly");
  const [dateRange, setDateRange] = useState<DateRange | undefined>(undefined);

  // Colors for charts - Updated with more vibrant and modern colors
  const CHART_COLORS = [
    '#8B5CF6', '#06B6D4', '#10B981', '#F59E0B', '#EF4444', 
    '#8B5A2B', '#EC4899', '#6366F1', '#84CC16', '#F97316',
    '#14B8A6', '#F43F5E', '#8B5CF6', '#3B82F6', '#EAB308'
  ];

  // Redirect to login if not authenticated
  useEffect(() => {
    if (!isLoading && !isAuthenticated) {
      toast({
        title: "Authentication Required",
        description: "Please log in to access reports.",
        variant: "destructive",
      });
      setTimeout(() => {
        window.location.href = "/auth";
      }, 500);
    }
  }, [isAuthenticated, isLoading, toast]);

  // Fetch user preferences for currency
  const { data: userPreferences } = useQuery({
    queryKey: ["/api/user/preferences"],
    retry: false,
    enabled: isAuthenticated,
  });

  // Fetch analytics data
  const { data: analyticsData, isLoading: analyticsLoading } = useQuery({
    queryKey: ["/api/analytics/dashboard"],
    retry: false,
    enabled: isAuthenticated,
  });

  // Keep analytics data for potential future use
  const _ = analyticsData;

  // Fetch transactions for detailed analysis
  const { data: transactions } = useQuery({
    queryKey: ["/api/transactions"],
    retry: false,
    enabled: isAuthenticated,
  });

  // Fetch budgets data
  const { data: budgets } = useQuery({
    queryKey: ["/api/budgets"],
    retry: false,
    enabled: isAuthenticated,
  });

  // Get user's preferred currency using utility function
  const userCurrency = getUserCurrency(userPreferences);

  // Helper function to parse transaction dates
  const parseTransactionDate = (date: string | number): Date => {
    if (typeof date === 'number') {
      return date > 9999999999 ? new Date(date) : new Date(date * 1000);
    }
    return new Date(date);
  };

  // Process transactions for various analytics
  const processedData = useMemo(() => {
    if (!transactions || !Array.isArray(transactions)) {
      return {
        monthlyTrends: [],
        categoryBreakdown: [],
        weeklySpending: [],
        topExpenses: [],
        incomeVsExpenses: { income: 0, expenses: 0 },
        savingsRate: 0,
        totalTransactions: 0
      };
    }

    const now = new Date();
    let startDate = new Date(now.getFullYear(), now.getMonth(), 1);
    let endDate = new Date(now.getFullYear(), now.getMonth() + 1, 0);
    
    // Apply date range filter if selected
    if (dateRange?.from && dateRange?.to) {
      startDate = dateRange.from;
      endDate = dateRange.to;
    }

    // Filter transactions based on selected date range
    const filteredTransactions = transactions.filter((transaction: any) => {
      const transactionDate = parseTransactionDate(transaction.date);
      return transactionDate >= startDate && transactionDate <= endDate;
    });

    // Calculate income vs expenses
    const incomeTransactions = filteredTransactions.filter((t: any) => t.type === 'income');
    const expenseTransactions = filteredTransactions.filter((t: any) => t.type === 'expense');
    
    const totalIncome = incomeTransactions.reduce((sum: number, t: any) => sum + (t.amount || 0), 0);
    const totalExpenses = expenseTransactions.reduce((sum: number, t: any) => sum + (t.amount || 0), 0);
    
    const savingsRate = totalIncome > 0 ? ((totalIncome - totalExpenses) / totalIncome) * 100 : 0;

    // Category breakdown
    const categoryMap = new Map();
    expenseTransactions.forEach((transaction: any) => {
      const categoryName = transaction.category?.name || 'Uncategorized';
      const categoryColor = transaction.category?.color || '#6B7280';
      const amount = transaction.amount || 0;
      
      if (categoryMap.has(categoryName)) {
        categoryMap.set(categoryName, {
          ...categoryMap.get(categoryName),
          total: categoryMap.get(categoryName).total + amount
        });
      } else {
        categoryMap.set(categoryName, {
          categoryName,
          categoryColor,
          total: amount
        });
      }
    });

    const categoryBreakdown = Array.from(categoryMap.values())
      .sort((a, b) => b.total - a.total)
      .slice(0, 10);

    // Monthly trends (last 6 months)
    const monthlyTrends = [];
    const currentDate = new Date();
    for (let i = 5; i >= 0; i--) {
      const date = new Date(currentDate.getFullYear(), currentDate.getMonth() - i, 1);
      const monthTransactions = transactions.filter((transaction: any) => {
        const transactionDate = parseTransactionDate(transaction.date);
        return transactionDate.getMonth() === date.getMonth() && 
               transactionDate.getFullYear() === date.getFullYear();
      });

      const monthIncome = monthTransactions
        .filter((t: any) => t.type === 'income')
        .reduce((sum: number, t: any) => sum + (t.amount || 0), 0);
      
      const monthExpenses = monthTransactions
        .filter((t: any) => t.type === 'expense')
        .reduce((sum: number, t: any) => sum + (t.amount || 0), 0);

      monthlyTrends.push({
        month: date.toLocaleDateString('en-US', { month: 'short', year: 'numeric' }),
        income: monthIncome,
        expenses: monthExpenses,
        net: monthIncome - monthExpenses
      });
    }    // Weekly spending for current month
    const weeklySpending = [];
    const monthStart = new Date(currentDate.getFullYear(), currentDate.getMonth(), 1);
    
    for (let week = 0; week < 4; week++) {
      const weekStart = new Date(monthStart);
      weekStart.setDate(monthStart.getDate() + (week * 7));
      const weekEnd = new Date(weekStart);
      weekEnd.setDate(weekStart.getDate() + 6);

      const weekTransactions = expenseTransactions.filter((transaction: any) => {
        const transactionDate = parseTransactionDate(transaction.date);
        return transactionDate >= weekStart && transactionDate <= weekEnd;
      });

      const weekTotal = weekTransactions.reduce((sum: number, t: any) => sum + (t.amount || 0), 0);
      
      weeklySpending.push({
        week: `Week ${week + 1}`,
        amount: weekTotal,
        transactions: weekTransactions.length
      });
    }

    // Top expenses
    const sortedExpenses = [...expenseTransactions];
    sortedExpenses.sort((a: any, b: any) => (b.amount || 0) - (a.amount || 0));
    const topExpenses = sortedExpenses
      .slice(0, 5)
      .map((transaction: any) => ({
        id: transaction.id,
        description: transaction.description || 'No description',
        amount: transaction.amount || 0,
        category: transaction.category?.name || 'Uncategorized',
        date: parseTransactionDate(transaction.date)
      }));      return {
        monthlyTrends,
        categoryBreakdown,
        weeklySpending,
        topExpenses,
        incomeVsExpenses: { income: totalIncome, expenses: totalExpenses },
        savingsRate,
        totalTransactions: filteredTransactions.length
      };
  }, [transactions, dateRange]);

  // Calculate budget progress for current month only
  const budgetProgress = useMemo(() => {
    if (!budgets || !Array.isArray(budgets) || !transactions) return [];

    const currentDate = new Date();
    const currentMonth = currentDate.getMonth();
    const currentYear = currentDate.getFullYear();

    console.log('Budget calculation for:', {
      month: currentMonth + 1, // +1 for human readable
      year: currentYear,
      budgetsCount: budgets.length,
      transactionsCount: Array.isArray(transactions) ? transactions.length : 0
    });

    return budgets.map((budget: any) => {
      // Filter transactions for current month only
      const budgetTransactions = (transactions as any[]).filter((transaction: any) => {
        const transactionDate = parseTransactionDate(transaction.date);
        const isCurrentMonth = transactionDate.getMonth() === currentMonth &&
                              transactionDate.getFullYear() === currentYear;
        const isSameCategory = transaction.categoryId === budget.categoryId;
        const isExpense = transaction.type === 'expense';
        
        return isSameCategory && isExpense && isCurrentMonth;
      });

      const spent = budgetTransactions.reduce((sum: number, t: any) => sum + (t.amount || 0), 0);
      const percentage = budget.amount > 0 ? (spent / budget.amount) * 100 : 0;
      
      // Determine status based on spending percentage
      let status = 'good';
      if (percentage > 100) {
        status = 'over';
      } else if (percentage > 80) {
        status = 'warning';
      }

      console.log(`Budget ${budget.category?.name}:`, {
        budgetAmount: budget.amount,
        spent,
        percentage: percentage.toFixed(1),
        transactions: budgetTransactions.length,
        status
      });
      
      return {
        ...budget,
        spent,
        percentage: Math.min(percentage, 100),
        remaining: Math.max(budget.amount - spent, 0),
        status,
        currentMonthTransactions: budgetTransactions.length // Add transaction count for debugging
      };
    });
  }, [budgets, transactions]);

  if (isLoading || analyticsLoading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-16 w-16 border-4 border-primary border-t-transparent mx-auto mb-6"></div>
          <h2 className="text-2xl font-semibold text-gray-900 mb-2">Loading Reports</h2>
          <p className="text-gray-600">Analyzing your financial data...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100">
      <div className="px-3 sm:px-4 lg:px-6 w-full max-w-[100vw] overflow-x-hidden">
        {/* Modern Header */}
        <div className="mb-2 sm:mb-1">
          <div className="flex flex-col gap-2 sm:gap-1 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h1 className="text-2xl sm:text-3xl font-bold bg-gradient-to-r from-gray-900 to-gray-600 bg-clip-text text-transparent">
                Financial Reports
              </h1>
              <p className="mt-0.5 text-sm sm:text-lg text-gray-600">
                Comprehensive insights into your financial health
              </p>
            </div>
            <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2 sm:gap-3 mt-3 sm:mt-0">
              <Select value={selectedPeriod} onValueChange={setSelectedPeriod}>
                <SelectTrigger className="w-full sm:w-40 bg-white shadow-sm border-gray-200 h-9 sm:h-10">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="weekly">Weekly</SelectItem>
                  <SelectItem value="monthly">Monthly</SelectItem>
                  <SelectItem value="quarterly">Quarterly</SelectItem>
                  <SelectItem value="yearly">Yearly</SelectItem>
                </SelectContent>
              </Select>
              <DateRangePicker
                dateRange={dateRange}
                onDateRangeChange={setDateRange}
                placeholder="Select date range"
                className="w-full sm:w-64 bg-white shadow-sm border-gray-200"
                presets={true}
              />
              <Button 
                className="bg-gradient-to-r from-blue-600 to-blue-700 hover:from-blue-700 hover:to-blue-800 shadow-lg w-full sm:w-auto"
                onClick={() => {
                  // Export functionality
                  const exportData = {
                    period: selectedPeriod,
                    dateRange: dateRange ? {
                      from: dateRange.from ? format(dateRange.from, 'yyyy-MM-dd') : null,
                      to: dateRange.to ? format(dateRange.to, 'yyyy-MM-dd') : null
                    } : null,
                    data: processedData
                  };
                  
                  console.log('Exporting data:', exportData);
                  
                  const dateRangeText = dateRange?.from && dateRange?.to 
                    ? `from ${format(dateRange.from, 'MMM dd')} to ${format(dateRange.to, 'MMM dd, yyyy')}`
                    : '';
                  
                  toast({
                    title: "Export Started",
                    description: `Exporting ${selectedPeriod} report ${dateRangeText}.`,
                  });
                }}
              >
                <Download className="w-4 h-4 mr-2" />
                Export
              </Button>
            </div>
          </div>
        </div>

        {/* Enhanced Summary Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4 mb-4 sm:mb-3">
          {/* Net Income Card */}
          <Card className="bg-gradient-to-br from-green-50 to-emerald-50 border-green-200 shadow-lg hover:shadow-xl transition-all duration-300">
            <CardContent className="p-4 sm:p-5">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs sm:text-sm font-medium text-green-700">Net Income</p>
                  <p className="text-lg sm:text-xl md:text-2xl font-bold text-green-800 mt-1">
                    {formatCurrency(processedData.incomeVsExpenses.income - processedData.incomeVsExpenses.expenses, userCurrency)}
                  </p>
                </div>
                <div className="w-10 h-10 sm:w-12 sm:h-12 bg-green-600 rounded-xl flex items-center justify-center shadow-lg">
                  <TrendingUp className="h-5 w-5 sm:h-6 sm:w-6 text-white" />
                </div>
              </div>
              <div className="mt-3 sm:mt-4 flex items-center">
                <ArrowUpRight className="h-3 w-3 sm:h-4 sm:w-4 text-green-600 mr-1" />
                <span className="text-xs sm:text-sm text-green-600 font-medium">+{processedData.savingsRate.toFixed(1)}%</span>
                <span className="text-xs sm:text-sm text-gray-600 ml-1">savings rate</span>
              </div>
            </CardContent>
          </Card>

          {/* Total Expenses Card */}
          <Card className="bg-gradient-to-br from-red-50 to-rose-50 border-red-200 shadow-lg hover:shadow-xl transition-all duration-300">
            <CardContent className="p-4 sm:p-5">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs sm:text-sm font-medium text-red-700">Total Expenses</p>
                  <p className="text-lg sm:text-xl md:text-2xl font-bold text-red-800 mt-1">
                    {formatCurrency(processedData.incomeVsExpenses.expenses, userCurrency)}
                  </p>
                </div>
                <div className="w-10 h-10 sm:w-12 sm:h-12 bg-red-600 rounded-xl flex items-center justify-center shadow-lg">
                  <TrendingDown className="h-5 w-5 sm:h-6 sm:w-6 text-white" />
                </div>
              </div>
              <div className="mt-3 sm:mt-4 flex items-center">
                <ArrowDownRight className="h-3 w-3 sm:h-4 sm:w-4 text-red-600 mr-1" />
                <span className="text-xs sm:text-sm text-red-600 font-medium">
                  {processedData.incomeVsExpenses.expenses > 0 ? '+' : ''}5.1%
                </span>
                <span className="text-xs sm:text-sm text-gray-600 ml-1">vs last month</span>
              </div>
            </CardContent>
          </Card>

          {/* Average Daily Spend Card */}
          <Card className="bg-gradient-to-br from-blue-50 to-indigo-50 border-blue-200 shadow-lg hover:shadow-xl transition-all duration-300">
            <CardContent className="p-4 sm:p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs sm:text-sm font-medium text-blue-700">Avg. Daily Spend</p>
                  <p className="text-xl sm:text-2xl font-bold text-blue-800">
                    {formatCurrency(processedData.incomeVsExpenses.expenses / 30, userCurrency)}
                  </p>
                </div>
                <div className="w-10 h-10 sm:w-12 sm:h-12 bg-blue-600 rounded-xl flex items-center justify-center shadow-lg">
                  <Activity className="h-5 w-5 sm:h-6 sm:w-6 text-white" />
                </div>
              </div>
              <div className="mt-3 sm:mt-4 flex items-center">
                <ArrowDownRight className="h-3 w-3 sm:h-4 sm:w-4 text-blue-600 mr-1" />
                <span className="text-xs sm:text-sm text-blue-600 font-medium">-2.3%</span>
                <span className="text-xs sm:text-sm text-gray-600 ml-1">vs last month</span>
              </div>
            </CardContent>
          </Card>

          {/* Transaction Count Card */}
          <Card className="bg-gradient-to-br from-purple-50 to-violet-50 border-purple-200 shadow-lg hover:shadow-xl transition-all duration-300">
            <CardContent className="p-4 sm:p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs sm:text-sm font-medium text-purple-700">Transactions</p>
                  <p className="text-xl sm:text-2xl font-bold text-purple-800">
                    {processedData.totalTransactions}
                  </p>
                </div>
                <div className="w-10 h-10 sm:w-12 sm:h-12 bg-purple-600 rounded-xl flex items-center justify-center shadow-lg">
                  <CreditCard className="h-5 w-5 sm:h-6 sm:w-6 text-white" />
                </div>
              </div>
              <div className="mt-3 sm:mt-4 flex items-center">
                <ArrowUpRight className="h-3 w-3 sm:h-4 sm:w-4 text-purple-600 mr-1" />
                <span className="text-xs sm:text-sm text-purple-600 font-medium">+8.2%</span>
                <span className="text-xs sm:text-sm text-gray-600 ml-1">vs last month</span>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Main Content with Tabs */}
        <Tabs defaultValue="overview" className="space-y-4 sm:space-y-3">
          <TabsList className="grid w-full grid-cols-4 bg-white shadow-sm border border-gray-200 p-0.5">
            <TabsTrigger value="overview" className="flex items-center justify-center space-x-1 text-xs sm:text-sm py-1.5 sm:py-2">
              <BarChart3 className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
              <span className="hidden sm:inline">Overview</span>
              <span className="sm:hidden ml-0">O</span>
            </TabsTrigger>
            <TabsTrigger value="trends" className="flex items-center justify-center space-x-1 text-xs sm:text-sm py-1.5 sm:py-2">
              <TrendingUp className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
              <span className="hidden sm:inline">Trends</span>
              <span className="sm:hidden ml-0">T</span>
            </TabsTrigger>
            <TabsTrigger value="categories" className="flex items-center justify-center space-x-1 text-xs sm:text-sm py-1.5 sm:py-2">
              <PieChart className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
              <span className="hidden sm:inline">Categories</span>
              <span className="sm:hidden ml-0">C</span>
            </TabsTrigger>
            <TabsTrigger value="budgets" className="flex items-center justify-center space-x-1 text-xs sm:text-sm py-1.5 sm:py-2">
              <Target className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
              <span className="hidden sm:inline">Budgets</span>
              <span className="sm:hidden ml-0">B</span>
            </TabsTrigger>
          </TabsList>

          {/* Overview Tab */}
          <TabsContent value="overview" className="space-y-5 sm:space-y-6">
            <div className="grid grid-cols-1 xl:grid-cols-2 gap-5 sm:gap-6">
              {/* Income vs Expenses Chart */}
              <Card className="shadow-lg border-0 bg-white overflow-hidden">
                <CardHeader className="pb-1 sm:pb-3 px-3 sm:px-6 pt-3 sm:pt-6">
                  <CardTitle className="text-base sm:text-lg md:text-xl font-semibold text-gray-900">Income vs Expenses</CardTitle>
                  <CardDescription className="text-xs sm:text-sm">Monthly comparison over the last 6 months</CardDescription>
                </CardHeader>
                <CardContent className="px-2 sm:px-6 pb-4 sm:pb-6">
                  <div className="h-52 sm:h-60 md:h-80">
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={processedData.monthlyTrends} margin={{ top: 20, right: 30, left: 20, bottom: 5 }}>
                        <XAxis 
                          dataKey="month" 
                          axisLine={false}
                          tickLine={false}
                          tick={{ fontSize: 11, fill: '#6B7280' }}
                        />
                        <YAxis 
                          axisLine={false}
                          tickLine={false}
                          tick={{ fontSize: 11, fill: '#6B7280' }}
                          tickFormatter={(value) => {
                            // Format currency with symbol on the left
                            if (userCurrency === 'IDR') {
                              return `Rp${(value / 1000000).toFixed(1)}M`;
                            }
                            return `$${(value / 1000).toFixed(0)}K`;
                          }}
                        />
                        <Tooltip 
                          contentStyle={{
                            backgroundColor: 'white',
                            border: '1px solid #E5E7EB',
                            borderRadius: '8px',
                            boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)',
                            fontSize: '14px'
                          }}
                          formatter={(value: number, name: string) => {
                            // name sudah dalam format yang benar dari Bar chart (Income/Expenses)
                            return [formatCurrency(value, userCurrency), name];
                          }}
                          labelStyle={{ color: '#374151', fontWeight: 'bold' }}
                        />
                        <Legend />
                        <Bar dataKey="income" fill="#10B981" name="Income" radius={[4, 4, 0, 0]} />
                        <Bar dataKey="expenses" fill="#EF4444" name="Expenses" radius={[4, 4, 0, 0]} />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                </CardContent>
              </Card>

              {/* Weekly Spending Pattern */}
              <Card className="shadow-lg border-0 bg-white overflow-hidden">
                <CardHeader className="pb-1 sm:pb-3 px-3 sm:px-6 pt-3 sm:pt-6">
                  <CardTitle className="text-base sm:text-lg md:text-xl font-semibold text-gray-900">Weekly Spending Pattern</CardTitle>
                  <CardDescription className="text-xs sm:text-sm">Your spending distribution this month</CardDescription>
                </CardHeader>
                <CardContent className="px-2 sm:px-6 pb-4 sm:pb-6">
                  <div className="h-52 sm:h-60 md:h-80">
                    <ResponsiveContainer width="100%" height="100%">
                      <AreaChart data={processedData.weeklySpending} margin={{ top: 20, right: 30, left: 20, bottom: 5 }}>
                        <XAxis 
                          dataKey="week" 
                          axisLine={false}
                          tickLine={false}
                          tick={{ fontSize: 11, fill: '#6B7280' }}
                        />
                        <YAxis 
                          axisLine={false}
                          tickLine={false}
                          tick={{ fontSize: 11, fill: '#6B7280' }}
                          tickFormatter={(value) => {
                            if (userCurrency === 'IDR') {
                              return `Rp${(value / 1000000).toFixed(1)}M`;
                            }
                            return `$${(value / 1000).toFixed(0)}K`;
                          }}
                        />
                        <Tooltip 
                          contentStyle={{
                            backgroundColor: 'white',
                            border: '1px solid #E5E7EB',
                            borderRadius: '8px',
                            boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)',
                            fontSize: '14px'
                          }}
                          formatter={(value: number) => [formatCurrency(value, userCurrency), 'Amount']}
                          labelStyle={{ color: '#374151', fontWeight: 'bold' }}
                        />
                        <Area 
                          type="monotone" 
                          dataKey="amount" 
                          stroke="#8B5CF6" 
                          fill="url(#colorAmount)" 
                          strokeWidth={3}
                        />
                        <defs>
                          <linearGradient id="colorAmount" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="5%" stopColor="#8B5CF6" stopOpacity={0.3}/>
                            <stop offset="95%" stopColor="#8B5CF6" stopOpacity={0}/>
                          </linearGradient>
                        </defs>
                      </AreaChart>
                    </ResponsiveContainer>
                  </div>
                </CardContent>
              </Card>
            </div>

            {/* Top Expenses */}
            <Card className="shadow-lg border-0 bg-white overflow-hidden">
              <CardHeader className="pb-2 sm:pb-3 px-3 sm:px-6 pt-3 sm:pt-6">
                <CardTitle className="text-base sm:text-lg md:text-xl font-semibold text-gray-900">Top Expenses This Month</CardTitle>
                <CardDescription className="text-xs sm:text-sm">Your largest transactions</CardDescription>
              </CardHeader>
              <CardContent className="px-3 sm:px-6 pb-4 sm:pb-6">
                <div className="space-y-2 sm:space-y-3">
                  {processedData.topExpenses.length > 0 ? (
                    processedData.topExpenses.map((expense, index) => (
                      <div key={expense.id} className="flex items-center justify-between p-2.5 sm:p-4 rounded-lg bg-gray-50 hover:bg-gray-100 transition-colors">
                        <div className="flex items-center space-x-2 sm:space-x-4">
                          <div className="w-7 h-7 sm:w-10 sm:h-10 bg-gradient-to-br from-gray-200 to-gray-300 rounded-lg flex items-center justify-center">
                            <span className="text-xs sm:text-sm font-bold text-gray-700">#{index + 1}</span>
                          </div>
                          <div>
                            <p className="font-medium text-gray-900 text-xs sm:text-base truncate max-w-[150px] sm:max-w-none">{expense.description}</p>
                            <p className="text-xs text-gray-600">{expense.category}</p>
                          </div>
                        </div>
                        <div className="text-right ml-2">
                          <p className="font-semibold text-gray-900 text-xs sm:text-base">
                            {formatCurrency(expense.amount, userCurrency)}
                          </p>
                          <p className="text-xs text-gray-600">
                            {expense.date.toLocaleDateString()}
                          </p>
                        </div>
                      </div>
                    ))
                  ) : (
                    <div className="text-center py-8 text-gray-500">
                      <FileText className="h-12 w-12 mx-auto mb-4 opacity-50" />
                      <p>No expenses recorded this month</p>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Trends Tab */}
          <TabsContent value="trends" className="space-y-5 sm:space-y-6">
            <div className="grid grid-cols-1 gap-5 sm:gap-6">
              {/* Monthly Trends Chart */}
              <Card className="shadow-lg border-0 bg-white overflow-hidden">
                <CardHeader className="pb-1 sm:pb-3 px-3 sm:px-6 pt-3 sm:pt-6">
                  <CardTitle className="text-base sm:text-lg md:text-xl font-semibold text-gray-900">6-Month Financial Trends</CardTitle>
                  <CardDescription className="text-xs sm:text-sm">Track your financial progress over time</CardDescription>
                </CardHeader>
                <CardContent className="px-2 sm:px-6 pb-4 sm:pb-6">
                  <div className="h-60 sm:h-72 md:h-96">
                    <ResponsiveContainer width="100%" height="100%">
                      <AreaChart data={processedData.monthlyTrends} margin={{ top: 20, right: 30, left: 20, bottom: 5 }}>
                        <XAxis 
                          dataKey="month" 
                          axisLine={false}
                          tickLine={false}
                          tick={{ fontSize: 11, fill: '#6B7280' }}
                        />
                        <YAxis 
                          axisLine={false}
                          tickLine={false}
                          tick={{ fontSize: 11, fill: '#6B7280' }}
                          tickFormatter={(value) => {
                            if (userCurrency === 'IDR') {
                              return `Rp${(value / 1000000).toFixed(1)}M`;
                            }
                            return `$${(value / 1000).toFixed(0)}K`;
                          }}
                        />
                        <Tooltip 
                          contentStyle={{
                            backgroundColor: 'white',
                            border: '1px solid #E5E7EB',
                            borderRadius: '8px',
                            boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)',
                            fontSize: '14px'
                          }}
                          formatter={(value: number, name: string) => {
                            // name sudah dalam format yang benar dari Area chart (Income/Expenses/Net)
                            return [formatCurrency(value, userCurrency), name];
                          }}
                          labelStyle={{ color: '#374151', fontWeight: 'bold' }}
                        />
                        <Legend />
                        <Area 
                          type="monotone" 
                          dataKey="income" 
                          stroke="#10B981" 
                          fill="url(#colorIncome)" 
                          strokeWidth={3}
                          name="Income"
                        />
                        <Area 
                          type="monotone" 
                          dataKey="expenses" 
                          stroke="#EF4444" 
                          fill="url(#colorExpenses)" 
                          strokeWidth={3}
                          name="Expenses"
                        />
                        <Area 
                          type="monotone" 
                          dataKey="net" 
                          stroke="#8B5CF6" 
                          fill="url(#colorNet)" 
                          strokeWidth={3}
                          name="Net"
                        />
                        <defs>
                          <linearGradient id="colorIncome" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="5%" stopColor="#10B981" stopOpacity={0.3}/>
                            <stop offset="95%" stopColor="#10B981" stopOpacity={0}/>
                          </linearGradient>
                          <linearGradient id="colorExpenses" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="5%" stopColor="#EF4444" stopOpacity={0.3}/>
                            <stop offset="95%" stopColor="#EF4444" stopOpacity={0}/>
                          </linearGradient>
                          <linearGradient id="colorNet" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="5%" stopColor="#8B5CF6" stopOpacity={0.3}/>
                            <stop offset="95%" stopColor="#8B5CF6" stopOpacity={0}/>
                          </linearGradient>
                        </defs>
                      </AreaChart>
                    </ResponsiveContainer>
                  </div>
                </CardContent>
              </Card>

              {/* Financial Health Indicators */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 sm:gap-6">
                <Card className="shadow-lg border-0 bg-gradient-to-br from-green-50 to-emerald-50">
                  <CardContent className="p-3 sm:p-4 md:p-6">
                    <div className="text-center">
                      <div className="w-10 h-10 sm:w-12 sm:h-12 md:w-16 md:h-16 bg-green-600 rounded-full flex items-center justify-center mx-auto mb-2 sm:mb-3 md:mb-4">
                        <Wallet className="h-5 w-5 sm:h-6 sm:w-6 md:h-8 md:w-8 text-white" />
                      </div>
                      <h3 className="text-sm sm:text-base md:text-lg font-semibold text-green-800 mb-1 sm:mb-2">Savings Rate</h3>
                      <p className="text-xl sm:text-2xl md:text-3xl font-bold text-green-700 mb-1 sm:mb-2">
                        {processedData.savingsRate.toFixed(1)}%
                      </p>
                      <p className="text-xs sm:text-sm text-green-600">
                        {(() => {
                          if (processedData.savingsRate > 20) return 'Excellent';
                          if (processedData.savingsRate > 10) return 'Good';
                          return 'Needs Improvement';
                        })()}
                      </p>
                    </div>
                  </CardContent>
                </Card>

                <Card className="shadow-lg border-0 bg-gradient-to-br from-blue-50 to-indigo-50">
                  <CardContent className="p-3 sm:p-4 md:p-6">
                    <div className="text-center">
                      <div className="w-10 h-10 sm:w-12 sm:h-12 md:w-16 md:h-16 bg-blue-600 rounded-full flex items-center justify-center mx-auto mb-2 sm:mb-3 md:mb-4">
                        <Activity className="h-5 w-5 sm:h-6 sm:w-6 md:h-8 md:w-8 text-white" />
                      </div>
                      <h3 className="text-sm sm:text-base md:text-lg font-semibold text-blue-800 mb-1 sm:mb-2">Monthly Growth</h3>
                      <p className="text-xl sm:text-2xl md:text-3xl font-bold text-blue-700 mb-1 sm:mb-2">
                        +{Math.abs(processedData.savingsRate / 2).toFixed(1)}%
                      </p>
                      <p className="text-xs sm:text-sm text-blue-600">vs Previous Month</p>
                    </div>
                  </CardContent>
                </Card>

                <Card className="shadow-lg border-0 bg-gradient-to-br from-purple-50 to-violet-50">
                  <CardContent className="p-3 sm:p-4 md:p-6">
                    <div className="text-center">
                      <div className="w-10 h-10 sm:w-12 sm:h-12 md:w-16 md:h-16 bg-purple-600 rounded-full flex items-center justify-center mx-auto mb-2 sm:mb-3 md:mb-4">
                        <Target className="h-5 w-5 sm:h-6 sm:w-6 md:h-8 md:w-8 text-white" />
                      </div>
                      <h3 className="text-sm sm:text-base md:text-lg font-semibold text-purple-800 mb-1 sm:mb-2">Budget Health</h3>
                      <p className="text-xl sm:text-2xl md:text-3xl font-bold text-purple-700 mb-1 sm:mb-2">
                        {budgetProgress.filter(b => b.status === 'good').length}/{budgetProgress.length}
                      </p>
                      <p className="text-xs sm:text-sm text-purple-600">On Track</p>
                    </div>
                  </CardContent>
                </Card>
              </div>
            </div>
          </TabsContent>

          {/* Categories Tab */}
          <TabsContent value="categories" className="space-y-5 sm:space-y-6">
            {/* Top Spending Categories - Grid Cards */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3 sm:gap-4 md:gap-6">
              {processedData.categoryBreakdown.length > 0 ? (
                processedData.categoryBreakdown.slice(0, 8).map((category, index) => {
                  const percentage = processedData.incomeVsExpenses.expenses > 0 
                    ? (category.total / processedData.incomeVsExpenses.expenses) * 100 
                    : 0;
                  
                  return (
                    <Card key={`${category.categoryName}-${index}`} className="group relative overflow-hidden bg-gradient-to-br from-white to-gray-50 border shadow-sm hover:shadow-xl transition-all duration-300 hover:-translate-y-1">
                      <div 
                        className="absolute top-0 left-0 w-full h-1"
                        style={{ backgroundColor: CHART_COLORS[index % CHART_COLORS.length] }}
                      ></div>
                      <CardContent className="p-3 sm:p-4 md:p-6">
                        <div className="flex items-start justify-between mb-3 sm:mb-4">
                          <div className="flex items-center space-x-2 sm:space-x-3">
                            <div 
                              className="w-10 h-10 sm:w-12 sm:h-12 rounded-xl flex items-center justify-center shadow-lg"
                              style={{ backgroundColor: `${CHART_COLORS[index % CHART_COLORS.length]}20` }}
                            >
                              <div 
                                className="w-5 h-5 sm:w-6 sm:h-6 rounded-lg"
                                style={{ backgroundColor: CHART_COLORS[index % CHART_COLORS.length] }}
                              ></div>
                            </div>
                            <div>
                              <h3 className="font-semibold text-gray-900 text-xs sm:text-sm md:text-base group-hover:text-gray-700 transition-colors truncate max-w-[140px] sm:max-w-none">
                                {category.categoryName}
                              </h3>
                              <p className="text-xs text-gray-500">{percentage.toFixed(1)}% of total</p>
                            </div>
                          </div>
                        </div>
                        
                        <div className="space-y-3">
                          <div className="flex items-end justify-between">
                            <span className="text-xs sm:text-sm text-gray-600 font-medium">Amount</span>
                            <span className="text-lg sm:text-xl font-bold text-gray-900">
                              {formatCurrency(category.total, userCurrency)}
                            </span>
                          </div>
                          
                          <div className="w-full bg-gray-200 rounded-full h-3 overflow-hidden">
                            <div 
                              className="h-full rounded-full transition-all duration-500 ease-out shadow-inner"
                              style={{ 
                                width: `${Math.min(percentage, 100)}%`,
                                backgroundColor: CHART_COLORS[index % CHART_COLORS.length],
                                boxShadow: `inset 0 2px 4px rgba(0,0,0,0.1)`
                              }}
                            ></div>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  );
                })
              ) : (
                <div className="col-span-full">
                  <Card className="border-2 border-dashed border-gray-300">
                    <CardContent className="flex flex-col items-center justify-center py-12">
                      <BarChart3 className="h-16 w-16 text-gray-400 mb-4" />
                      <h3 className="text-lg font-semibold text-gray-600 mb-2">No Category Data</h3>
                      <p className="text-gray-500 text-center max-w-md">
                        Start making transactions to see your spending breakdown by category
                      </p>
                    </CardContent>
                  </Card>
                </div>
              )}
            </div>

            {/* Detailed Analytics */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-5 sm:gap-6">
              {/* Monthly Category Trends */}
              <Card className="shadow-lg border-0 bg-white overflow-hidden">
                <CardHeader className="pb-1 sm:pb-3 px-3 sm:px-6 pt-3 sm:pt-6">
                  <CardTitle className="text-base sm:text-lg font-semibold text-gray-900 flex items-center">
                    <TrendingUp className="h-4 w-4 sm:h-5 sm:w-5 mr-1.5 sm:mr-2 text-blue-600" />
                    Category Trends
                  </CardTitle>
                  <CardDescription className="text-xs sm:text-sm">Monthly spending comparison</CardDescription>
                </CardHeader>
                <CardContent className="px-2 sm:px-6 pb-4 sm:pb-6">
                  <div className="h-52 sm:h-60 md:h-80">
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={processedData.categoryBreakdown.slice(0, 6)} margin={{ top: 20, right: 30, left: 20, bottom: 5 }}>
                        <XAxis 
                          dataKey="categoryName"
                          axisLine={false}
                          tickLine={false}
                          tick={{ fontSize: 11, fill: '#6B7280' }}
                          height={60}
                        />
                        <YAxis 
                          axisLine={false}
                          tickLine={false}
                          tick={{ fontSize: 11, fill: '#6B7280' }}
                          tickFormatter={(value) => {
                            if (userCurrency === 'IDR') {
                              return `Rp${(value / 1000000).toFixed(1)}M`;
                            }
                            return `$${(value / 1000).toFixed(0)}K`;
                          }}
                        />
                        <Tooltip 
                          contentStyle={{
                            backgroundColor: 'white',
                            border: '1px solid #E5E7EB',
                            borderRadius: '8px',
                            boxShadow: '0 10px 25px rgba(0, 0, 0, 0.1)',
                            fontSize: '14px'
                          }}
                          formatter={(value: number) => [formatCurrency(value, userCurrency), 'Amount']}
                          labelStyle={{ color: '#374151', fontWeight: 'bold' }}
                        />
                        <Bar 
                          dataKey="total" 
                          radius={[4, 4, 0, 0]}
                        >
                          {processedData.categoryBreakdown.slice(0, 6).map((entry, index) => (
                            <Cell 
                              key={`cell-${entry.categoryName}-${index}`} 
                              fill={CHART_COLORS[index % CHART_COLORS.length]}
                            />
                          ))}
                        </Bar>
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                </CardContent>
              </Card>

              {/* Category Insights */}
              <Card className="shadow-lg border-0 bg-white overflow-hidden">
                <CardHeader className="pb-1 sm:pb-3 px-3 sm:px-6 pt-3 sm:pt-6">
                  <CardTitle className="text-base sm:text-lg font-semibold text-gray-900 flex items-center">
                    <Target className="h-4 w-4 sm:h-5 sm:w-5 mr-1.5 sm:mr-2 text-purple-600" />
                    Spending Insights
                  </CardTitle>
                  <CardDescription className="text-xs sm:text-sm">Category analysis and recommendations</CardDescription>
                </CardHeader>
                <CardContent className="space-y-3 sm:space-y-4 px-3 sm:px-6 pb-4 sm:pb-6">
                  {processedData.categoryBreakdown.length > 0 ? (
                    <>
                      {/* Highest Spending Category */}
                      <div className="p-4 rounded-lg bg-gradient-to-r from-red-50 to-pink-50 border border-red-100">
                        <div className="flex items-center justify-between mb-2">
                          <h4 className="font-semibold text-red-900 text-sm">Highest Spending</h4>
                          <Badge variant="destructive" className="text-xs">Alert</Badge>
                        </div>
                        <div className="flex items-center justify-between">
                          <span className="text-red-800 font-medium">
                            {processedData.categoryBreakdown[0]?.categoryName}
                          </span>
                          <span className="text-red-900 font-bold">
                            {formatCurrency(processedData.categoryBreakdown[0]?.total || 0, userCurrency)}
                          </span>
                        </div>
                        <p className="text-xs text-red-700 mt-2">
                          {((processedData.categoryBreakdown[0]?.total || 0) / (processedData.incomeVsExpenses.expenses || 1) * 100).toFixed(1)}% of total expenses
                        </p>
                      </div>

                      {/* Most Transactions Category */}
                      <div className="p-4 rounded-lg bg-gradient-to-r from-blue-50 to-indigo-50 border border-blue-100">
                        <div className="flex items-center justify-between mb-2">
                          <h4 className="font-semibold text-blue-900 text-sm">Most Active</h4>
                          <Badge variant="outline" className="text-xs border-blue-300 text-blue-700">Frequent</Badge>
                        </div>
                        <div className="flex items-center justify-between">
                          <span className="text-blue-800 font-medium">
                            {processedData.categoryBreakdown[1]?.categoryName || 'N/A'}
                          </span>
                          <span className="text-blue-900 font-bold">
                            {formatCurrency(processedData.categoryBreakdown[1]?.total || 0, userCurrency)}
                          </span>
                        </div>
                        <p className="text-xs text-blue-700 mt-2">
                          Multiple small transactions detected
                        </p>
                      </div>

                      {/* Savings Opportunity */}
                      <div className="p-4 rounded-lg bg-gradient-to-r from-green-50 to-emerald-50 border border-green-100">
                        <div className="flex items-center justify-between mb-2">
                          <h4 className="font-semibold text-green-900 text-sm">Savings Opportunity</h4>
                          <Badge variant="outline" className="text-xs border-green-300 text-green-700">Optimize</Badge>
                        </div>
                        <div className="text-green-800">
                          <p className="text-sm font-medium mb-1">
                            Reduce {processedData.categoryBreakdown[0]?.categoryName} by 10%
                          </p>
                          <p className="text-xs text-green-700">
                            Potential savings: {formatCurrency((processedData.categoryBreakdown[0]?.total || 0) * 0.1, userCurrency)}
                          </p>
                        </div>
                      </div>
                    </>
                  ) : (
                    <div className="text-center py-8 text-gray-500">
                      <FileText className="h-12 w-12 mx-auto mb-4 opacity-50" />
                      <p>No insights available yet</p>
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          {/* Budgets Tab */}
          <TabsContent value="budgets" className="space-y-5 sm:space-y-6">
            <div className="grid grid-cols-1 gap-5 sm:gap-6">
              {/* Budget Overview */}
              <Card className="shadow-lg border-0 bg-white overflow-hidden">
                <CardHeader className="pb-1 sm:pb-3 px-3 sm:px-6 pt-3 sm:pt-6">
                  <CardTitle className="text-base sm:text-lg md:text-xl font-semibold text-gray-900">
                    Budget Progress - {new Date().toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}
                  </CardTitle>
                  <CardDescription className="text-xs sm:text-sm">
                    Track your current month spending progress against your budgets
                    <br />
                    <span className="text-xs text-blue-600 font-medium">
                      📅 Showing data for: {new Date().toLocaleDateString('en-US', { 
                        month: 'long', 
                        day: 'numeric', 
                        year: 'numeric' 
                      })} (current month only)
                    </span>
                  </CardDescription>
                </CardHeader>
                <CardContent className="px-3 sm:px-6 pb-4 sm:pb-6">
                  <div className="space-y-3 sm:space-y-4 md:space-y-6">
                    {budgetProgress.length > 0 ? (
                      budgetProgress.map((budget) => (
                        <div key={budget.id} className="p-3 sm:p-4 rounded-lg bg-gray-50 hover:bg-gray-100 transition-colors">
                          <div className="flex flex-col sm:flex-row sm:items-center justify-between mb-3 gap-3">
                            <div className="flex items-center space-x-3">
                              <div 
                                className="w-8 h-8 rounded-lg flex items-center justify-center"
                                style={{ backgroundColor: budget.category?.color || '#6B7280' }}
                              >
                                <span className="text-white font-bold text-xs sm:text-sm">
                                  {budget.category?.icon || '💰'}
                                </span>
                              </div>
                              <div>
                                <h3 className="font-semibold text-gray-900 text-sm sm:text-base">
                                  {budget.category?.name || 'Unknown Category'}
                                </h3>
                                <p className="text-xs sm:text-sm text-gray-600">
                                  {(() => {
                                    if (budget.period === 'monthly') return 'Monthly Budget';
                                    if (budget.period === 'weekly') return 'Weekly Budget';
                                    return 'Yearly Budget';
                                  })()} • {budget.currentMonthTransactions || 0} transactions this month
                                </p>
                              </div>
                            </div>
                            <div className="text-left sm:text-right">
                              <p className="font-semibold text-gray-900 text-sm sm:text-base">
                                {formatCurrency(budget.spent, userCurrency)} / {formatCurrency(budget.amount, userCurrency)}
                              </p>
                              <Badge 
                                variant={(() => {
                                  if (budget.status === 'good') return 'default';
                                  if (budget.status === 'warning') return 'secondary';
                                  return 'destructive';
                                })()}
                                className="mt-1"
                              >
                                {(() => {
                                  if (budget.status === 'good') return 'On Track';
                                  if (budget.status === 'warning') return 'Close to Limit';
                                  return 'Over Budget';
                                })()}
                              </Badge>
                            </div>
                          </div>
                          
                          <div className="space-y-2">
                            <div className="flex justify-between text-xs sm:text-sm">
                              <span className="text-gray-600">Progress: {budget.percentage.toFixed(1)}%</span>
                              <span className="text-gray-600">
                                Remaining: {formatCurrency(budget.remaining, userCurrency)}
                              </span>
                            </div>
                            <Progress 
                              value={budget.percentage} 
                              className={`h-2 sm:h-3 ${(() => {
                                if (budget.status === 'good') return 'text-green-600';
                                if (budget.status === 'warning') return 'text-yellow-600';
                                return 'text-red-600';
                              })()}`}
                            />
                          </div>
                        </div>
                      ))
                    ) : (
                      <div className="text-center py-8 sm:py-12 text-gray-500">
                        <Target className="h-12 w-12 sm:h-16 sm:w-16 mx-auto mb-4 opacity-50" />
                        <h3 className="text-base sm:text-lg font-medium text-gray-900 mb-2">No Budgets Set</h3>
                        <p className="text-sm sm:text-base text-gray-600 mb-4">Start managing your finances by setting up budgets</p>
                        <Button className="bg-gradient-to-r from-blue-600 to-blue-700">
                          Create Your First Budget
                        </Button>
                      </div>
                    )}
                  </div>
                </CardContent>
              </Card>

              {/* Budget Summary Cards */}
              {budgetProgress.length > 0 && (
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 sm:gap-6">
                  <Card className="shadow-lg border-0 bg-gradient-to-br from-green-50 to-emerald-50">
                    <CardContent className="p-4 sm:p-6 text-center">
                      <div className="w-10 h-10 sm:w-12 sm:h-12 bg-green-600 rounded-full flex items-center justify-center mx-auto mb-3 sm:mb-4">
                        <Target className="h-5 w-5 sm:h-6 sm:w-6 text-white" />
                      </div>
                      <h3 className="text-base sm:text-lg font-semibold text-green-800 mb-2">On Track</h3>
                      <p className="text-2xl sm:text-3xl font-bold text-green-700">
                        {budgetProgress.filter(b => b.status === 'good').length}
                      </p>
                      <p className="text-xs sm:text-sm text-green-600">budgets under 80%</p>
                    </CardContent>
                  </Card>

                  <Card className="shadow-lg border-0 bg-gradient-to-br from-yellow-50 to-amber-50">
                    <CardContent className="p-4 sm:p-6 text-center">
                      <div className="w-10 h-10 sm:w-12 sm:h-12 bg-yellow-600 rounded-full flex items-center justify-center mx-auto mb-3 sm:mb-4">
                        <AlertTriangle className="h-5 w-5 sm:h-6 sm:w-6 text-white" />
                      </div>
                      <h3 className="text-base sm:text-lg font-semibold text-yellow-800 mb-2">Warning</h3>
                      <p className="text-2xl sm:text-3xl font-bold text-yellow-700">
                        {budgetProgress.filter(b => b.status === 'warning').length}
                      </p>
                      <p className="text-xs sm:text-sm text-yellow-600">budgets near limit</p>
                    </CardContent>
                  </Card>

                  <Card className="shadow-lg border-0 bg-gradient-to-br from-red-50 to-rose-50">
                    <CardContent className="p-4 sm:p-6 text-center">
                      <div className="w-10 h-10 sm:w-12 sm:h-12 bg-red-600 rounded-full flex items-center justify-center mx-auto mb-3 sm:mb-4">
                        <TrendingDown className="h-5 w-5 sm:h-6 sm:w-6 text-white" />
                      </div>
                      <h3 className="text-base sm:text-lg font-semibold text-red-800 mb-2">Over Budget</h3>
                      <p className="text-2xl sm:text-3xl font-bold text-red-700">
                        {budgetProgress.filter(b => b.status === 'over').length}
                      </p>
                      <p className="text-xs sm:text-sm text-red-600">budgets exceeded</p>
                    </CardContent>
                  </Card>
                </div>
              )}
            </div>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}