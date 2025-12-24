import { useState } from "react";
import { Link } from "wouter";
import {
    Bell,
    User,
    LogOut,
    Settings,
    ChevronDown,
    Shield,
    Menu,
} from "lucide-react";
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuLabel,
    DropdownMenuSeparator,
    DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

export default function AdminHeader() {
    const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

    // Mock admin data - will be replaced with real data from useAdminAuth hook
    const adminUser = {
        name: "Admin User",
        email: "admin@monly.com",
        role: "super_admin",
    };

    const handleLogout = () => {
        // Will be implemented with admin auth
        console.log("Logout clicked");
    };

    return (
        <header className="fixed top-0 left-0 right-0 z-40 bg-white border-b border-slate-200 shadow-sm">
            <div className="flex items-center justify-between h-16 px-4 sm:px-6 lg:px-8">
                {/* Left side - Logo and Title */}
                <div className="flex items-center space-x-4">
                    {/* Mobile menu button */}
                    <Button
                        variant="ghost"
                        size="icon"
                        className="lg:hidden"
                        onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
                    >
                        <Menu className="h-5 w-5" />
                    </Button>

                    {/* Logo */}
                    <Link href="/admin/dashboard" className="flex items-center space-x-3">
                        <div className="flex items-center justify-center w-10 h-10 bg-gradient-to-br from-blue-600 to-indigo-600 rounded-xl shadow-lg">
                            <Shield className="h-6 w-6 text-white" />
                        </div>
                        <div className="hidden sm:block">
                            <h1 className="text-xl font-bold text-slate-900">Monly Admin</h1>
                            <p className="text-xs text-slate-500">Finance Management</p>
                        </div>
                    </Link>
                </div>

                {/* Right side - Notifications and User Menu */}
                <div className="flex items-center space-x-3">
                    {/* Notifications */}
                    <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="icon" className="relative">
                                <Bell className="h-5 w-5 text-slate-600" />
                                <Badge
                                    variant="destructive"
                                    className="absolute -top-1 -right-1 h-5 w-5 flex items-center justify-center p-0 text-xs"
                                >
                                    3
                                </Badge>
                            </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end" className="w-80">
                            <DropdownMenuLabel>Notifications</DropdownMenuLabel>
                            <DropdownMenuSeparator />
                            <div className="max-h-96 overflow-y-auto">
                                <div className="p-3 hover:bg-slate-50 cursor-pointer border-b">
                                    <p className="text-sm font-medium text-slate-900">New user registration</p>
                                    <p className="text-xs text-slate-500 mt-1">John Doe just signed up</p>
                                    <p className="text-xs text-slate-400 mt-1">5 minutes ago</p>
                                </div>
                                <div className="p-3 hover:bg-slate-50 cursor-pointer border-b">
                                    <p className="text-sm font-medium text-slate-900">Payment received</p>
                                    <p className="text-xs text-slate-500 mt-1">Premium subscription payment of $29.99</p>
                                    <p className="text-xs text-slate-400 mt-1">1 hour ago</p>
                                </div>
                                <div className="p-3 hover:bg-slate-50 cursor-pointer">
                                    <p className="text-sm font-medium text-slate-900">System alert</p>
                                    <p className="text-xs text-slate-500 mt-1">Database backup completed successfully</p>
                                    <p className="text-xs text-slate-400 mt-1">2 hours ago</p>
                                </div>
                            </div>
                        </DropdownMenuContent>
                    </DropdownMenu>

                    {/* User Menu */}
                    <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                            <Button
                                variant="ghost"
                                className={cn(
                                    "flex items-center space-x-2 px-3 py-2 rounded-lg",
                                    "hover:bg-slate-50 transition-colors duration-200"
                                )}
                            >
                                <div className="flex items-center justify-center w-8 h-8 bg-gradient-to-br from-blue-600 to-indigo-600 rounded-full">
                                    <User className="h-4 w-4 text-white" />
                                </div>
                                <div className="hidden md:block text-left">
                                    <p className="text-sm font-medium text-slate-900">{adminUser.name}</p>
                                    <p className="text-xs text-slate-500 capitalize">{adminUser.role.replace('_', ' ')}</p>
                                </div>
                                <ChevronDown className="h-4 w-4 text-slate-500" />
                            </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end" className="w-56">
                            <DropdownMenuLabel>
                                <div>
                                    <p className="font-medium">{adminUser.name}</p>
                                    <p className="text-xs text-slate-500 font-normal">{adminUser.email}</p>
                                </div>
                            </DropdownMenuLabel>
                            <DropdownMenuSeparator />
                            <DropdownMenuItem asChild>
                                <Link href="/admin/settings" className="flex items-center cursor-pointer">
                                    <Settings className="mr-2 h-4 w-4" />
                                    <span>Settings</span>
                                </Link>
                            </DropdownMenuItem>
                            <DropdownMenuItem asChild>
                                <Link href="/admin/profile" className="flex items-center cursor-pointer">
                                    <User className="mr-2 h-4 w-4" />
                                    <span>Profile</span>
                                </Link>
                            </DropdownMenuItem>
                            <DropdownMenuSeparator />
                            <DropdownMenuItem
                                onClick={handleLogout}
                                className="text-red-600 focus:text-red-600 focus:bg-red-50 cursor-pointer"
                            >
                                <LogOut className="mr-2 h-4 w-4" />
                                <span>Logout</span>
                            </DropdownMenuItem>
                        </DropdownMenuContent>
                    </DropdownMenu>
                </div>
            </div>
        </header>
    );
}
