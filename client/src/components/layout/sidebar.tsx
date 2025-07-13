import { Link, useLocation } from "wouter";
import { ChartLine, BarChart3, CreditCard, PieChart, Settings, LogOut, Grid3X3, Bot } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { cn } from "@/lib/utils";

const navigation = [
  { name: "Dashboard", href: "/", icon: BarChart3 },
  { name: "Transactions", href: "/transactions", icon: CreditCard },
  { name: "Categories", href: "/categories", icon: Grid3X3 },
  { name: "Chat AI", href: "/chat", icon: Bot },
  { name: "Budgets", href: "/budgets", icon: PieChart },
  { name: "Reports", href: "/reports", icon: ChartLine },
  { name: "Settings", href: "/settings", icon: Settings },
];

export default function Sidebar() {
  const [location] = useLocation();
  const { user } = useAuth();

  return (
    <div className="fixed inset-y-0 left-0 z-50 w-64 bg-white shadow-lg transform -translate-x-full lg:translate-x-0 transition-transform duration-300 ease-in-out">
      {/* Logo */}
      <div className="flex items-center justify-center h-16 bg-primary text-white">
        <ChartLine className="h-8 w-8 mr-2" />
        <span className="text-xl font-bold">Monly AI</span>
      </div>
      
      {/* Navigation */}
      <nav className="mt-8">
        <div className="px-4 space-y-1">
          {navigation.map((item) => {
            const Icon = item.icon;
            const isActive = location === item.href;
            
            return (
              <Link
                key={item.name}
                href={item.href}
                className={cn(
                  "group flex items-center px-3 py-2 text-sm font-medium rounded-md transition-colors",
                  isActive
                    ? "bg-primary text-white"
                    : "text-gray-700 hover:bg-gray-100"
                )}
              >
                <Icon className="mr-3 h-5 w-5" />
                {item.name}
              </Link>
            );
          })}
        </div>
      </nav>
      
      {/* User Profile */}
      <div className="absolute bottom-0 w-full p-4 border-t">
        <div className="flex items-center">
          <img 
            className="h-10 w-10 rounded-full object-cover" 
            src={(user as any)?.profileImageUrl || "https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?ixlib=rb-4.0.3&ixid=MnwxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8&auto=format&fit=crop&w=64&h=64"}
            alt="User avatar"
          />
          <div className="ml-3">
            <p className="text-sm font-medium text-gray-700">
              {(user as any)?.firstName} {(user as any)?.lastName}
            </p>
            <p className="text-xs text-gray-500">{(user as any)?.email}</p>
          </div>
        </div>
        <button 
          className="mt-3 w-full flex items-center justify-center px-3 py-2 text-sm text-gray-700 hover:bg-gray-100 rounded-md transition-colors"
          onClick={() => window.location.href = '/api/logout'}
        >
          <LogOut className="h-4 w-4 mr-2" />
          Sign Out
        </button>
      </div>
    </div>
  );
}
