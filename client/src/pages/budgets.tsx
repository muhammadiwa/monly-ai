import { useState, useMemo, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Plus, Target, TrendingDown, AlertTriangle, Calendar, DollarSign, Edit3, Trash2 } from "lucide-react";
import { formatCurrency, getUserCurrency } from '@/lib/currencyUtils';
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { format, startOfMonth, endOfMonth, isWithinInterval } from "date-fns";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";

// Budget form schema
const budgetFormSchema = z.object({
  categoryId: z.number().min(1, "Category is required"),
  amount: z.number().min(0.01, "Amount must be greater than 0"),
  period: z.enum(["monthly", "weekly", "yearly"]),
  startDate: z.string().min(1, "Start date is required"),
  endDate: z.string().min(1, "End date is required"),
});

type BudgetFormData = z.infer<typeof budgetFormSchema>;

interface Budget {
  id: number;
  categoryId: number;
  amount: number;
  currency: string;
  period: string;
  startDate: number;
  endDate: number;
  isActive: boolean;
  category?: {
    id: number;
    name: string;
    icon: string;
    color: string;
    type: string;
  };
}

interface Transaction {
  id: number;
  amount: number;
  type: string;
  date: number;
  categoryId: number;
  category?: {
    name: string;
    color: string;
    icon: string;
  };
}

export default function BudgetsPage() {
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const [editingBudget, setEditingBudget] = useState<Budget | null>(null);
  const [selectedPeriod, setSelectedPeriod] = useState<string>("monthly");
  const queryClient = useQueryClient();
  const { isAuthenticated, isLoading: authLoading } = useAuth();
  const { toast } = useToast();

  // Helper function untuk parsing tanggal transaction (handle timestamp inconsistency)
  const parseTransactionDate = (date: string | number): Date => {
    if (typeof date === 'number') {
      // Jika timestamp dalam milidetik (13 digit), gunakan langsung
      // Jika timestamp dalam detik (10 digit), kalikan 1000
      return date > 9999999999 ? new Date(date) : new Date(date * 1000);
    }
    return new Date(date);
  };

  // Redirect to auth if not authenticated
  useEffect(() => {
    if (!authLoading && !isAuthenticated) {
      toast({
        title: "Authentication Required",
        description: "Please log in to access budgets.",
        variant: "destructive",
      });
      window.location.href = "/auth";
    }
  }, [isAuthenticated, authLoading, toast]);

  // Fetch user preferences
  const { data: userPreferences } = useQuery({
    queryKey: ["/api/user/preferences"],
    queryFn: async () => {
      const authToken = localStorage.getItem('auth-token');
      if (!authToken) {
        throw new Error('No auth token');
      }
      
      const response = await fetch("/api/user/preferences", {
        headers: {
          'Authorization': `Bearer ${authToken}`,
        },
        credentials: "include",
      });
      if (!response.ok) {
        if (response.status === 401) {
          toast({
            title: "Session Expired",
            description: "Please log in again.",
            variant: "destructive",
          });
          window.location.href = "/auth";
        }
        throw new Error("Failed to fetch user preferences");
      }
      return response.json();
    },
    enabled: isAuthenticated,
    retry: false,
  });

  const userCurrency = getUserCurrency(userPreferences);

  // Fetch budgets
  const { data: budgets = [], isLoading: budgetsLoading } = useQuery<Budget[]>({
    queryKey: ["/api/budgets"],
    queryFn: async () => {
      const authToken = localStorage.getItem('auth-token');
      if (!authToken) {
        throw new Error('No auth token');
      }
      
      const response = await fetch("/api/budgets", {
        headers: {
          'Authorization': `Bearer ${authToken}`,
        },
        credentials: "include",
      });
      if (!response.ok) {
        if (response.status === 401) {
          toast({
            title: "Session Expired",
            description: "Please log in again.",
            variant: "destructive",
          });
          window.location.href = "/auth";
        }
        throw new Error("Failed to fetch budgets");
      }
      return response.json();
    },
    enabled: isAuthenticated,
    retry: false,
  });

  // Fetch categories
  const { data: categories = [] } = useQuery({
    queryKey: ["/api/categories"],
    queryFn: async () => {
      const authToken = localStorage.getItem('auth-token');
      if (!authToken) {
        throw new Error('No auth token');
      }
      
      const response = await fetch("/api/categories", {
        headers: {
          'Authorization': `Bearer ${authToken}`,
        },
        credentials: "include",
      });
      if (!response.ok) {
        if (response.status === 401) {
          toast({
            title: "Session Expired",
            description: "Please log in again.",
            variant: "destructive",
          });
          window.location.href = "/auth";
        }
        throw new Error("Failed to fetch categories");
      }
      return response.json();
    },
    enabled: isAuthenticated,
    retry: false,
  });

  // Fetch transactions for budget analysis
  const { data: transactions = [] } = useQuery<Transaction[]>({
    queryKey: ["/api/transactions"],
    queryFn: async () => {
      const authToken = localStorage.getItem('auth-token');
      if (!authToken) {
        throw new Error('No auth token');
      }
      
      const response = await fetch("/api/transactions", {
        headers: {
          'Authorization': `Bearer ${authToken}`,
        },
        credentials: "include",
      });
      if (!response.ok) {
        if (response.status === 401) {
          toast({
            title: "Session Expired",
            description: "Please log in again.",
            variant: "destructive",
          });
          window.location.href = "/auth";
        }
        throw new Error("Failed to fetch transactions");
      }
      return response.json();
    },
    enabled: isAuthenticated,
    retry: false,
  });

  // Create budget mutation
  const createBudgetMutation = useMutation({
    mutationFn: async (data: BudgetFormData) => {
      const authToken = localStorage.getItem('auth-token');
      if (!authToken) {
        throw new Error('No auth token');
      }
      
      const response = await fetch("/api/budgets", {
        method: "POST",
        headers: { 
          "Content-Type": "application/json",
          'Authorization': `Bearer ${authToken}`,
        },
        credentials: "include",
        body: JSON.stringify(data),
      });
      if (!response.ok) {
        if (response.status === 401) {
          toast({
            title: "Session Expired",
            description: "Please log in again.",
            variant: "destructive",
          });
          window.location.href = "/auth";
        }
        throw new Error("Failed to create budget");
      }
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/budgets"] });
      setIsCreateDialogOpen(false);
      setEditingBudget(null);
      form.reset();
      toast({
        title: "Budget Created",
        description: "Your budget has been created successfully.",
      });
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to create budget. Please try again.",
        variant: "destructive",
      });
    },
  });

  // Update budget mutation
  const updateBudgetMutation = useMutation({
    mutationFn: async ({ id, data }: { id: number; data: Partial<BudgetFormData> }) => {
      const authToken = localStorage.getItem('auth-token');
      if (!authToken) {
        throw new Error('No auth token');
      }
      
      const response = await fetch(`/api/budgets/${id}`, {
        method: "PUT",
        headers: { 
          "Content-Type": "application/json",
          'Authorization': `Bearer ${authToken}`,
        },
        credentials: "include",
        body: JSON.stringify(data),
      });
      if (!response.ok) {
        if (response.status === 401) {
          toast({
            title: "Session Expired",
            description: "Please log in again.",
            variant: "destructive",
          });
          window.location.href = "/auth";
        }
        throw new Error("Failed to update budget");
      }
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/budgets"] });
      setEditingBudget(null);
      setIsCreateDialogOpen(false);
      toast({
        title: "Budget Updated",
        description: "Your budget has been updated successfully.",
      });
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to update budget. Please try again.",
        variant: "destructive",
      });
    },
  });

  // Delete budget mutation
  const deleteBudgetMutation = useMutation({
    mutationFn: async (id: number) => {
      const authToken = localStorage.getItem('auth-token');
      if (!authToken) {
        throw new Error('No auth token');
      }
      
      const response = await fetch(`/api/budgets/${id}`, {
        method: "DELETE",
        headers: {
          'Authorization': `Bearer ${authToken}`,
        },
        credentials: "include",
      });
      if (!response.ok) {
        if (response.status === 401) {
          toast({
            title: "Session Expired",
            description: "Please log in again.",
            variant: "destructive",
          });
          window.location.href = "/auth";
        }
        throw new Error("Failed to delete budget");
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/budgets"] });
      toast({
        title: "Budget Deleted",
        description: "Budget has been deleted successfully.",
      });
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to delete budget. Please try again.",
        variant: "destructive",
      });
    },
  });

  const form = useForm<BudgetFormData>({
    resolver: zodResolver(budgetFormSchema),
    defaultValues: {
      categoryId: 0,
      amount: 0,
      period: "monthly",
      startDate: format(startOfMonth(new Date()), "yyyy-MM-dd"),
      endDate: format(endOfMonth(new Date()), "yyyy-MM-dd"),
    },
  });

  // Reset form when dialog opens/closes or editing budget changes
  useEffect(() => {
    if (editingBudget) {
      form.reset({
        categoryId: editingBudget.categoryId,
        amount: editingBudget.amount,
        period: editingBudget.period as "monthly" | "weekly" | "yearly",
        startDate: format(new Date(editingBudget.startDate * 1000), "yyyy-MM-dd"),
        endDate: format(new Date(editingBudget.endDate * 1000), "yyyy-MM-dd"),
      });
    } else {
      form.reset({
        categoryId: 0,
        amount: 0,
        period: "monthly",
        startDate: format(startOfMonth(new Date()), "yyyy-MM-dd"),
        endDate: format(endOfMonth(new Date()), "yyyy-MM-dd"),
      });
    }
  }, [editingBudget, form]);

  // Calculate budget statistics
  const budgetStats = useMemo(() => {
    const activeBudgets = budgets.filter(b => b.isActive);
    
    return activeBudgets.map(budget => {
      const budgetStart = new Date(budget.startDate * 1000);
      const budgetEnd = new Date(budget.endDate * 1000);
      
      // Calculate spent amount for this budget period
      const categoryTransactions = transactions.filter(t => 
        t.categoryId === budget.categoryId && 
        t.type === "expense" &&
        isWithinInterval(parseTransactionDate(t.date), { start: budgetStart, end: budgetEnd })
      );
      
      const spent = categoryTransactions.reduce((sum, t) => sum + t.amount, 0);
      const remaining = budget.amount - spent;
      const percentUsed = budget.amount > 0 ? (spent / budget.amount) * 100 : 0;
      
      let status = "good";
      if (percentUsed >= 100) {
        status = "overbudget";
      } else if (percentUsed >= 80) {
        status = "warning";
      }
      
      return {
        ...budget,
        spent,
        remaining,
        percentUsed,
        status
      };
    });
  }, [budgets, transactions]);

  const overallStats = useMemo(() => {
    const totalBudget = budgetStats.reduce((sum, b) => sum + b.amount, 0);
    const totalSpent = budgetStats.reduce((sum, b) => sum + b.spent, 0);
    const overBudgetCount = budgetStats.filter(b => b.status === "overbudget").length;
    const warningCount = budgetStats.filter(b => b.status === "warning").length;
    
    return {
      totalBudget,
      totalSpent,
      totalRemaining: totalBudget - totalSpent,
      overBudgetCount,
      warningCount,
      onTrackCount: budgetStats.length - overBudgetCount - warningCount
    };
  }, [budgetStats]);

  const handleSubmit = (data: BudgetFormData) => {
    // Add user's preferred currency to budget data
    const budgetData = {
      ...data,
      currency: userCurrency
    };
    
    if (editingBudget) {
      updateBudgetMutation.mutate({ id: editingBudget.id, data: budgetData });
    } else {
      createBudgetMutation.mutate(budgetData);
    }
  };

  const filteredBudgets = budgetStats.filter(budget => {
    if (selectedPeriod === "all") return true;
    return budget.period === selectedPeriod;
  });

  if (budgetsLoading) {
    return (
      <div className="container mx-auto p-6">
        <div className="animate-pulse space-y-6">
          <div className="h-8 bg-gray-200 rounded w-1/4"></div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {[1, 2, 3].map(i => (
              <div key={i} className="h-32 bg-gray-200 rounded"></div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="px-3 sm:px-4 lg:px-6 space-y-5 sm:space-y-6 md:space-y-8 max-w-[100vw] overflow-x-hidden">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 sm:gap-4">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold bg-gradient-to-r from-gray-900 to-gray-600 bg-clip-text text-transparent">Budget Management</h1>
          <p className="text-sm sm:text-base text-gray-600">
            Set spending limits and track your financial goals
          </p>
        </div>
        
        <Dialog open={isCreateDialogOpen} onOpenChange={setIsCreateDialogOpen}>
          <DialogTrigger asChild>
            <Button className="bg-gradient-to-r from-blue-500 to-purple-600 hover:from-blue-600 hover:to-purple-700 text-white shadow-lg h-9 text-xs sm:text-sm mt-2 sm:mt-0">
              <Plus className="w-3.5 h-3.5 sm:w-4 sm:h-4 mr-1.5 sm:mr-2" />
              Create Budget
            </Button>
          </DialogTrigger>
          <DialogContent className="sm:max-w-[425px] p-4 sm:p-6">
            <DialogHeader className="pb-1 sm:pb-2">
              <DialogTitle className="text-base sm:text-lg">{editingBudget ? "Edit Budget" : "Create New Budget"}</DialogTitle>
              <DialogDescription className="text-xs sm:text-sm">
                Set a spending limit for a specific category and time period.
              </DialogDescription>
            </DialogHeader>
            <Form {...form}>
              <form onSubmit={form.handleSubmit(handleSubmit)} className="space-y-3 sm:space-y-4">
                <FormField
                  control={form.control}
                  name="categoryId"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="text-xs sm:text-sm">Category</FormLabel>
                      <Select 
                        onValueChange={(value) => field.onChange(parseInt(value))}
                        value={field.value ? field.value.toString() : ""}
                      >
                        <FormControl>
                          <SelectTrigger className="h-9 text-xs sm:text-sm">
                            <SelectValue placeholder="Select a category" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          {categories.filter((cat: any) => cat.type === "expense").map((category: any) => (
                            <SelectItem key={category.id} value={category.id.toString()} className="text-xs sm:text-sm">
                              <div className="flex items-center gap-2">
                                <span>{category.icon}</span>
                                <span>{category.name}</span>
                              </div>
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <FormMessage className="text-xs" />
                    </FormItem>
                  )}
                />
                
                <FormField
                  control={form.control}
                  name="amount"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="text-xs sm:text-sm">Budget Amount</FormLabel>
                      <FormControl>
                        <Input
                          type="number"
                          step="0.01"
                          placeholder="0.00"
                          value={field.value || ''}
                          onChange={(e) => field.onChange(parseFloat(e.target.value) || 0)}
                          className="h-9 text-xs sm:text-sm"
                        />
                      </FormControl>
                      <FormMessage className="text-xs" />
                    </FormItem>
                  )}
                />
                
                <FormField
                  control={form.control}
                  name="period"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="text-xs sm:text-sm">Period</FormLabel>
                      <Select onValueChange={field.onChange} defaultValue={field.value}>
                        <FormControl>
                          <SelectTrigger className="h-9 text-xs sm:text-sm">
                            <SelectValue />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          <SelectItem value="weekly" className="text-xs sm:text-sm">Weekly</SelectItem>
                          <SelectItem value="monthly" className="text-xs sm:text-sm">Monthly</SelectItem>
                          <SelectItem value="yearly" className="text-xs sm:text-sm">Yearly</SelectItem>
                        </SelectContent>
                      </Select>
                      <FormMessage className="text-xs" />
                    </FormItem>
                  )}
                />
                
                <div className="grid grid-cols-2 gap-2 sm:gap-4">
                  <FormField
                    control={form.control}
                    name="startDate"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel className="text-xs sm:text-sm">Start Date</FormLabel>
                        <FormControl>
                          <Input type="date" {...field} className="h-9 text-xs sm:text-sm p-2" />
                        </FormControl>
                        <FormMessage className="text-xs" />
                      </FormItem>
                    )}
                  />
                  
                  <FormField
                    control={form.control}
                    name="endDate"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel className="text-xs sm:text-sm">End Date</FormLabel>
                        <FormControl>
                          <Input type="date" {...field} className="h-9 text-xs sm:text-sm p-2" />
                        </FormControl>
                        <FormMessage className="text-xs" />
                      </FormItem>
                    )}
                  />
                </div>
                
                <div className="flex flex-col-reverse sm:flex-row sm:justify-end gap-2 sm:gap-3 pt-3 sm:pt-4 mt-1 sm:mt-0">
                  <Button type="button" variant="outline" onClick={() => {
                    setIsCreateDialogOpen(false);
                    setEditingBudget(null);
                    form.reset();
                  }}
                  className="h-9 text-xs sm:text-sm w-full sm:w-auto">
                    Cancel
                  </Button>
                  <Button type="submit" 
                    disabled={createBudgetMutation.isPending || updateBudgetMutation.isPending}
                    className="h-9 text-xs sm:text-sm w-full sm:w-auto mb-1 sm:mb-0"
                  >
                    {(() => {
                      if (createBudgetMutation.isPending || updateBudgetMutation.isPending) {
                        return editingBudget ? "Updating..." : "Creating...";
                      }
                      return editingBudget ? "Update Budget" : "Create Budget";
                    })()}
                  </Button>
                </div>
              </form>
            </Form>
          </DialogContent>
        </Dialog>
      </div>

      {/* Overall Statistics */}
      <div className="grid grid-cols-2 sm:grid-cols-2 md:grid-cols-4 gap-3 sm:gap-4 md:gap-6">
        <Card className="bg-gradient-to-br from-blue-50 to-indigo-100 border-blue-200 shadow-sm">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-1 sm:pb-2 px-3 sm:px-6 pt-3 sm:pt-4">
            <CardTitle className="text-xs sm:text-sm font-medium text-blue-900">Total Budget</CardTitle>
            <DollarSign className="h-3.5 w-3.5 sm:h-4 sm:w-4 text-blue-600" />
          </CardHeader>
          <CardContent className="px-3 sm:px-6 pb-3 sm:pb-4">
            <div className="text-lg sm:text-xl md:text-2xl font-bold text-blue-900">
              {formatCurrency(overallStats.totalBudget, userCurrency)}
            </div>
            <p className="text-xs text-blue-700 mt-0.5 sm:mt-1">
              Across {budgetStats.length} budgets
            </p>
          </CardContent>
        </Card>
        
        <Card className="bg-gradient-to-br from-green-50 to-emerald-100 border-green-200 shadow-sm">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-1 sm:pb-2 px-3 sm:px-6 pt-3 sm:pt-4">
            <CardTitle className="text-xs sm:text-sm font-medium text-green-900">On Track</CardTitle>
            <Target className="h-3.5 w-3.5 sm:h-4 sm:w-4 text-green-600" />
          </CardHeader>
          <CardContent className="px-3 sm:px-6 pb-3 sm:pb-4">
            <div className="text-lg sm:text-xl md:text-2xl font-bold text-green-900">
              {overallStats.onTrackCount}
            </div>
            <p className="text-xs text-green-700 mt-0.5 sm:mt-1">
              Budgets within limits
            </p>
          </CardContent>
        </Card>
        
        <Card className="bg-gradient-to-br from-yellow-50 to-amber-100 border-yellow-200 shadow-sm">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-1 sm:pb-2 px-3 sm:px-6 pt-3 sm:pt-4">
            <CardTitle className="text-xs sm:text-sm font-medium text-yellow-900">Warning</CardTitle>
            <AlertTriangle className="h-3.5 w-3.5 sm:h-4 sm:w-4 text-yellow-600" />
          </CardHeader>
          <CardContent className="px-3 sm:px-6 pb-3 sm:pb-4">
            <div className="text-lg sm:text-xl md:text-2xl font-bold text-yellow-900">
              {overallStats.warningCount}
            </div>
            <p className="text-xs text-yellow-700 mt-0.5 sm:mt-1">
              Near budget limit
            </p>
          </CardContent>
        </Card>
        
        <Card className="bg-gradient-to-br from-red-50 to-rose-100 border-red-200 shadow-sm">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-1 sm:pb-2 px-3 sm:px-6 pt-3 sm:pt-4">
            <CardTitle className="text-xs sm:text-sm font-medium text-red-900">Over Budget</CardTitle>
            <TrendingDown className="h-3.5 w-3.5 sm:h-4 sm:w-4 text-red-600" />
          </CardHeader>
          <CardContent className="px-3 sm:px-6 pb-3 sm:pb-4">
            <div className="text-lg sm:text-xl md:text-2xl font-bold text-red-900">
              {overallStats.overBudgetCount}
            </div>
            <p className="text-xs text-red-700 mt-0.5 sm:mt-1">
              Exceeded limit
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Budget Alerts */}
      {(overallStats.overBudgetCount > 0 || overallStats.warningCount > 0) && (
        <div className="space-y-2 sm:space-y-3">
          {budgetStats.filter(b => b.status === "overbudget").map(budget => (
            <Alert key={budget.id} className="border-red-200 bg-red-50 p-2 sm:p-4">
              <AlertTriangle className="h-3.5 w-3.5 sm:h-4 sm:w-4 text-red-600" />
              <AlertDescription className="text-red-800 text-xs sm:text-sm ml-2">
                <strong>{budget.category?.name}</strong> budget exceeded by {formatCurrency(budget.spent - budget.amount, userCurrency)}
              </AlertDescription>
            </Alert>
          ))}
          {budgetStats.filter(b => b.status === "warning").map(budget => (
            <Alert key={budget.id} className="border-yellow-200 bg-yellow-50 p-2 sm:p-4">
              <AlertTriangle className="h-3.5 w-3.5 sm:h-4 sm:w-4 text-yellow-600" />
              <AlertDescription className="text-yellow-800 text-xs sm:text-sm ml-2">
                <strong>{budget.category?.name}</strong> budget at {budget.percentUsed.toFixed(1)}% ({formatCurrency(budget.remaining, userCurrency)} remaining)
              </AlertDescription>
            </Alert>
          ))}
        </div>
      )}
      
      {/* Filters */}
      <Tabs defaultValue="monthly" onValueChange={setSelectedPeriod}>
        <TabsList className="grid w-full grid-cols-4 p-0.5">
          <TabsTrigger value="all" className="text-xs sm:text-sm py-1.5 sm:py-2">All</TabsTrigger>
          <TabsTrigger value="weekly" className="text-xs sm:text-sm py-1.5 sm:py-2">Weekly</TabsTrigger>
          <TabsTrigger value="monthly" className="text-xs sm:text-sm py-1.5 sm:py-2">Monthly</TabsTrigger>
          <TabsTrigger value="yearly" className="text-xs sm:text-sm py-1.5 sm:py-2">Yearly</TabsTrigger>
        </TabsList>
      </Tabs>

      {/* Budget Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-4 md:gap-6">
        {filteredBudgets.map((budget) => (
          <Card key={budget.id} className="overflow-hidden hover:shadow-lg transition-shadow shadow-sm">
            <CardHeader className="pb-2 sm:pb-3 px-3 sm:px-6 pt-3 sm:pt-4">
              <div className="flex flex-wrap sm:flex-nowrap items-start sm:items-center justify-between gap-2 sm:gap-0">
                <div className="flex items-center gap-2 sm:gap-3">
                  <div 
                    className="w-8 h-8 sm:w-10 sm:h-10 rounded-full flex items-center justify-center text-white font-semibold"
                    style={{ backgroundColor: budget.category?.color }}
                  >
                    {budget.category?.icon}
                  </div>
                  <div>
                    <CardTitle className="text-base sm:text-lg">{budget.category?.name}</CardTitle>
                    <CardDescription className="flex items-center gap-1 text-xs">
                      <Calendar className="w-2.5 h-2.5 sm:w-3 sm:h-3" />
                      {budget.period.charAt(0).toUpperCase() + budget.period.slice(1)}
                    </CardDescription>
                  </div>
                </div>
                <Badge className="text-xs py-0.5" variant={(() => {
                  if (budget.status === "good") return "default";
                  if (budget.status === "warning") return "secondary";
                  return "destructive";
                })()}>
                  {(() => {
                    if (budget.status === "good") return "On Track";
                    if (budget.status === "warning") return "Warning";
                    return "Over Budget";
                  })()}
                </Badge>
              </div>
            </CardHeader>
            
            <CardContent className="space-y-3 sm:space-y-4 px-3 sm:px-6 pb-3 sm:pb-4">
              <div className="space-y-2">
                <div className="flex justify-between text-xs sm:text-sm">
                  <span className="text-muted-foreground">Spent</span>
                  <span className="font-medium">{formatCurrency(budget.spent, userCurrency)}</span>
                </div>
                <Progress 
                  value={Math.min(budget.percentUsed, 100)} 
                  className="h-1.5 sm:h-2"
                />
                <div className="flex flex-col sm:flex-row sm:justify-between text-xs sm:text-sm">
                  <span className="text-muted-foreground truncate">
                    {formatCurrency(budget.spent, userCurrency)} of {formatCurrency(budget.amount, userCurrency)}
                  </span>
                  <span className={`font-medium ${budget.remaining >= 0 ? 'text-green-600' : 'text-red-600'} mt-1 sm:mt-0`}>
                    {formatCurrency(Math.abs(budget.remaining), userCurrency)} {budget.remaining >= 0 ? 'left' : 'over'}
                  </span>
                </div>
              </div>
              
              <div className="flex flex-wrap sm:flex-nowrap justify-between items-center pt-2 border-t gap-2 sm:gap-0">
                <div className="text-xs text-muted-foreground">
                  {format(new Date(budget.startDate * 1000), "MMM dd")} - {format(new Date(budget.endDate * 1000), "MMM dd")}
                </div>
                <div className="flex gap-2">
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => {
                      setEditingBudget(budget);
                      setIsCreateDialogOpen(true);
                    }}
                    className="h-7 w-7 sm:h-8 sm:w-8 p-0"
                  >
                    <Edit3 className="w-2.5 h-2.5 sm:w-3 sm:h-3" />
                  </Button>
                  <AlertDialog>
                    <AlertDialogTrigger asChild>
                      <Button
                        size="sm"
                        variant="outline"
                        disabled={deleteBudgetMutation.isPending}
                        className="h-7 w-7 sm:h-8 sm:w-8 p-0"
                      >
                        <Trash2 className="w-2.5 h-2.5 sm:w-3 sm:h-3" />
                      </Button>
                    </AlertDialogTrigger>
                    <AlertDialogContent>
                      <AlertDialogHeader>
                        <AlertDialogTitle>Delete Budget</AlertDialogTitle>
                        <AlertDialogDescription>
                          Are you sure you want to delete this budget for "{budget.category?.name}"? 
                          This action cannot be undone.
                        </AlertDialogDescription>
                      </AlertDialogHeader>
                      <AlertDialogFooter>
                        <AlertDialogCancel>Cancel</AlertDialogCancel>
                        <AlertDialogAction
                          onClick={() => deleteBudgetMutation.mutate(budget.id)}
                          className="bg-red-600 hover:bg-red-700"
                        >
                          Delete
                        </AlertDialogAction>
                      </AlertDialogFooter>
                    </AlertDialogContent>
                  </AlertDialog>
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Empty State */}
      {filteredBudgets.length === 0 && (
        <Card className="text-center py-6 sm:py-8 md:py-12 shadow-sm">
          <CardContent>
            <Target className="w-10 h-10 sm:w-12 sm:h-12 text-muted-foreground mx-auto mb-3 sm:mb-4" />
            <CardTitle className="mb-1 sm:mb-2 text-base sm:text-lg">No budgets found</CardTitle>
            <CardDescription className="mb-3 sm:mb-4 text-xs sm:text-sm max-w-md mx-auto">
              {selectedPeriod === "all" 
                ? "Create your first budget to start tracking your spending goals."
                : `No ${selectedPeriod} budgets found. Try a different period or create a new budget.`
              }
            </CardDescription>
            <Button onClick={() => setIsCreateDialogOpen(true)} className="h-9 text-xs sm:text-sm">
              <Plus className="w-3.5 h-3.5 sm:w-4 sm:h-4 mr-1.5 sm:mr-2" />
              Create Budget
            </Button>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
