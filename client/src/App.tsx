import { Switch, Route } from "wouter";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { useAuth } from "@/hooks/useAuth";
import Layout from "@/components/layout/layout";
import NotFound from "@/pages/not-found";
import Landing from "@/pages/landing";
import Auth from "@/pages/auth";
import Dashboard from "@/pages/dashboard";
import Transactions from "@/pages/transactions";
import Categories from "@/pages/categories";
import ChatAI from "@/pages/chat-ai";
import Budgets from "@/pages/budgets";
import Goals from "@/pages/goals";
import Reports from "@/pages/reports";
import Settings from "@/pages/settings";
import WhatsAppIntegration from "@/pages/whatsapp-integration";
import { AdminLogin, AdminDashboard, AdminProfile, UserManagement, UserDetails, SubscriptionPlans, SubscriptionList, PaymentList, RevenueAnalytics, SystemSettings, WhatsAppBotConfig } from "@/admin/pages";
import MidtransMonitoring from "@/admin/pages/MidtransMonitoring";
import { AdminRoute } from "@/admin/components";
import { useEffect } from "react";

// Simple redirect component
function RedirectToDashboard() {
  useEffect(() => {
    window.location.href = "/dashboard";
  }, []);

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center">
      <div className="text-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto mb-4"></div>
        <p className="text-gray-600">Redirecting to dashboard...</p>
      </div>
    </div>
  );
}

// Redirect to auth if not authenticated
function RedirectToAuth() {
  useEffect(() => {
    window.location.href = "/auth";
  }, []);

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center">
      <div className="text-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto mb-4"></div>
        <p className="text-gray-600">Redirecting to login...</p>
      </div>
    </div>
  );
}

function Router() {
  const { isAuthenticated, isLoading } = useAuth();

  // Check if current path is admin route
  const isAdminRoute = window.location.pathname.startsWith('/admin');

  // If admin route, don't check user auth
  if (isAdminRoute) {
    return (
      <Switch>
        <Route path="/admin/login" component={AdminLogin} />
        <Route path="/admin/dashboard">
          <AdminRoute>
            <AdminDashboard />
          </AdminRoute>
        </Route>
        <Route path="/admin/users/:id">
          <AdminRoute>
            <UserDetails />
          </AdminRoute>
        </Route>
        <Route path="/admin/users">
          <AdminRoute>
            <UserManagement />
          </AdminRoute>
        </Route>
        <Route path="/admin/plans">
          <AdminRoute>
            <SubscriptionPlans />
          </AdminRoute>
        </Route>
        <Route path="/admin/subscriptions">
          <AdminRoute>
            <SubscriptionList />
          </AdminRoute>
        </Route>
        <Route path="/admin/payments">
          <AdminRoute>
            <PaymentList />
          </AdminRoute>
        </Route>
        <Route path="/admin/revenue">
          <AdminRoute>
            <RevenueAnalytics />
          </AdminRoute>
        </Route>
        <Route path="/admin/midtrans">
          <AdminRoute>
            <MidtransMonitoring />
          </AdminRoute>
        </Route>
        <Route path="/admin/whatsapp">
          <AdminRoute>
            <WhatsAppBotConfig />
          </AdminRoute>
        </Route>
        <Route path="/admin/settings">
          <AdminRoute>
            <SystemSettings />
          </AdminRoute>
        </Route>
        <Route path="/admin/profile">
          <AdminRoute>
            <AdminProfile />
          </AdminRoute>
        </Route>
        <Route path="/admin/*" component={AdminLogin} />
        <Route component={NotFound} />
      </Switch>
    );
  }

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto mb-4"></div>
          <p className="text-gray-600">Loading...</p>
        </div>
      </div>
    );
  }

  if (!isAuthenticated) {
    return (
      <Switch>
        <Route path="/auth" component={Auth} />
        <Route path="/" component={Landing} />
        <Route component={NotFound} />
      </Switch>
    );
  }

  return (
    <Switch>
      <Route path="/auth">
        {isAuthenticated ? <RedirectToDashboard /> : <Auth />}
      </Route>
      <Route path="/" component={Landing} />
      <Route path="*">
        {!isAuthenticated ? (
          <RedirectToAuth />
        ) : (
          <Layout>
            <Switch>
              <Route path="/dashboard" component={Dashboard} />
              <Route path="/transactions" component={Transactions} />
              <Route path="/categories" component={Categories} />
              <Route path="/chat" component={ChatAI} />
              <Route path="/budgets" component={Budgets} />
              <Route path="/goals" component={Goals} />
              <Route path="/reports" component={Reports} />
              <Route path="/whatsapp-integration" component={WhatsAppIntegration} />
              <Route path="/settings" component={Settings} />
              <Route component={NotFound} />
            </Switch>
          </Layout>
        )}
      </Route>
    </Switch>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <Toaster />
        <Router />
      </TooltipProvider>
    </QueryClientProvider>
  );
}

export default App;
