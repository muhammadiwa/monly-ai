import { Link, useLocation } from "wouter";
import { ChartLine, BarChart3, CreditCard, PieChart, Settings, Grid3X3, Target, MessageCircle, Sparkles, Lock } from "lucide-react";
import { cn } from "@/lib/utils";
import { useSubscription, FeatureName } from "@/hooks/useSubscription";
import { Badge } from "@/components/ui/badge";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";

interface NavItem {
  name: string;
  href: string;
  icon: any;
  requiredFeature?: FeatureName;
  showUpgradeBadge?: boolean;
}

const navigation: NavItem[] = [
  { name: "Dashboard", href: "/dashboard", icon: BarChart3 },
  { name: "Transactions", href: "/transactions", icon: CreditCard },
  { name: "Categories", href: "/categories", icon: Grid3X3 },
  { name: "Budgets", href: "/budgets", icon: PieChart },
  { name: "Goals", href: "/goals", icon: Target },
  { name: "Reports", href: "/reports", icon: ChartLine, requiredFeature: "advanced_reports" },
  { name: "WhatsApp", href: "/whatsapp-integration", icon: MessageCircle, requiredFeature: "whatsapp_notifications" },
  { name: "Pricing", href: "/pricing", icon: Sparkles, showUpgradeBadge: true },
  { name: "Settings", href: "/settings", icon: Settings },
];

export default function Sidebar() {
  const [location] = useLocation();
  const { subscription, canUseFeature } = useSubscription();

  // Check if user is on free plan
  const isFreeUser = subscription?.planName === 'free' || !subscription;

  return (
    <div className="fixed inset-y-0 left-0 z-30 w-64 bg-white shadow-xl transform -translate-x-full lg:translate-x-0 transition-transform duration-300 ease-in-out top-16 border-r border-gray-200/60">

      {/* Navigation */}
      <nav className="mt-6 px-4 pb-4">
        <div className="space-y-2">
          <TooltipProvider>
            {navigation.map((item) => {
              const Icon = item.icon;
              const isActive = location === item.href;
              const showBadge = item.showUpgradeBadge && isFreeUser;

              // Check if feature is locked
              const isLocked = item.requiredFeature && !canUseFeature(item.requiredFeature);

              const linkContent = (
                <div
                  className={cn(
                    "group flex items-center px-4 py-3 text-sm font-medium rounded-xl transition-all duration-200 ease-in-out",
                    isActive && !isLocked
                      ? "bg-gradient-to-r from-emerald-500 to-blue-600 text-white shadow-lg transform scale-[1.02]"
                      : isLocked
                        ? "text-gray-400 bg-gray-50 cursor-not-allowed"
                        : "text-gray-700 hover:bg-gray-50 hover:text-emerald-600 hover:shadow-md hover:transform hover:scale-[1.01]"
                  )}
                >
                  <Icon className={cn(
                    "mr-3 h-5 w-5 transition-colors duration-200",
                    isActive && !isLocked ? "text-white" : isLocked ? "text-gray-400" : "text-gray-500 group-hover:text-emerald-600"
                  )} />
                  <span className="font-medium flex-1">{item.name}</span>

                  {/* Lock icon for premium features */}
                  {isLocked && (
                    <Lock className="h-4 w-4 text-gray-400" />
                  )}

                  {/* Upgrade badge */}
                  {showBadge && !isLocked && (
                    <Badge
                      variant="default"
                      className="ml-auto bg-gradient-to-r from-amber-500 to-orange-500 text-white text-xs px-2 py-0.5 animate-pulse"
                    >
                      Upgrade
                    </Badge>
                  )}

                  {/* Active indicator */}
                  {isActive && !showBadge && !isLocked && (
                    <div className="ml-auto w-2 h-2 bg-white rounded-full opacity-80" />
                  )}
                </div>
              );

              // If locked, wrap with tooltip and don't make it a link
              if (isLocked) {
                return (
                  <Tooltip key={item.name}>
                    <TooltipTrigger asChild>
                      {linkContent}
                    </TooltipTrigger>
                    <TooltipContent side="right" className="bg-gray-900 text-white">
                      <p className="text-sm">Upgrade to access {item.name}</p>
                    </TooltipContent>
                  </Tooltip>
                );
              }

              return (
                <Link key={item.name} href={item.href}>
                  {linkContent}
                </Link>
              );
            })}
          </TooltipProvider>
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
