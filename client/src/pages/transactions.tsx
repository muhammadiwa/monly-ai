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
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Trash2, Edit, Search, Filter, Plus, DollarSign } from "lucide-react";
import AddTransactionModal from "@/components/modals/add-transaction-modal";

export default function Transactions() {
  const { toast } = useToast();
  const { isAuthenticated, isLoading } = useAuth();
  const [showAddTransaction, setShowAddTransaction] = useState(false);
  const [showEditTransaction, setShowEditTransaction] = useState(false);
  const [editingTransaction, setEditingTransaction] = useState<any>(null);
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [transactionToDelete, setTransactionToDelete] = useState<any>(null);
  const [searchTerm, setSearchTerm] = useState("");

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
    
    toast({
      title,
      description: finalDescription,
      variant: variants[type],
      duration: type === 'error' ? 5000 : 3000,
      className: type === 'success' ? 'border-green-200 bg-green-50' : 
                 type === 'warning' ? 'border-yellow-200 bg-yellow-50' : '',
    });
  };

  const { data: transactions, isLoading: transactionsLoading } = useQuery({
    queryKey: ["/api/transactions"],
    retry: false,
    enabled: isAuthenticated,
  });

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

  const filteredTransactions = (transactions as any[])?.filter((transaction: any) =>
    transaction.description?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    transaction.category?.name?.toLowerCase().includes(searchTerm.toLowerCase())
  ) || [];

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
    <div className="px-4 py-6 sm:px-6 lg:px-8">
      {/* Header */}
      <div className="mb-8">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Transactions</h1>
            <p className="mt-1 text-sm text-gray-500">Manage your financial transactions</p>
          </div>
          <Button 
            className="bg-primary hover:bg-primary/90"
            onClick={() => setShowAddTransaction(true)}
          >
            <Plus className="w-4 h-4 mr-2" />
            Add Transaction
          </Button>
        </div>

        {/* Search and Filter */}
        <div className="flex flex-col sm:flex-row gap-4">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
            <Input
              placeholder="Search transactions..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-10"
            />
          </div>
          <Button variant="outline" className="flex items-center gap-2">
            <Filter className="w-4 h-4" />
            Filter
          </Button>
        </div>
      </div>

      {/* Transactions List */}
      <Card>
            <CardHeader>
              <CardTitle>All Transactions</CardTitle>
            </CardHeader>
            <CardContent>
              {filteredTransactions.length === 0 ? (
                <div className="text-center py-12">
                  <p className="text-gray-500 mb-4">No transactions found</p>
                  <Button onClick={() => setShowAddTransaction(true)}>
                    Add your first transaction
                  </Button>
                </div>
              ) : (
                <div className="space-y-4">
                  {filteredTransactions.map((transaction: any) => (
                    <div
                      key={transaction.id}
                      className="flex items-center justify-between p-4 border rounded-lg hover:bg-gray-50 transition-colors"
                    >
                      <div className="flex items-center space-x-4">
                        <div className="w-12 h-12 rounded-lg bg-primary/10 flex items-center justify-center">
                          <span className="text-xl">
                            {transaction.category?.icon || '💰'}
                          </span>
                        </div>
                        <div>
                          <p className="font-medium text-gray-900">{transaction.description}</p>
                          <div className="flex items-center space-x-2 mt-1">
                            <Badge variant="outline" className={`${
                              transaction.type === 'income' 
                                ? 'border-green-200 bg-green-50 text-green-700' 
                                : 'border-red-200 bg-red-50 text-red-700'
                            }`}>
                              {transaction.category?.name || 'Uncategorized'}
                            </Badge>
                            <span className="text-xs text-gray-500">
                              {new Date(transaction.date).toLocaleDateString('en-US', {
                                month: 'short',
                                day: 'numeric',
                                year: 'numeric'
                              })}
                            </span>
                            {transaction.aiGenerated && (
                              <Badge variant="secondary" className="text-xs bg-purple-100 text-purple-700">
                                🤖 AI
                              </Badge>
                            )}
                          </div>
                        </div>
                      </div>
                      <div className="flex items-center space-x-4">
                        <p className={`font-semibold ${
                          transaction.type === 'income' ? 'text-green-600' : 'text-red-600'
                        }`}>
                          {transaction.type === 'income' ? '+' : '-'}${transaction.amount}
                        </p>
                        <div className="flex items-center space-x-2">
                          <Button 
                            variant="ghost" 
                            size="sm"
                            onClick={() => handleEdit(transaction)}
                            className="hover:bg-blue-50 hover:text-blue-600"
                          >
                            <Edit className="w-4 h-4" />
                          </Button>
                          <Button 
                            variant="ghost" 
                            size="sm"
                            onClick={() => handleDelete(transaction)}
                            className="hover:bg-red-50 hover:text-red-600"
                          >
                            <Trash2 className="w-4 h-4" />
                          </Button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
      
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
        }}
        editingTransaction={editingTransaction}
        isEditing={true}
      />

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen}>
        <AlertDialogContent className="sm:max-w-md">
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              <div className="w-12 h-12 rounded-full bg-red-100 flex items-center justify-center">
                <Trash2 className="h-6 w-6 text-red-600" />
              </div>
              <div>
                <div className="text-lg font-semibold text-gray-900">Delete Transaction</div>
                <div className="text-sm text-gray-500">This action cannot be undone</div>
              </div>
            </AlertDialogTitle>
            <AlertDialogDescription className="space-y-3">
              {transactionToDelete && (
                <div className="bg-gray-50 rounded-lg p-4 border">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center">
                      <span className="text-lg">{transactionToDelete.category?.icon || '💰'}</span>
                    </div>
                    <div className="flex-1">
                      <div className="font-medium text-gray-900">{transactionToDelete.description}</div>
                      <div className="text-sm text-gray-500">
                        {transactionToDelete.category?.name || 'Uncategorized'} • {' '}
                        {new Date(transactionToDelete.date).toLocaleDateString()}
                      </div>
                    </div>
                    <div className={`font-semibold ${
                      transactionToDelete.type === 'income' ? 'text-green-600' : 'text-red-600'
                    }`}>
                      {transactionToDelete.type === 'income' ? '+' : '-'}${transactionToDelete.amount}
                    </div>
                  </div>
                </div>
              )}
              <p className="text-gray-600">
                Are you sure you want to delete this transaction? This action will permanently remove the transaction from your records.
              </p>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="flex gap-2 sm:gap-0">
            <AlertDialogCancel 
              className="hover:bg-gray-100"
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
                <div className="flex items-center gap-2">
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
  );
}
