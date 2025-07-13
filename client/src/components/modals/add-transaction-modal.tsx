import { useState, useEffect } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { isUnauthorizedError } from "@/lib/authUtils";
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
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Upload, Brain, Loader2, Camera, Mic } from "lucide-react";

const transactionSchema = z.object({
  description: z.string().min(1, "Description is required"),
  amount: z.string().min(1, "Amount is required").refine(
    (val) => !isNaN(parseFloat(val)) && parseFloat(val) > 0,
    "Amount must be a positive number"
  ),
  categoryId: z.string().min(1, "Category is required"),
  type: z.enum(["income", "expense"]),
  currency: z.string().default("USD"),
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
}: AddTransactionModalProps) {
  const [receiptFile, setReceiptFile] = useState<File | null>(null);
  const [aiText, setAiText] = useState("");
  const [isProcessingReceipt, setIsProcessingReceipt] = useState(false);
  const [isAnalyzingText, setIsAnalyzingText] = useState(false);
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
      description: editingTransaction?.description || "",
      amount: editingTransaction?.amount?.toString() || "",
      categoryId: editingTransaction?.categoryId?.toString() || "",
      type: editingTransaction?.type || "expense",
      currency: editingTransaction?.currency || "USD",
      date: editingTransaction?.date ? 
        new Date(editingTransaction.date).toISOString().split('T')[0] : 
        new Date().toISOString().split('T')[0],
    },
  });

  // Reset states when modal is closed
  useEffect(() => {
    if (!isOpen) {
      setReceiptFile(null);
      setAiText("");
      setIsProcessingReceipt(false);
      setIsAnalyzingText(false);
      form.reset();
    }
  }, [isOpen, form]);

  // Update form when editing transaction changes
  useEffect(() => {
    if (editingTransaction && isEditing) {
      form.reset({
        description: editingTransaction.description || "",
        amount: editingTransaction.amount?.toString() || "",
        categoryId: editingTransaction.categoryId?.toString() || "",
        type: editingTransaction.type || "expense",
        currency: editingTransaction.currency || "USD",
        date: editingTransaction.date ? 
          new Date(editingTransaction.date).toISOString().split('T')[0] : 
          new Date().toISOString().split('T')[0],
      });
    }
  }, [editingTransaction, isEditing, form]);

  const { data: categories } = useQuery({
    queryKey: ["/api/categories"],
    enabled: isOpen,
  });

  const transactionMutation = useMutation({
    mutationFn: async (data: TransactionFormData) => {
      const payload = {
        ...data,
        amount: parseFloat(data.amount),
        categoryId: parseInt(data.categoryId),
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
      queryClient.invalidateQueries({ queryKey: ["/api/transactions"] });
      queryClient.invalidateQueries({ queryKey: ["/api/analytics/dashboard"] });
      
      const transactionName = form.getValues('description');
      if (isEditing) {
        showToast('success', '🔄 Transaction Updated!', `"${transactionName}" has been successfully updated`);
      } else {
        showToast('success', '✨ Transaction Created!', `"${transactionName}" has been successfully added`);
      }
      
      form.reset();
      onClose();
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

  const analyzeTextMutation = useMutation({
    mutationFn: async (text: string) => {
      const response = await apiRequest("POST", "/api/transactions/analyze", {
        text,
      });
      return response.json();
    },
    onSuccess: (data) => {
      setIsAnalyzingText(false);
      if (data.transaction) {
        toast({
          title: "🤖 Transaction Created Successfully",
          description: `AI automatically analyzed and created transaction for ${data.transaction.description}`,
          className: "bg-green-50 border-green-200",
        });
        queryClient.invalidateQueries({ queryKey: ["/api/transactions"] });
        queryClient.invalidateQueries({ queryKey: ["/api/analytics/dashboard"] });
        form.reset();
        setAiText("");
        onClose();
      } else if (data.analysis) {
        // Fill form with AI analysis
        const analysis = data.analysis;
        form.setValue("description", analysis.description);
        form.setValue("amount", analysis.amount.toString());
        form.setValue("type", analysis.type);
        
        // Find matching category
        const matchingCategory = categories?.find((cat: any) => 
          cat.name.toLowerCase() === analysis.category.toLowerCase()
        );
        if (matchingCategory) {
          form.setValue("categoryId", matchingCategory.id.toString());
        }
        
        toast({
          title: "🧠 AI Analysis Complete",
          description: `Smart analysis filled transaction details: ${analysis.description} - ${analysis.amount}`,
          className: "bg-blue-50 border-blue-200",
        });
      }
    },
    onError: (error) => {
      setIsAnalyzingText(false);
      if (isUnauthorizedError(error)) {
        toast({
          title: "🔐 Unauthorized Access",
          description: "Session expired. Redirecting to login...",
          variant: "destructive",
          className: "bg-red-50 border-red-200",
        });
        setTimeout(() => {
          window.location.href = "/auth";
        }, 500);
        return;
      }
      toast({
        title: "🚫 AI Analysis Failed",
        description: "Unable to analyze transaction with AI. Please try again or enter manually.",
        variant: "destructive",
        className: "bg-red-50 border-red-200",
      });
    },
  });

  const processReceiptMutation = useMutation({
    mutationFn: async (file: File) => {
      const formData = new FormData();
      formData.append("receipt", file);
      
      const response = await fetch("/api/transactions/ocr", {
        method: "POST",
        body: formData,
        credentials: "include",
      });
      
      if (!response.ok) {
        throw new Error("Failed to process receipt");
      }
      
      return response.json();
    },
    onSuccess: (data) => {
      setIsProcessingReceipt(false);
      if (data.createdTransactions && data.createdTransactions.length > 0) {
        showToast('success', '📄 Receipt Processed Successfully', 
          `Created ${data.createdTransactions.length} transaction${data.createdTransactions.length > 1 ? 's' : ''} from receipt`);
        queryClient.invalidateQueries({ queryKey: ["/api/transactions"] });
        queryClient.invalidateQueries({ queryKey: ["/api/analytics/dashboard"] });
        form.reset();
        setReceiptFile(null);
        onClose();
      } else {
        showToast('warning', '📄 Receipt Analyzed', 'Receipt processed but no valid transactions were found');
      }
    },
    onError: (error) => {
      setIsProcessingReceipt(false);
      showToast('error', '🚫 Receipt Processing Failed', 'Unable to process receipt. Please try again or enter manually');
    },
  });

  const handleReceiptUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      setReceiptFile(file);
      setIsProcessingReceipt(true);
      processReceiptMutation.mutate(file);
    }
  };

  const handleAiAnalysis = () => {
    if (!aiText.trim()) {
      showToast('error', '📝 Text Required', 'Please enter some text to analyze');
      return;
    }
    
    setIsAnalyzingText(true);
    analyzeTextMutation.mutate(aiText);
  };

  const onSubmit = (data: TransactionFormData) => {
    transactionMutation.mutate(data);
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-[500px] max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <div className="bg-primary/10 p-2 rounded-full">
              {isEditing ? (
                <span className="text-lg">✏️</span>
              ) : (
                <span className="text-lg">➕</span>
              )}
            </div>
            {isEditing ? 'Edit Transaction' : 'Add Transaction'}
          </DialogTitle>
          <DialogDescription>
            {isEditing 
              ? 'Update transaction details or use AI to re-analyze text/receipts'
              : 'Create a new transaction manually or use AI to analyze text/receipts'
            }
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6">
          {/* AI Text Analysis */}
          <div className="space-y-3">
            <div className="flex items-center gap-2">
              <Brain className="h-4 w-4 text-primary" />
              <span className="text-sm font-medium">AI Analysis</span>
              <Badge variant="secondary" className="text-xs">Smart</Badge>
            </div>
            <div className="flex gap-2">
              <Textarea
                placeholder="Describe your transaction... (e.g., 'I spent $25 on lunch at McDonald's')"
                value={aiText}
                onChange={(e) => setAiText(e.target.value)}
                className="flex-1"
                rows={2}
              />
              <Button
                type="button"
                variant="outline"
                onClick={handleAiAnalysis}
                disabled={isAnalyzingText || analyzeTextMutation.isPending}
                className="self-start"
              >
                {isAnalyzingText || analyzeTextMutation.isPending ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Brain className="h-4 w-4" />
                )}
              </Button>
            </div>
          </div>

          {/* Receipt Upload */}
          <div className="space-y-3">
            <div className="flex items-center gap-2">
              <Camera className="h-4 w-4 text-primary" />
              <span className="text-sm font-medium">Receipt Upload</span>
              <Badge variant="secondary" className="text-xs">OCR</Badge>
            </div>
            <div className="border-2 border-dashed border-gray-300 rounded-lg p-6 text-center hover:border-primary transition-colors">
              <Upload className="h-8 w-8 text-gray-400 mx-auto mb-2" />
              <p className="text-sm text-gray-600 mb-2">
                {receiptFile ? receiptFile.name : "Drag and drop or click to upload receipt"}
              </p>
              <input
                type="file"
                accept="image/*"
                onChange={handleReceiptUpload}
                className="hidden"
                id="receipt-upload"
                disabled={isProcessingReceipt || processReceiptMutation.isPending}
              />
              <Button
                type="button"
                variant="outline"
                onClick={() => document.getElementById("receipt-upload")?.click()}
                disabled={isProcessingReceipt || processReceiptMutation.isPending}
                className="mt-2"
              >
                {isProcessingReceipt || processReceiptMutation.isPending ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin mr-2" />
                    Processing...
                  </>
                ) : (
                  <>
                    <Upload className="h-4 w-4 mr-2" />
                    Choose File
                  </>
                )}
              </Button>
            </div>
          </div>

          {/* Manual Form */}
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
              <FormField
                control={form.control}
                name="description"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Description</FormLabel>
                    <FormControl>
                      <Input placeholder="Enter transaction description" {...field} />
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
                      <FormLabel>Amount</FormLabel>
                      <FormControl>
                        <Input
                          type="number"
                          step="0.01"
                          placeholder="0.00"
                          {...field}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="currency"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Currency</FormLabel>
                      <Select onValueChange={field.onChange} defaultValue={field.value}>
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder="Select currency" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          <SelectItem value="USD">USD</SelectItem>
                          <SelectItem value="EUR">EUR</SelectItem>
                          <SelectItem value="IDR">IDR</SelectItem>
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <FormField
                  control={form.control}
                  name="type"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Type</FormLabel>
                      <Select onValueChange={field.onChange} defaultValue={field.value}>
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder="Select type" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          <SelectItem value="expense">Expense</SelectItem>
                          <SelectItem value="income">Income</SelectItem>
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="categoryId"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Category</FormLabel>
                      <Select onValueChange={field.onChange} value={field.value}>
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder="Select category" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          {categories?.map((category: any) => (
                            <SelectItem key={category.id} value={category.id.toString()}>
                              <div className="flex items-center gap-2">
                                <i className={`${category.icon} text-sm`} />
                                {category.name}
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

              <FormField
                control={form.control}
                name="date"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Date</FormLabel>
                    <FormControl>
                      <Input type="date" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <div className="flex space-x-3 pt-4">
                <Button
                  type="button"
                  variant="outline"
                  onClick={onClose}
                  className="flex-1"
                  disabled={transactionMutation.isPending}
                >
                  Cancel
                </Button>
                <Button
                  type="submit"
                  className="flex-1 bg-primary hover:bg-primary/90"
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
                          <span className="mr-2">➕</span>
                          Add Transaction
                        </>
                      )}
                    </>
                  )}
                </Button>
              </div>
            </form>
          </Form>
        </div>
      </DialogContent>
    </Dialog>
  );
}
