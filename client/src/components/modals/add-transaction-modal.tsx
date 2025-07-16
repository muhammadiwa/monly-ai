import { useState, useEffect } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { isUnauthorizedError } from "@/lib/authUtils";
import { getUserCurrency, getCurrencySymbol } from "@/lib/currencyUtils";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent } from "@/components/ui/card";
import { TrendingUp, TrendingDown, Calendar, DollarSign, Tag, FileText, Loader2 } from "lucide-react";
import { DatePicker } from "@/components/ui/date-picker";

const transactionSchema = z.object({
  description: z.string().min(1, "Description is required"),
  amount: z.string().min(1, "Amount is required").refine(
    (val) => !isNaN(parseFloat(val)) && parseFloat(val) > 0,
    "Amount must be a positive number"
  ),
  categoryId: z.string().min(1, "Category is required"),
  type: z.enum(["income", "expense"]),
  date: z.string().min(1, "Date is required"),
});

type TransactionFormData = z.infer<typeof transactionSchema>;

interface AddTransactionModalProps {
  isOpen: boolean;
  onClose: () => void;
  editingTransaction?: any;
  isEditing?: boolean;
}

export default function AddTransactionModal({
  isOpen,
  onClose,
  editingTransaction,
  isEditing = false,
}: Readonly<AddTransactionModalProps>) {
  const [activeTab, setActiveTab] = useState<"income" | "expense">("expense");
  const { toast } = useToast();

  // Helper function for better toast notifications
  const showToast = (type: 'success' | 'error' | 'warning', title: string, description: string) => {
    const variants = {
      success: undefined,
      error: "destructive" as const,
      warning: "default" as const,
    };
    
    toast({
      title,
      description,
      variant: variants[type],
      duration: type === 'error' ? 5000 : 3000,
      className: type === 'success' ? 'border-green-200 bg-green-50' : 
                 type === 'warning' ? 'border-yellow-200 bg-yellow-50' : '',
    });
  };

  const form = useForm<TransactionFormData>({
    resolver: zodResolver(transactionSchema),
    defaultValues: {
      description: "",
      amount: "",
      categoryId: "",
      type: "expense",
      date: new Date().toISOString().split('T')[0],
    },
  });

  // Reset form when modal opens/closes
  useEffect(() => {
    if (!isOpen) {
      form.reset({
        description: "",
        amount: "",
        categoryId: "",
        type: "expense",
        date: new Date().toISOString().split('T')[0],
      });
      setActiveTab("expense");
    }
  }, [isOpen, form]);

  // Helper function untuk parsing tanggal (same as in transactions.tsx)
  const parseTransactionDate = (date: string | number): Date => {
    if (typeof date === 'number') {
      return date > 9999999999 ? new Date(date) : new Date(date * 1000);
    }
    return new Date(date);
  };

  // Update form when editing transaction changes
  useEffect(() => {
    if (editingTransaction && isEditing) {
      const transactionType = editingTransaction.type || "expense";
      setActiveTab(transactionType);
      form.reset({
        description: editingTransaction.description || "",
        amount: editingTransaction.amount?.toString() || "",
        categoryId: editingTransaction.categoryId?.toString() || "",
        type: transactionType,
        date: editingTransaction.date ? 
          parseTransactionDate(editingTransaction.date).toISOString().split('T')[0] : 
          new Date().toISOString().split('T')[0],
      });
    }
  }, [editingTransaction, isEditing, form]);

  // Watch the active tab and update form type
  useEffect(() => {
    form.setValue("type", activeTab);
    form.setValue("categoryId", ""); // Reset category when switching tabs
  }, [activeTab, form]);

  const { data: categories } = useQuery({
    queryKey: ["/api/categories"],
    enabled: isOpen,
  });

  const { data: userPreferences } = useQuery({
    queryKey: ["/api/user/preferences"],
    enabled: isOpen,
  });

  // Filter categories based on active tab (transaction type)
  const filteredCategories = Array.isArray(categories) ? categories.filter((category: any) => 
    category.type === activeTab
  ) : [];

  const userCurrency = getUserCurrency(userPreferences);
  const currencySymbol = getCurrencySymbol(userCurrency);

  const transactionMutation = useMutation({
    mutationFn: async (data: TransactionFormData) => {
      const payload = {
        ...data,
        amount: parseFloat(data.amount),
        categoryId: parseInt(data.categoryId),
        currency: userCurrency, // Use user's preferred currency
        date: new Date(data.date).toISOString(),
      };
      
      if (isEditing && editingTransaction) {
        const response = await apiRequest("PUT", `/api/transactions/${editingTransaction.id}`, payload);
        return response.json();
      } else {
        const response = await apiRequest("POST", "/api/transactions", payload);
        return response.json();
      }
    },
    onSuccess: (data) => {
      // Invalidate multiple related queries to ensure UI updates
      queryClient.invalidateQueries({ queryKey: ["/api/transactions"] });
      queryClient.invalidateQueries({ queryKey: ["/api/analytics/dashboard"] });
      queryClient.invalidateQueries({ queryKey: ["/api/categories"] });
      
      // Force immediate refetch with fresh data
      queryClient.refetchQueries({ 
        queryKey: ["/api/transactions"],
        type: 'all' 
      });
      
      const transactionName = form.getValues('description');
      if (isEditing) {
        showToast('success', '🔄 Transaction Updated!', `"${transactionName}" has been successfully updated and will appear in your transaction list`);
      } else {
        showToast('success', '✨ Transaction Created!', `"${transactionName}" has been successfully added`);
      }
      
      // Reset form and close modal
      form.reset({
        description: "",
        amount: "",
        categoryId: "",
        type: "expense",
        date: new Date().toISOString().split('T')[0],
      });
      setActiveTab("expense");
      
      // Small delay to ensure data is refreshed before closing
      setTimeout(() => {
        onClose();
      }, 100);
    },
    onError: (error) => {
      if (isUnauthorizedError(error)) {
        showToast('error', '🔐 Session Expired', 'Please login again to continue');
        setTimeout(() => {
          window.location.href = "/auth";
        }, 2000);
        return;
      }
      
      const errorMessage = error instanceof Error ? error.message : 
        `Failed to ${isEditing ? 'update' : 'create'} transaction`;
      showToast('error', `❌ ${isEditing ? 'Update' : 'Creation'} Failed`, errorMessage);
    },
  });

  const onSubmit = (data: TransactionFormData) => {
    transactionMutation.mutate(data);
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-[600px] max-h-[95vh] overflow-hidden bg-white/95 backdrop-blur-xl border-white/20 rounded-3xl shadow-2xl">
        <DialogHeader className="text-center pb-2">
          <div className="mx-auto w-16 h-16 bg-gradient-to-br from-blue-500 to-purple-600 rounded-full flex items-center justify-center mb-4 shadow-lg">
            {isEditing ? (
              <span className="text-white text-2xl">✏️</span>
            ) : (
              <span className="text-white text-2xl">💰</span>
            )}
          </div>
          <DialogTitle className="text-2xl font-bold bg-gradient-to-r from-slate-900 via-blue-900 to-indigo-900 bg-clip-text text-transparent">
            {isEditing ? 'Edit Transaction' : 'Add New Transaction'}
          </DialogTitle>
          <DialogDescription className="text-slate-600 text-base">
            {isEditing 
              ? 'Update your transaction details'
              : 'Track your income and expenses manually'
            }
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6 overflow-y-auto max-h-[calc(95vh-200px)] px-1">
          {/* Transaction Type Tabs */}
          <Tabs value={activeTab} onValueChange={(value) => setActiveTab(value as "income" | "expense")} className="w-full">
            <TabsList className="grid w-full grid-cols-2 bg-slate-100 rounded-2xl p-1">
              <TabsTrigger 
                value="expense" 
                className="flex items-center gap-2 rounded-xl data-[state=active]:bg-gradient-to-r data-[state=active]:from-red-500 data-[state=active]:to-pink-600 data-[state=active]:text-white data-[state=active]:shadow-lg transition-all duration-200"
              >
                <TrendingDown className="w-4 h-4" />
                <span className="font-medium">Expense</span>
              </TabsTrigger>
              <TabsTrigger 
                value="income"
                className="flex items-center gap-2 rounded-xl data-[state=active]:bg-gradient-to-r data-[state=active]:from-emerald-500 data-[state=active]:to-green-600 data-[state=active]:text-white data-[state=active]:shadow-lg transition-all duration-200"
              >
                <TrendingUp className="w-4 h-4" />
                <span className="font-medium">Income</span>
              </TabsTrigger>
            </TabsList>

            <Form {...form}>
              <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6 pt-4">
                <TabsContent value="expense" className="mt-0 space-y-6">
                  <Card className="bg-gradient-to-br from-red-50 to-pink-50 border-red-200 shadow-sm">
                    <CardContent className="p-6">
                      <div className="flex items-center gap-3 mb-4">
                        <div className="w-10 h-10 bg-gradient-to-br from-red-500 to-pink-600 rounded-full flex items-center justify-center">
                          <TrendingDown className="w-5 h-5 text-white" />
                        </div>
                        <div>
                          <h3 className="font-semibold text-red-700">Expense Transaction</h3>
                          <p className="text-sm text-red-600">Record money you've spent</p>
                        </div>
                      </div>
                      
                      {/* Form Fields for Expense */}
                      <div className="space-y-4">
                        <FormField
                          control={form.control}
                          name="description"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel className="flex items-center gap-2 text-slate-700 font-medium">
                                <FileText className="w-4 h-4" />
                                Description
                              </FormLabel>
                              <FormControl>
                                <Input 
                                  placeholder="What did you spend on? (e.g., Lunch at restaurant)" 
                                  {...field} 
                                  className="bg-white/70 border-red-200 focus:border-red-400 focus:ring-red-200 rounded-xl"
                                />
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />

                        <div className="grid grid-cols-2 gap-4">
                          <FormField
                            control={form.control}
                            name="amount"
                            render={({ field }) => (
                              <FormItem>
                                <FormLabel className="flex items-center gap-2 text-slate-700 font-medium">
                                  <DollarSign className="w-4 h-4" />
                                  Amount
                                </FormLabel>
                                <FormControl>
                                  <div className="relative">
                                    <span className="absolute left-3 top-1/2 transform -translate-y-1/2 text-slate-500 font-medium">
                                      {currencySymbol}
                                    </span>
                                    <Input
                                      type="number"
                                      step="0.01"
                                      placeholder="0.00"
                                      {...field}
                                      className="pl-8 bg-white/70 border-red-200 focus:border-red-400 focus:ring-red-200 rounded-xl"
                                    />
                                  </div>
                                </FormControl>
                                <FormMessage />
                              </FormItem>
                            )}
                          />

                          <FormField
                            control={form.control}
                            name="date"
                            render={({ field }) => (
                              <FormItem>
                                <FormLabel className="flex items-center gap-2 text-slate-700 font-medium">
                                  <Calendar className="w-4 h-4" />
                                  Date
                                </FormLabel>
                                <FormControl>
                                  <DatePicker
                                    date={field.value ? new Date(field.value) : undefined}
                                    onDateChange={(date) => {
                                      field.onChange(date ? date.toISOString().split('T')[0] : '')
                                    }}
                                    placeholder="Select transaction date"
                                    className="bg-white/70 border-red-200 focus:border-red-400 focus:ring-red-200 rounded-xl"
                                  />
                                </FormControl>
                                <FormMessage />
                              </FormItem>
                            )}
                          />
                        </div>

                        <FormField
                          control={form.control}
                          name="categoryId"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel className="flex items-center gap-2 text-slate-700 font-medium">
                                <Tag className="w-4 h-4" />
                                Category
                              </FormLabel>
                              <Select onValueChange={field.onChange} value={field.value}>
                                <FormControl>
                                  <SelectTrigger className="bg-white/70 border-red-200 focus:border-red-400 focus:ring-red-200 rounded-xl">
                                    <SelectValue placeholder="Select expense category" />
                                  </SelectTrigger>
                                </FormControl>
                                <SelectContent className="rounded-xl">
                                  {filteredCategories.map((category: any) => (
                                    <SelectItem key={category.id} value={category.id.toString()}>
                                      <div className="flex items-center gap-3">
                                        <span className="text-lg">{category.icon}</span>
                                        <span>{category.name}</span>
                                      </div>
                                    </SelectItem>
                                  ))}
                                </SelectContent>
                              </Select>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                      </div>
                    </CardContent>
                  </Card>
                </TabsContent>

                <TabsContent value="income" className="mt-0 space-y-6">
                  <Card className="bg-gradient-to-br from-emerald-50 to-green-50 border-emerald-200 shadow-sm">
                    <CardContent className="p-6">
                      <div className="flex items-center gap-3 mb-4">
                        <div className="w-10 h-10 bg-gradient-to-br from-emerald-500 to-green-600 rounded-full flex items-center justify-center">
                          <TrendingUp className="w-5 h-5 text-white" />
                        </div>
                        <div>
                          <h3 className="font-semibold text-emerald-700">Income Transaction</h3>
                          <p className="text-sm text-emerald-600">Record money you've received</p>
                        </div>
                      </div>
                      
                      {/* Form Fields for Income */}
                      <div className="space-y-4">
                        <FormField
                          control={form.control}
                          name="description"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel className="flex items-center gap-2 text-slate-700 font-medium">
                                <FileText className="w-4 h-4" />
                                Description
                              </FormLabel>
                              <FormControl>
                                <Input 
                                  placeholder="Where did this income come from? (e.g., Salary, Freelance work)" 
                                  {...field} 
                                  className="bg-white/70 border-emerald-200 focus:border-emerald-400 focus:ring-emerald-200 rounded-xl"
                                />
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />

                        <div className="grid grid-cols-2 gap-4">
                          <FormField
                            control={form.control}
                            name="amount"
                            render={({ field }) => (
                              <FormItem>
                                <FormLabel className="flex items-center gap-2 text-slate-700 font-medium">
                                  <DollarSign className="w-4 h-4" />
                                  Amount
                                </FormLabel>
                                <FormControl>
                                  <div className="relative">
                                    <span className="absolute left-3 top-1/2 transform -translate-y-1/2 text-slate-500 font-medium">
                                      {currencySymbol}
                                    </span>
                                    <Input
                                      type="number"
                                      step="0.01"
                                      placeholder="0.00"
                                      {...field}
                                      className="pl-8 bg-white/70 border-emerald-200 focus:border-emerald-400 focus:ring-emerald-200 rounded-xl"
                                    />
                                  </div>
                                </FormControl>
                                <FormMessage />
                              </FormItem>
                            )}
                          />

                          <FormField
                            control={form.control}
                            name="date"
                            render={({ field }) => (
                              <FormItem>
                                <FormLabel className="flex items-center gap-2 text-slate-700 font-medium">
                                  <Calendar className="w-4 h-4" />
                                  Date
                                </FormLabel>
                                <FormControl>
                                  <DatePicker
                                    date={field.value ? new Date(field.value) : undefined}
                                    onDateChange={(date) => {
                                      field.onChange(date ? date.toISOString().split('T')[0] : '')
                                    }}
                                    placeholder="Select transaction date"
                                    className="bg-white/70 border-emerald-200 focus:border-emerald-400 focus:ring-emerald-200 rounded-xl"
                                  />
                                </FormControl>
                                <FormMessage />
                              </FormItem>
                            )}
                          />
                        </div>

                        <FormField
                          control={form.control}
                          name="categoryId"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel className="flex items-center gap-2 text-slate-700 font-medium">
                                <Tag className="w-4 h-4" />
                                Category
                              </FormLabel>
                              <Select onValueChange={field.onChange} value={field.value}>
                                <FormControl>
                                  <SelectTrigger className="bg-white/70 border-emerald-200 focus:border-emerald-400 focus:ring-emerald-200 rounded-xl">
                                    <SelectValue placeholder="Select income category" />
                                  </SelectTrigger>
                                </FormControl>
                                <SelectContent className="rounded-xl">
                                  {filteredCategories.map((category: any) => (
                                    <SelectItem key={category.id} value={category.id.toString()}>
                                      <div className="flex items-center gap-3">
                                        <span className="text-lg">{category.icon}</span>
                                        <span>{category.name}</span>
                                      </div>
                                    </SelectItem>
                                  ))}
                                </SelectContent>
                              </Select>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                      </div>
                    </CardContent>
                  </Card>
                </TabsContent>

                {/* Action Buttons */}
                <div className="flex gap-3 pt-4 border-t border-slate-200">
                  <Button
                    type="button"
                    variant="outline"
                    onClick={onClose}
                    className="flex-1 bg-slate-100 hover:bg-slate-200 text-slate-700 border-slate-300 rounded-xl py-3 font-medium"
                    disabled={transactionMutation.isPending}
                  >
                    Cancel
                  </Button>
                  <Button
                    type="submit"
                    className={`flex-1 text-white border-0 rounded-xl py-3 font-medium shadow-lg transform hover:scale-105 transition-all duration-200 ${
                      activeTab === 'income' 
                        ? 'bg-gradient-to-r from-emerald-500 to-green-600 hover:from-emerald-600 hover:to-green-700'
                        : 'bg-gradient-to-r from-red-500 to-pink-600 hover:from-red-600 hover:to-pink-700'
                    }`}
                    disabled={transactionMutation.isPending}
                  >
                    {transactionMutation.isPending ? (
                      <>
                        <Loader2 className="h-4 w-4 animate-spin mr-2" />
                        {isEditing ? 'Updating...' : 'Creating...'}
                      </>
                    ) : (
                      <>
                        {isEditing ? (
                          <>
                            <span className="mr-2">✏️</span>
                            Update Transaction
                          </>
                        ) : (
                          <>
                            <span className="mr-2">{activeTab === 'income' ? '💰' : '💸'}</span>
                            Add {activeTab === 'income' ? 'Income' : 'Expense'}
                          </>
                        )}
                      </>
                    )}
                  </Button>
                </div>
              </form>
            </Form>
          </Tabs>
        </div>
      </DialogContent>
    </Dialog>
  );
}
