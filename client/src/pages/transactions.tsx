import { useEffect, useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";
import { isUnauthorizedError } from "@/lib/authUtils";
import { apiRequest, queryClient } from "@/lib/queryClient";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Trash2, Edit, Search, Plus, DollarSign, ChevronLeft, ChevronRight, Download, FileText, FileSpreadsheet, ChevronDown } from "lucide-react";
import { Bar, BarChart, ResponsiveContainer, XAxis, YAxis, Tooltip, Legend } from "recharts";
import AddTransactionModal from "@/components/modals/add-transaction-modal";
import { exportToPDF, exportToExcel } from "@/lib/exportUtils";
import { getCurrencySymbol, getUserCurrency } from "@/lib/currencyUtils";

export default function Transactions() {
  const { toast } = useToast();
  const { isAuthenticated, isLoading } = useAuth();
  const [showAddTransaction, setShowAddTransaction] = useState(false);
  const [showEditTransaction, setShowEditTransaction] = useState(false);
  const [editingTransaction, setEditingTransaction] = useState<any>(null);
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [transactionToDelete, setTransactionToDelete] = useState<any>(null);
  const [searchTerm, setSearchTerm] = useState("");
  
  // Filter states
  const [selectedCategory, setSelectedCategory] = useState<string>("all");
  const [selectedType, setSelectedType] = useState<string>("all");
  const [dateRange, setDateRange] = useState(() => {
    const now = new Date();
    
    // Menggunakan format YYYY-MM-DD langsung untuk menghindari masalah timezone
    const year = now.getFullYear();
    const month = now.getMonth() + 1; // getMonth() returns 0-11, kita butuh 1-12
    
    // Tanggal 1 bulan ini
    const startDate = `${year}-${month.toString().padStart(2, '0')}-01`;
    
    // Tanggal akhir bulan ini - hitung jumlah hari dalam bulan
    const daysInMonth = new Date(year, month, 0).getDate();
    const endDate = `${year}-${month.toString().padStart(2, '0')}-${daysInMonth.toString().padStart(2, '0')}`;
    
    console.log('Setting date range:', {
      now: now.toDateString(),
      currentMonth: month,
      daysInMonth,
      startDate,
      endDate
    });
    
    return {
      start: startDate, // Tanggal 1 bulan ini
      end: endDate      // Tanggal akhir bulan ini
    };
  });
  
  // Pagination states
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 5;

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

  // Helper function for better toast notifications
  const showToast = (type: 'success' | 'error' | 'warning', title: string, description: string, transactionName?: string) => {
    const variants = {
      success: undefined, // default
      error: "destructive" as const,
      warning: "default" as const,
    };

    const finalDescription = transactionName ? `"${transactionName}" ${description}` : description;
    
    const getClassName = () => {
      if (type === 'success') return 'border-green-200 bg-green-50';
      if (type === 'warning') return 'border-yellow-200 bg-yellow-50';
      return '';
    };
    
    toast({
      title,
      description: finalDescription,
      variant: variants[type],
      duration: type === 'error' ? 5000 : 3000,
      className: getClassName(),
    });
  };

  const { data: transactions, isLoading: transactionsLoading } = useQuery({
    queryKey: ["/api/transactions"],
    retry: false,
    enabled: isAuthenticated,
    staleTime: 0, // Always fetch fresh data
  });

  const { data: userPreferences } = useQuery({
    queryKey: ["/api/user/preferences"],
    retry: false,
    enabled: isAuthenticated,
  });

  // Get user's preferred currency using utility function
  const userCurrency = getUserCurrency(userPreferences);
  const userCurrencySymbol = getCurrencySymbol(userCurrency);

  // Helper function to format amount with currency
  const formatAmount = (amount: number, currency?: string) => {
    const currencyToUse = currency || userCurrency;
    const symbol = getCurrencySymbol(currencyToUse);
    
    if (currencyToUse === 'IDR') {
      return `${symbol}${amount.toLocaleString('id-ID')}`;
    }
    return `${symbol}${amount.toLocaleString('en-US')}`;
  };

  // Helper function untuk parsing tanggal
  const parseTransactionDate = (date: string | number): Date => {
    if (typeof date === 'number') {
      return date > 9999999999 ? new Date(date) : new Date(date * 1000);
    }
    return new Date(date);
  };

  // Helper function untuk validasi date range
  const isDateInRange = (transactionDate: Date, startDate: Date, endDate: Date): boolean => {
    if (isNaN(transactionDate.getTime())) {
      console.warn('Invalid transaction date');
      return true; // Include invalid dates to avoid hiding transactions
    }
    
    if (isNaN(startDate.getTime()) || isNaN(endDate.getTime())) {
      return true; // Include all if range is invalid
    }
    
    endDate.setHours(23, 59, 59, 999);
    return transactionDate >= startDate && transactionDate <= endDate;
  };

  // Filter and process transactions
  const filteredTransactions = (transactions as any[])?.filter((transaction: any) => {
    if (!transaction) return false;
    
    const matchesSearch = transaction.description?.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         transaction.category?.name?.toLowerCase().includes(searchTerm.toLowerCase());
    
    const matchesCategory = selectedCategory === "all" || transaction.category?.name === selectedCategory;
    const matchesType = selectedType === "all" || transaction.type === selectedType;
    
    // Date filtering with error handling
    let matchesDate = true;
    try {
      const transactionDate = parseTransactionDate(transaction.date);
      const startDate = new Date(dateRange.start);
      const endDate = new Date(dateRange.end);
      
      matchesDate = isDateInRange(transactionDate, startDate, endDate);
    } catch (error) {
      console.warn('Date filtering error:', error);
      matchesDate = true;
    }
    
    return matchesSearch && matchesCategory && matchesType && matchesDate;
  })?.sort((a: any, b: any) => {
    // Sort by transaction date from newest to oldest
    try {
      const dateA = parseTransactionDate(a.date);
      const dateB = parseTransactionDate(b.date);
      return dateB.getTime() - dateA.getTime(); // Newest first
    } catch (error) {
      console.warn('Date sorting error:', error);
      return 0;
    }
  }) || [];

  // Debug logging (moved after filteredTransactions definition)
  useEffect(() => {
    if (transactions && Array.isArray(transactions)) {
      console.log('Transactions data updated:', transactions.length, 'transactions');
      console.log('Current date range:', dateRange);
      console.log('Filtered transactions:', filteredTransactions.length, 'transactions');
    }
  }, [transactions, dateRange, filteredTransactions.length]);

  // Pagination
  const totalPages = Math.ceil(filteredTransactions.length / itemsPerPage);
  const startIndex = (currentPage - 1) * itemsPerPage;
  const paginatedTransactions = filteredTransactions.slice(startIndex, startIndex + itemsPerPage);

  // Chart data preparation - sort by date first
  const chartDataMap = new Map();
  
  // Group transactions by date
  filteredTransactions.forEach(transaction => {
    const transactionDate = parseTransactionDate(transaction.date);
    const dateKey = transactionDate.toISOString().split('T')[0]; // YYYY-MM-DD format for sorting
    const displayDate = transactionDate.toLocaleDateString('en-US', { 
      month: 'short', 
      day: 'numeric' 
    });
    
    if (!chartDataMap.has(dateKey)) {
      chartDataMap.set(dateKey, {
        date: displayDate,
        dateKey: dateKey,
        income: 0,
        expense: 0,
      });
    }
    
    const entry = chartDataMap.get(dateKey);
    if (transaction.type === 'income') {
      entry.income += transaction.amount;
    } else {
      entry.expense += transaction.amount;
    }
  });
  
  // Convert to array and sort by date, then take last 7 days
  const chartData = Array.from(chartDataMap.values())
    .sort((a, b) => a.dateKey.localeCompare(b.dateKey))
    .slice(-7)
    .map(item => ({
      date: item.date,
      income: item.income,
      expense: item.expense,
    }));

  // Calculate totals for current filtered data
  const totalIncome = filteredTransactions
    .filter(t => t.type === 'income')
    .reduce((sum, t) => sum + t.amount, 0);
  
  const totalExpense = filteredTransactions
    .filter(t => t.type === 'expense')
    .reduce((sum, t) => sum + t.amount, 0);

  const deleteTransactionMutation = useMutation({
    mutationFn: async (id: number) => {
      await apiRequest("DELETE", `/api/transactions/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/transactions"] });
      const deletedTransactionName = transactionToDelete?.description;
      showToast('success', '🗑️ Transaction Deleted!', 'has been permanently removed', deletedTransactionName);
    },
    onError: (error) => {
      if (isUnauthorizedError(error)) {
        showToast('error', '🔐 Session Expired', 'Please login again to continue');
        setTimeout(() => {
          window.location.href = "/auth";
        }, 2000);
        return;
      }
      const errorMessage = error instanceof Error ? error.message : 'Failed to delete transaction';
      showToast('error', '❌ Deletion Failed', errorMessage);
    },
  });

  const handleEdit = (transaction: any) => {
    setEditingTransaction(transaction);
    setShowEditTransaction(true);
    showToast('success', '✏️ Editing Transaction', `You can now modify "${transaction.description}" details`);
  };

  const handleDelete = (transaction: any) => {
    setTransactionToDelete(transaction);
    setIsDeleteDialogOpen(true);
  };

  const confirmDelete = () => {
    if (transactionToDelete) {
      showToast('warning', '⏳ Deleting Transaction...', 'Please wait while we remove the transaction');
      deleteTransactionMutation.mutate(transactionToDelete.id);
      setIsDeleteDialogOpen(false);
      setTransactionToDelete(null);
    }
  };

  // Reset pagination when filters change
  useEffect(() => {
    setCurrentPage(1);
  }, [searchTerm, selectedCategory, selectedType, dateRange]);

  const handlePageChange = (page: number) => {
    setCurrentPage(page);
  };

  // Export functions
  const handleExportPDF = () => {
    try {
      exportToPDF(filteredTransactions, {
        dateRange,
        userCurrency,
        currencySymbol: userCurrencySymbol
      });
      showToast('success', '📄 PDF Exported!', 'Your transaction report has been downloaded successfully');
    } catch (error) {
      console.error('PDF Export error:', error);
      showToast('error', '❌ Export Failed', 'Failed to generate PDF report');
    }
  };

  const handleExportExcel = () => {
    try {
      exportToExcel(filteredTransactions, {
        dateRange,
        userCurrency,
        currencySymbol: userCurrencySymbol
      });
      showToast('success', '📊 Excel Exported!', 'Your transaction report has been downloaded successfully');
    } catch (error) {
      console.error('Excel Export error:', error);
      showToast('error', '❌ Export Failed', 'Failed to generate Excel report');
    }
  };

  const getUniqueCategories = () => {
    const uniqueCategories = Array.from(
      new Set((transactions as any[])?.map(t => t.category?.name).filter(Boolean))
    );
    return uniqueCategories;
  };

  if (isLoading || transactionsLoading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto mb-4"></div>
          <p className="text-gray-600">Loading transactions...</p>
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
              <h1 className="text-xl sm:text-2xl font-bold bg-gradient-to-r from-gray-900 to-gray-600 bg-clip-text text-transparent">
                Transactions
              </h1>
              <p className="mt-0.5 text-sm text-gray-600">
                Manage all your income and expense transactions
              </p>
            </div>
            <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2 sm:gap-3 mt-3 sm:mt-0">
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="outline" className="flex items-center justify-center gap-1 sm:gap-2 bg-white shadow-sm border-gray-200 h-9 sm:h-10">
                    <Download className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
                    <span className="hidden sm:inline">Export</span>
                    <ChevronDown className="w-2.5 h-2.5 sm:w-3 sm:h-3" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-44 sm:w-48">
                  <DropdownMenuItem onClick={handleExportPDF} className="flex items-center gap-1.5 sm:gap-2 cursor-pointer text-xs sm:text-sm">
                    <FileText className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-red-500" />
                    <span>Export as PDF</span>
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={handleExportExcel} className="flex items-center gap-1.5 sm:gap-2 cursor-pointer text-xs sm:text-sm">
                    <FileSpreadsheet className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-green-500" />
                    <span>Export as Excel</span>
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
              <Button 
                className="bg-primary hover:bg-primary/90 text-white h-9 sm:h-10"
                onClick={() => setShowAddTransaction(true)}
              >
                <Plus className="w-3.5 h-3.5 sm:w-4 sm:h-4 mr-1 sm:mr-2" />
                <span className="hidden sm:inline">Add Transaction</span>
                <span className="sm:hidden">Add</span>
              </Button>
            </div>
          </div>
        </div>

        {/* Filters Section */}
        <div className="mt-4 mb-6">
          <div className="bg-white shadow rounded-xl p-4 space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
              {/* Search */}
              <div className="relative sm:col-span-2">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
                <Input
                  placeholder="Search transactions..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-9 bg-white shadow-sm border-gray-200 h-9 sm:h-10"
                />
              </div>

              {/* Category Filter */}
              <Select value={selectedCategory} onValueChange={setSelectedCategory}>
                <SelectTrigger className="bg-white shadow-sm border-gray-200 h-9 sm:h-10">
                  <SelectValue placeholder="Category" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Categories</SelectItem>
                  {getUniqueCategories().map((category) => (
                    <SelectItem key={category} value={category}>
                      {category}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>

              {/* Type Filter */}
              <Select value={selectedType} onValueChange={setSelectedType}>
                <SelectTrigger className="bg-white shadow-sm border-gray-200 h-9 sm:h-10">
                  <SelectValue placeholder="Type" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Types</SelectItem>
                  <SelectItem value="income">Income</SelectItem>
                  <SelectItem value="expense">Expense</SelectItem>
                </SelectContent>
              </Select>

              {/* Date Range */}
              <div className="col-span-1 sm:col-span-2 grid grid-cols-2 gap-2 items-center">
                <Input
                  type="date"
                  value={dateRange.start}
                  onChange={(e) => setDateRange(prev => ({ ...prev, start: e.target.value }))}
                  className="bg-white shadow-sm border-gray-200 h-9 sm:h-10"
                />
                <Input
                  type="date"
                  value={dateRange.end}
                  onChange={(e) => setDateRange(prev => ({ ...prev, end: e.target.value }))}
                  className="bg-white shadow-sm border-gray-200 h-9 sm:h-10"
                />
              </div>
            </div>
            
            {/* Summary Cards */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 pt-2">
              <Card className="border-emerald-100 bg-gradient-to-br from-emerald-50 to-green-50">
                <CardContent className="p-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-emerald-600 text-sm font-medium">Income</p>
                      <p className="text-lg sm:text-xl font-bold text-emerald-700">
                        {formatAmount(totalIncome)}
                      </p>
                    </div>
                    <div className="w-10 h-10 bg-emerald-500 rounded-full flex items-center justify-center">
                      <span className="text-white text-lg">💹</span>
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card className="border-red-100 bg-gradient-to-br from-red-50 to-pink-50">
                <CardContent className="p-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-red-600 text-sm font-medium">Expenses</p>
                      <p className="text-lg sm:text-xl font-bold text-red-700">
                        {formatAmount(totalExpense)}
                      </p>
                    </div>
                    <div className="w-10 h-10 bg-red-500 rounded-full flex items-center justify-center">
                      <span className="text-white text-lg">💸</span>
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card className="border-blue-100 bg-gradient-to-br from-blue-50 to-indigo-50">
                <CardContent className="p-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-blue-600 text-sm font-medium">Balance</p>
                      <p className={`text-lg sm:text-xl font-bold ${totalIncome - totalExpense >= 0 ? 'text-emerald-700' : 'text-red-700'}`}>
                        {formatAmount(totalIncome - totalExpense)}
                      </p>
                    </div>
                    <div className="w-10 h-10 bg-blue-500 rounded-full flex items-center justify-center">
                      <span className="text-white text-lg">💰</span>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>
          </div>
        </div>

        {/* Chart and Transaction Details */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 mb-6">
          {/* Chart Section */}
          <div className="lg:col-span-2">
            <Card className="shadow border">
              <CardHeader className="p-4 pb-0">
                <CardTitle className="text-lg font-semibold text-gray-900">Transaction Chart</CardTitle>
              </CardHeader>
              <CardContent className="p-4 pt-0">
                <div className="h-60 sm:h-72 mt-2">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={chartData} margin={{ top: 5, right: 5, bottom: 5, left: 5 }}>
                      <XAxis 
                        dataKey="date" 
                        fontSize={10}
                        tick={{ fontSize: 10 }}
                        tickMargin={8}
                      />
                      <YAxis 
                        fontSize={10}
                        tick={{ fontSize: 10 }}
                        tickFormatter={(value) => formatAmount(value).replace(/\d+/, (match) => 
                          parseInt(match) > 1000 ? `${Math.round(parseInt(match) / 1000)}K` : match
                        )}
                        width={45}
                      />
                      <Tooltip 
                        formatter={(value: any, name: string) => [
                          formatAmount(value), 
                          name === 'income' ? 'Income' : 'Expense'
                        ]}
                        contentStyle={{
                          backgroundColor: 'rgba(255, 255, 255, 0.95)',
                          border: 'none',
                          borderRadius: '8px',
                          padding: '8px',
                          fontSize: '12px',
                          boxShadow: '0 10px 15px -3px rgba(0, 0, 0, 0.1)'
                        }}
                      />
                      <Legend wrapperStyle={{ fontSize: '10px', paddingTop: '10px' }} />
                      <Bar dataKey="income" fill="#10B981" name="Income" radius={[3, 3, 0, 0]} />
                      <Bar dataKey="expense" fill="#EF4444" name="Expense" radius={[3, 3, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Transactions List */}
          <div className="lg:col-span-1">
            <Card className="shadow border">
              <CardHeader className="p-4 pb-2">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-lg font-semibold text-gray-900">Transactions</CardTitle>
                  {transactionsLoading && (
                    <div className="flex items-center gap-2 text-blue-600">
                      <div className="w-4 h-4 border-2 border-blue-600 border-t-transparent rounded-full animate-spin"></div>
                      <span className="text-sm">Refreshing...</span>
                    </div>
                  )}
                </div>
              </CardHeader>
              <CardContent className="p-4 pt-0">
                {paginatedTransactions.length === 0 ? (
                  <div className="text-center py-6">
                    <DollarSign className="w-10 h-10 text-gray-400 mx-auto mb-3" />
                    <p className="text-gray-500 mb-3 text-sm">No transactions found</p>
                    <Button 
                      onClick={() => setShowAddTransaction(true)}
                      className="bg-primary hover:bg-primary/90 text-white"
                    >
                      Add Transaction
                    </Button>
                  </div>
                ) : (
                  <div className="space-y-2">
                    {paginatedTransactions.map((transaction: any) => (
                      <div
                        key={transaction.id}
                        className="flex items-center justify-between p-2 border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors"
                      >
                        <div className="flex items-center gap-2 flex-1 min-w-0">
                          <div className={`w-8 h-8 rounded-lg flex items-center justify-center text-sm flex-shrink-0 ${
                            transaction.type === 'income' 
                              ? 'bg-emerald-100' 
                              : 'bg-red-100'
                          }`}>
                            <span>
                              {transaction.category?.icon || (transaction.type === 'income' ? '💰' : '💸')}
                            </span>
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="font-medium text-gray-900 truncate text-sm">
                              {transaction.description}
                            </p>
                            <div className="flex items-center gap-2 text-xs text-gray-500 mt-1">
                              <Badge 
                                variant="outline" 
                                className={`border-0 text-xs px-1.5 py-0.5 ${
                                  transaction.type === 'income' 
                                    ? 'bg-emerald-100 text-emerald-700' 
                                    : 'bg-red-100 text-red-700'
                                }`}
                              >
                                {transaction.category?.name || 'Uncategorized'}
                              </Badge>
                              <span className="hidden sm:inline">
                                {parseTransactionDate(transaction.date).toLocaleDateString('en-US', {
                                  month: 'short',
                                  day: 'numeric'
                                })}
                              </span>
                            </div>
                          </div>
                        </div>
                        <div className="text-right flex-shrink-0 ml-2">
                          <p className={`font-semibold text-sm ${
                            transaction.type === 'income' ? 'text-emerald-600' : 'text-red-600'
                          }`}>
                            {transaction.type === 'income' ? '+' : '-'}{formatAmount(transaction.amount, transaction.currency)}
                          </p>
                          <div className="flex items-center gap-1 mt-1 justify-end">
                            <Button 
                              variant="ghost" 
                              size="sm"
                              onClick={() => handleEdit(transaction)}
                              className="h-6 w-6 p-0 hover:bg-blue-100 hover:text-blue-600"
                            >
                              <Edit className="w-3 h-3" />
                            </Button>
                            <Button 
                              variant="ghost" 
                              size="sm"
                              onClick={() => handleDelete(transaction)}
                              className="h-6 w-6 p-0 hover:bg-red-100 hover:text-red-600"
                            >
                              <Trash2 className="w-3 h-3" />
                            </Button>
                          </div>
                        </div>
                      </div>
                    ))}

                    {/* Pagination */}
                    {totalPages > 1 && (
                      <div className="flex flex-col sm:flex-row items-center justify-between pt-3 border-t border-gray-200 gap-2 mt-2">
                        <p className="text-xs text-gray-600 order-2 sm:order-1">
                          Showing {startIndex + 1}-{Math.min(startIndex + itemsPerPage, filteredTransactions.length)} of {filteredTransactions.length}
                        </p>
                        <div className="flex items-center gap-1 order-1 sm:order-2">
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => handlePageChange(currentPage - 1)}
                            disabled={currentPage === 1}
                            className="h-7 w-7 p-0"
                          >
                            <ChevronLeft className="w-3 h-3" />
                          </Button>
                          
                          {Array.from({ length: Math.min(totalPages, 5) }, (_, i) => {
                            let page;
                            if (totalPages <= 5) {
                              page = i + 1;
                            } else if (currentPage <= 3) {
                              page = i + 1;
                            } else if (currentPage >= totalPages - 2) {
                              page = totalPages - 4 + i;
                            } else {
                              page = currentPage - 2 + i;
                            }
                            
                            return (
                              <Button
                                key={page}
                                variant={currentPage === page ? "default" : "outline"}
                                size="sm"
                                onClick={() => handlePageChange(page)}
                                className="h-7 w-7 p-0 text-xs"
                              >
                                {page}
                              </Button>
                            );
                          })}
                          
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => handlePageChange(currentPage + 1)}
                            disabled={currentPage === totalPages}
                            className="h-7 w-7 p-0"
                          >
                            <ChevronRight className="w-3 h-3" />
                          </Button>
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </div>
        
        {/* Modals */}
        <AddTransactionModal 
          isOpen={showAddTransaction} 
          onClose={() => setShowAddTransaction(false)} 
        />
        
        <AddTransactionModal 
          isOpen={showEditTransaction} 
          onClose={() => {
            setShowEditTransaction(false);
            setEditingTransaction(null);
            // Reset pagination to page 1 to ensure edited transaction is visible
            setCurrentPage(1);
            // Force refresh transactions data after edit
            queryClient.invalidateQueries({ queryKey: ["/api/transactions"] });
            queryClient.refetchQueries({ queryKey: ["/api/transactions"] });
          }}
          editingTransaction={editingTransaction}
          isEditing={true}
        />

        {/* Delete Confirmation Dialog */}
        <AlertDialog open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen}>
          <AlertDialogContent className="sm:max-w-lg">
            <AlertDialogHeader>
              <div className="mx-auto w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mb-4">
                <Trash2 className="h-8 w-8 text-red-600" />
              </div>
              <AlertDialogTitle className="text-xl font-bold text-center">
                Delete Transaction
              </AlertDialogTitle>
              <AlertDialogDescription className="text-center">
                This action cannot be undone
              </AlertDialogDescription>
            </AlertDialogHeader>
            
            <div className="space-y-4 my-2">
              {transactionToDelete && (
                <div className="bg-gray-50 rounded-lg p-4 border border-gray-200">
                  <div className="flex items-center gap-3">
                    <div className={`w-10 h-10 rounded-lg flex items-center justify-center shadow-sm ${
                      transactionToDelete.type === 'income' 
                        ? 'bg-emerald-500' 
                        : 'bg-red-500'
                    }`}>
                      <span className="text-white text-lg">
                        {transactionToDelete.category?.icon || (transactionToDelete.type === 'income' ? '💰' : '💸')}
                      </span>
                    </div>
                    <div className="flex-1">
                      <div className="font-semibold text-gray-900 text-base mb-1">
                        {transactionToDelete.description}
                      </div>
                      <div className="flex items-center flex-wrap gap-2 text-sm text-gray-600">
                        <Badge className={`border-0 ${
                          transactionToDelete.type === 'income' 
                            ? 'bg-emerald-100 text-emerald-700' 
                            : 'bg-red-100 text-red-700'
                        }`}>
                          {transactionToDelete.category?.name || 'Uncategorized'}
                        </Badge>
                        <span className="text-xs">📅 {parseTransactionDate(transactionToDelete.date).toLocaleDateString('en-US')}</span>
                      </div>
                    </div>
                    <div className={`text-right font-bold text-base ${
                      transactionToDelete.type === 'income' ? 'text-emerald-600' : 'text-red-600'
                    }`}>
                      {transactionToDelete.type === 'income' ? '+' : '-'}{formatAmount(transactionToDelete.amount)}
                    </div>
                  </div>
                </div>
              )}
              <div className="bg-amber-50 border border-amber-200 rounded-lg p-3">
                <p className="text-amber-800 text-center font-medium text-sm">
                  ⚠️ This transaction will be permanently deleted from your records
                </p>
              </div>
            </div>

            <AlertDialogFooter className="flex flex-col sm:flex-row gap-2">
              <AlertDialogCancel 
                className="sm:mt-0 border-gray-200"
                onClick={() => {
                  setIsDeleteDialogOpen(false);
                  setTransactionToDelete(null);
                }}
              >
                Cancel
              </AlertDialogCancel>
              <AlertDialogAction 
                onClick={confirmDelete}
                className="bg-red-600 hover:bg-red-700 text-white"
                disabled={deleteTransactionMutation.isPending}
              >
                {deleteTransactionMutation.isPending ? (
                  <div className="flex items-center justify-center gap-2">
                    <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                    Deleting...
                  </div>
                ) : (
                  "Delete Transaction"
                )}
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </div>
    </div>
  );
}
