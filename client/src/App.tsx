import { Switch, Route } from "wouter";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { useAuth } from "@/hooks/useAuth";
import Layout from "@/components/layout/layout";
import ProtectedRoute from "@/components/ProtectedRoute";
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
import Pricing from "@/pages/pricing";
import WhatsAppIntegration from "@/pages/whatsapp-integration";
import { AdminLogin, AdminDashboard, AdminProfile, UserManagement, UserDetails, SubscriptionPlans, SubscriptionList, PaymentList, RevenueAnalytics, SystemSettings, WhatsAppBotConfig } from "@/admin/pages";
import MidtransMonitoring from "@/admin/pages/MidtransMonitoring";
import { AdminRoute } from "@/admin/components";
import { useEffect } from "react";

// Simple redirect component for authenticated users on /auth
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

function Router() {
  // Check if current path is admin route FIRST before calling useAuth
  const isAdminRoute = window.location.pathname.startsWith('/admin');

  // Only call useAuth for non-admin routes
  const { isAuthenticated, isLoading } = isAdminRoute
    ? { isAuthenticated: false, isLoading: false }
    : useAuth();

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

  // Show loading state while checking authentication
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

  // Public routes (accessible without authentication)
  if (!isAuthenticated) {
    return (
      <Switch>
        <Route path="/auth" component={Auth} />
        <Route path="/" component={Landing} />
        <Route component={NotFound} />
      </Switch>
    );
  }

  // Authenticated routes
  return (
    <Switch>
      {/* Redirect authenticated users from /auth to dashboard */}
      <Route path="/auth" component={RedirectToDashboard} />

      {/* Public landing page (accessible even when authenticated) */}
      <Route path="/" component={Landing} />

      {/* Protected routes - wrapped with ProtectedRoute for consistency */}
      <Route path="/dashboard">
        <ProtectedRoute>
          <Layout>
            <Dashboard />
          </Layout>
        </ProtectedRoute>
      </Route>

      <Route path="/transactions">
        <ProtectedRoute>
          <Layout>
            <Transactions />
          </Layout>
        </ProtectedRoute>
      </Route>

      <Route path="/categories">
        <ProtectedRoute>
          <Layout>
            <Categories />
          </Layout>
        </ProtectedRoute>
      </Route>

      <Route path="/chat">
        <ProtectedRoute>
          <Layout>
            <ChatAI />
          </Layout>
        </ProtectedRoute>
      </Route>

      <Route path="/budgets">
        <ProtectedRoute>
          <Layout>
            <Budgets />
          </Layout>
        </ProtectedRoute>
      </Route>

      <Route path="/goals">
        <ProtectedRoute>
          <Layout>
            <Goals />
          </Layout>
        </ProtectedRoute>
      </Route>

      <Route path="/reports">
        <ProtectedRoute>
          <Layout>
            <Reports />
          </Layout>
        </ProtectedRoute>
      </Route>

      <Route path="/pricing">
        <ProtectedRoute>
          <Layout>
            <Pricing />
          </Layout>
        </ProtectedRoute>
      </Route>

      <Route path="/whatsapp-integration">
        <ProtectedRoute>
          <Layout>
            <WhatsAppIntegration />
          </Layout>
        </ProtectedRoute>
      </Route>

      <Route path="/settings">
        <ProtectedRoute>
          <Layout>
            <Settings />
          </Layout>
        </ProtectedRoute>
      </Route>

      {/* 404 for any other routes */}
      <Route component={NotFound} />
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
