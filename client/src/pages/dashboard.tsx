import { useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";
import { isUnauthorizedError } from "@/lib/authUtils";
import Sidebar from "@/components/layout/sidebar";
import MobileHeader from "@/components/layout/mobile-header";
import MobileNav from "@/components/layout/mobile-nav";
import StatsCards from "@/components/dashboard/stats-cards";
import ExpenseChart from "@/components/dashboard/expense-chart";
import CategoryChart from "@/components/dashboard/category-chart";
import RecentTransactions from "@/components/dashboard/recent-transactions";
import AddTransactionModal from "@/components/modals/add-transaction-modal";
import WhatsAppChatModal from "@/components/modals/whatsapp-chat-modal";
import { useState } from "react";

export default function Dashboard() {
  const { toast } = useToast();
  const { isAuthenticated, isLoading } = useAuth();
  const [showAddTransaction, setShowAddTransaction] = useState(false);
  const [showWhatsAppChat, setShowWhatsAppChat] = useState(false);

  // Redirect to login if not authenticated
  useEffect(() => {
    if (!isLoading && !isAuthenticated) {
      toast({
        title: "Unauthorized",
        description: "You are logged out. Logging in again...",
        variant: "destructive",
      });
      setTimeout(() => {
        window.location.href = "/api/login";
      }, 500);
      return;
    }
  }, [isAuthenticated, isLoading, toast]);

  const { data: analyticsData, isLoading: analyticsLoading } = useQuery({
    queryKey: ["/api/analytics/dashboard"],
    retry: false,
    enabled: isAuthenticated,
  });

  if (isLoading || analyticsLoading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto mb-4"></div>
          <p className="text-gray-600">Loading your financial dashboard...</p>
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
          {/* Dashboard Header */}
          <div className="mb-8">
            <div className="flex items-center justify-between">
              <div>
                <h1 className="text-2xl font-bold text-gray-900">Financial Dashboard</h1>
                <p className="mt-1 text-sm text-gray-500">Track your finances with AI-powered insights</p>
              </div>
              <div className="flex space-x-3">
                <button 
                  className="bg-primary text-white px-4 py-2 rounded-lg hover:bg-primary/90 transition-colors"
                  onClick={() => setShowAddTransaction(true)}
                >
                  <i className="fas fa-plus mr-2"></i>
                  Add Transaction
                </button>
                <button 
                  className="bg-secondary text-white px-4 py-2 rounded-lg hover:bg-secondary/90 transition-colors"
                  onClick={() => setShowWhatsAppChat(true)}
                >
                  <i className="fab fa-whatsapp mr-2"></i>
                  WhatsApp
                </button>
              </div>
            </div>
          </div>

          {/* Stats Cards */}
          <StatsCards data={analyticsData} />

          {/* Charts */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
            <ExpenseChart data={analyticsData?.monthlyExpensesData || []} />
            <CategoryChart data={analyticsData?.categoryExpenses || []} />
          </div>

          {/* Recent Transactions */}
          <RecentTransactions transactions={analyticsData?.recentTransactions || []} />
        </div>
      </div>

      <MobileNav />
      
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
