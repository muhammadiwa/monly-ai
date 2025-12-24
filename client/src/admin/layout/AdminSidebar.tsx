import { Link, useLocation } from "wouter";
import {
    LayoutDashboard,
    Users,
    CreditCard,
    Package,
    DollarSign,
    Settings,
    MessageSquare,
    BarChart3,
} from "lucide-react";
import { cn } from "@/lib/utils";

const navigation = [
    { name: "Dashboard", href: "/admin/dashboard", icon: LayoutDashboard },
    { name: "User Management", href: "/admin/users", icon: Users },
    { name: "Subscriptions", href: "/admin/subscriptions", icon: Package },
    { name: "Payments", href: "/admin/payments", icon: CreditCard },
    { name: "Revenue Analytics", href: "/admin/analytics", icon: BarChart3 },
    { name: "WhatsApp Bot", href: "/admin/whatsapp", icon: MessageSquare },
    { name: "System Settings", href: "/admin/settings", icon: Settings },
];

export default function AdminSidebar() {
    const [location] = useLocation();

    return (
        <>
            {/* Desktop Sidebar */}
            <div className="hidden lg:fixed lg:inset-y-0 lg:left-0 lg:z-30 lg:block lg:w-64 lg:overflow-y-auto lg:bg-white lg:shadow-xl lg:top-16 lg:border-r lg:border-slate-200">
                {/* Navigation */}
                <nav className="mt-6 px-4 pb-4">
                    <div className="space-y-2">
                        {navigation.map((item) => {
                            const Icon = item.icon;
                            const isActive = location === item.href || location.startsWith(item.href + "/");

                            return (
                                <Link
                                    key={item.name}
                                    href={item.href}
                                    className={cn(
                                        "group flex items-center px-4 py-3 text-sm font-medium rounded-xl transition-all duration-200 ease-in-out",
                                        isActive
                                            ? "bg-gradient-to-r from-blue-600 to-indigo-600 text-white shadow-lg transform scale-[1.02]"
                                            : "text-slate-700 hover:bg-slate-50 hover:text-blue-600 hover:shadow-md hover:transform hover:scale-[1.01]"
                                    )}
                                >
                                    <Icon className={cn(
                                        "mr-3 h-5 w-5 transition-colors duration-200",
                                        isActive ? "text-white" : "text-slate-500 group-hover:text-blue-600"
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
                    <div className="bg-gradient-to-r from-blue-50 to-indigo-50 rounded-xl p-4 border border-blue-100">
                        <div className="text-center">
                            <div className="text-xs font-medium text-blue-700 mb-1">Admin Panel</div>
                            <div className="text-xs text-slate-500">Monly Finance Management</div>
                        </div>
                    </div>
                </div>
            </div>

            {/* Mobile Sidebar - Sheet/Drawer */}
            <div className="lg:hidden">
                {/* Mobile navigation will be handled by a separate mobile menu component if needed */}
                {/* For now, we'll use a simple bottom navigation on mobile */}
                <div className="fixed bottom-0 left-0 right-0 z-40 bg-white border-t border-slate-200 shadow-lg lg:hidden">
                    <nav className="flex justify-around items-center h-16 px-2">
                        {navigation.slice(0, 5).map((item) => {
                            const Icon = item.icon;
                            const isActive = location === item.href || location.startsWith(item.href + "/");

                            return (
                                <Link
                                    key={item.name}
                                    href={item.href}
                                    className={cn(
                                        "flex flex-col items-center justify-center flex-1 h-full transition-colors duration-200",
                                        isActive
                                            ? "text-blue-600"
                                            : "text-slate-500 hover:text-blue-600"
                                    )}
                                >
                                    <Icon className={cn(
                                        "h-5 w-5 mb-1",
                                        isActive ? "text-blue-600" : "text-slate-500"
                                    )} />
                                    <span className="text-xs font-medium truncate max-w-[60px]">
                                        {item.name.split(" ")[0]}
                                    </span>
                                </Link>
                            );
                        })}
                    </nav>
                </div>
            </div>
        </>
    );
}
