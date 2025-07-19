import { Link, useLocation } from "wouter";
import { ChartLine, BarChart3, CreditCard, PieChart, Settings, Grid3X3, Target, MessageCircle } from "lucide-react";
import { cn } from "@/lib/utils";

const navigation = [
  { name: "Dashboard", href: "/", icon: BarChart3 },
  { name: "Transactions", href: "/transactions", icon: CreditCard },
  { name: "Categories", href: "/categories", icon: Grid3X3 },
  { name: "Budgets", href: "/budgets", icon: PieChart },
  { name: "Goals", href: "/goals", icon: Target },
  { name: "Reports", href: "/reports", icon: ChartLine },
  { name: "WhatsApp Integration", href: "/whatsapp-integration", icon: MessageCircle },
  { name: "Settings", href: "/settings", icon: Settings },
];

export default function Sidebar() {
  const [location] = useLocation();

  return (
    <div className="fixed inset-y-0 left-0 z-30 w-64 bg-white shadow-xl transform -translate-x-full lg:translate-x-0 transition-transform duration-300 ease-in-out top-16 border-r border-gray-200/60">
      
      {/* Navigation */}
      <nav className="mt-6 px-4 pb-4">
        <div className="space-y-2">
          {navigation.map((item) => {
            const Icon = item.icon;
            const isActive = location === item.href;
            
            return (
              <Link
                key={item.name}
                href={item.href}
                className={cn(
                  "group flex items-center px-4 py-3 text-sm font-medium rounded-xl transition-all duration-200 ease-in-out",
                  isActive
                    ? "bg-gradient-to-r from-emerald-500 to-blue-600 text-white shadow-lg transform scale-[1.02]"
                    : "text-gray-700 hover:bg-gray-50 hover:text-emerald-600 hover:shadow-md hover:transform hover:scale-[1.01]"
                )}
              >
                <Icon className={cn(
                  "mr-3 h-5 w-5 transition-colors duration-200",
                  isActive ? "text-white" : "text-gray-500 group-hover:text-emerald-600"
                )} />
                <span className="font-medium">{item.name}</span>
                {isActive && (
                  <div className="ml-auto w-2 h-2 bg-white rounded-full opacity-80" />
                )}
              </Link>
            );
          })}
        </div>
      </nav>

      {/* Bottom Decoration */}
      <div className="absolute bottom-6 left-4 right-4">
        <div className="bg-gradient-to-r from-emerald-50 to-blue-50 rounded-xl p-4 border border-emerald-100">
          <div className="text-center">
            <div className="text-xs font-medium text-emerald-700 mb-1">Powered by AI</div>
            <div className="text-xs text-gray-500">Smart Financial Insights</div>
          </div>
        </div>
      </div>
    </div>
  );
}
