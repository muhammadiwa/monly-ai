import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Mail, Lock, Eye, EyeOff, Shield } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

export default function AdminLogin() {
    const { toast } = useToast();
    const [showPassword, setShowPassword] = useState(false);
    const [isLoading, setIsLoading] = useState(false);
    const [isCheckingAuth, setIsCheckingAuth] = useState(true);

    const [formData, setFormData] = useState({
        email: "",
        password: "",
        rememberMe: false,
    });

    // Check if admin is already authenticated
    useEffect(() => {
        const checkAuth = async () => {
            try {
                // Check both localStorage and sessionStorage
                const token = localStorage.getItem('admin-token') || sessionStorage.getItem('admin-token');
                if (token) {
                    // Verify token is still valid
                    const response = await fetch('/api/admin/auth/me', {
                        headers: {
                            'Authorization': `Bearer ${token}`,
                        },
                    });

                    if (response.ok) {
                        // Token is valid, redirect to dashboard
                        window.location.href = '/admin/dashboard';
                        return;
                    } else {
                        // Token is invalid, clear it from both storages
                        localStorage.removeItem('admin-token');
                        localStorage.removeItem('admin-user');
                        sessionStorage.removeItem('admin-token');
                        sessionStorage.removeItem('admin-user');
                    }
                }
            } catch (error) {
                console.error('Error checking auth:', error);
                // Clear invalid tokens from both storages
                localStorage.removeItem('admin-token');
                localStorage.removeItem('admin-user');
                sessionStorage.removeItem('admin-token');
                sessionStorage.removeItem('admin-user');
            } finally {
                setIsCheckingAuth(false);
            }
        };

        checkAuth();
    }, []);

    // Show loading spinner while checking auth status
    if (isCheckingAuth) {
        return (
            <div className="min-h-screen bg-gradient-to-br from-slate-900 via-purple-900 to-slate-900 flex items-center justify-center">
                <div className="text-center">
                    <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-purple-400 mx-auto mb-4"></div>
                    <p className="text-gray-300">Checking authentication...</p>
                </div>
            </div>
        );
    }

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setIsLoading(true);

        try {
            // Form validation
            if (!formData.email || !formData.password) {
                toast({
                    title: "Validation Error",
                    description: "Email and password are required.",
                    variant: "destructive",
                });
                return;
            }

            // Email format validation
            const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
            if (!emailRegex.test(formData.email)) {
                toast({
                    title: "Validation Error",
                    description: "Please enter a valid email address.",
                    variant: "destructive",
                });
                return;
            }

            const response = await fetch('/api/admin/auth/login', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    email: formData.email,
                    password: formData.password,
                    rememberMe: formData.rememberMe,
                }),
            });

            // Check if response is JSON
            const contentType = response.headers.get('content-type');
            if (!contentType || !contentType.includes('application/json')) {
                const text = await response.text();
                throw new Error(`Server returned HTML instead of JSON. This usually means the API endpoint is not available. Response: ${text.substring(0, 200)}`);
            }

            const data = await response.json();

            if (!response.ok) {
                throw new Error(data.error?.message || 'Authentication failed');
            }

            // Store JWT token in localStorage or sessionStorage based on rememberMe
            if (data.token) {
                if (formData.rememberMe) {
                    // Store in localStorage for persistent login
                    localStorage.setItem('admin-token', data.token);
                } else {
                    // Store in sessionStorage for session-only login
                    sessionStorage.setItem('admin-token', data.token);
                }
            }

            // Store admin user data
            if (data.admin) {
                if (formData.rememberMe) {
                    localStorage.setItem('admin-user', JSON.stringify(data.admin));
                } else {
                    sessionStorage.setItem('admin-user', JSON.stringify(data.admin));
                }
            }

            // Show success toast
            toast({
                title: "Welcome back!",
                description: `Logged in as ${data.admin?.name || 'Admin'}`,
                variant: "default",
            });

            // Check if there's a redirect URL stored
            const redirectUrl = sessionStorage.getItem('admin-redirect-after-login');
            if (redirectUrl) {
                sessionStorage.removeItem('admin-redirect-after-login');
                window.location.href = redirectUrl;
            } else {
                // Default redirect to admin dashboard
                window.location.href = '/admin/dashboard';
            }
        } catch (error: unknown) {
            console.error("Admin login error:", error);

            // Show error toast
            const errorMessage = error instanceof Error ? error.message : 'Authentication failed';
            toast({
                title: "Authentication Error",
                description: errorMessage,
                variant: "destructive",
            });
        } finally {
            setIsLoading(false);
        }
    };

    const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        setFormData({
            ...formData,
            [e.target.name]: e.target.value
        });
    };

    return (
        <div className="min-h-screen bg-gradient-to-br from-slate-900 via-purple-900 to-slate-900 flex items-center justify-center p-4">
            {/* Animated Background */}
            <div className="fixed inset-0 -z-10">
                <div className="absolute top-20 left-20 w-72 h-72 bg-purple-500 rounded-full mix-blend-multiply filter blur-xl opacity-20 animate-pulse"></div>
                <div className="absolute top-40 right-20 w-72 h-72 bg-blue-500 rounded-full mix-blend-multiply filter blur-xl opacity-20 animate-pulse animation-delay-1000"></div>
                <div className="absolute -bottom-32 left-40 w-72 h-72 bg-pink-500 rounded-full mix-blend-multiply filter blur-xl opacity-20 animate-pulse animation-delay-2000"></div>
            </div>

            <div className="w-full max-w-md">
                {/* Header */}
                <div className="text-center mb-8">
                    <div className="flex items-center justify-center space-x-2 mb-4">
                        <div className="w-12 h-12 bg-gradient-to-r from-purple-600 to-blue-600 rounded-xl flex items-center justify-center shadow-lg">
                            <Shield className="text-white h-6 w-6" />
                        </div>
                        <span className="text-2xl font-bold text-white">
                            Admin Panel
                        </span>
                    </div>
                    <h1 className="text-3xl font-bold text-white mb-2">
                        Secure Access
                    </h1>
                    <p className="text-gray-300">
                        Sign in to manage the platform
                    </p>
                </div>

                {/* Login Form */}
                <Card className="shadow-2xl border-0 bg-white/10 backdrop-blur-md">
                    <CardHeader className="space-y-1">
                        <CardTitle className="text-2xl text-white">Admin Login</CardTitle>
                        <CardDescription className="text-gray-300">
                            Enter your admin credentials to access the dashboard
                        </CardDescription>
                    </CardHeader>

                    <CardContent>
                        <form onSubmit={handleSubmit} className="space-y-4">
                            <div className="space-y-2">
                                <Label htmlFor="email" className="text-white">Email</Label>
                                <div className="relative">
                                    <Mail className="absolute left-3 top-3 h-4 w-4 text-gray-400" />
                                    <Input
                                        id="email"
                                        name="email"
                                        type="email"
                                        placeholder="admin@example.com"
                                        value={formData.email}
                                        onChange={handleInputChange}
                                        className="pl-10 bg-white/20 border-white/30 text-white placeholder:text-gray-400 focus:bg-white/30"
                                        required
                                        autoComplete="email"
                                    />
                                </div>
                            </div>

                            <div className="space-y-2">
                                <Label htmlFor="password" className="text-white">Password</Label>
                                <div className="relative">
                                    <Lock className="absolute left-3 top-3 h-4 w-4 text-gray-400" />
                                    <Input
                                        id="password"
                                        name="password"
                                        type={showPassword ? "text" : "password"}
                                        placeholder="Enter your password"
                                        value={formData.password}
                                        onChange={handleInputChange}
                                        className="pl-10 pr-10 bg-white/20 border-white/30 text-white placeholder:text-gray-400 focus:bg-white/30"
                                        required
                                        autoComplete="current-password"
                                    />
                                    <button
                                        type="button"
                                        onClick={() => setShowPassword(!showPassword)}
                                        className="absolute right-3 top-3 h-4 w-4 text-gray-400 hover:text-gray-200"
                                    >
                                        {showPassword ? <EyeOff /> : <Eye />}
                                    </button>
                                </div>
                            </div>

                            <div className="flex items-center justify-between">
                                <label className="flex items-center cursor-pointer group">
                                    <input
                                        type="checkbox"
                                        checked={formData.rememberMe}
                                        onChange={(e) => setFormData({ ...formData, rememberMe: e.target.checked })}
                                        className="mr-2 cursor-pointer w-4 h-4 text-purple-600 bg-white/20 border-white/30 rounded focus:ring-purple-500 focus:ring-2"
                                    />
                                    <span className="text-sm text-gray-300 group-hover:text-white transition-colors">
                                        Remember me
                                    </span>
                                </label>
                            </div>

                            <Button
                                type="submit"
                                disabled={isLoading}
                                className="w-full bg-gradient-to-r from-purple-600 to-blue-600 hover:from-purple-700 hover:to-blue-700 text-white shadow-lg hover:shadow-xl transform hover:scale-105 transition-all duration-300"
                            >
                                {isLoading ? (
                                    <div className="flex items-center">
                                        <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin mr-2"></div>
                                        Signing in...
                                    </div>
                                ) : (
                                    <>
                                        <Shield className="mr-2 h-4 w-4" />
                                        Sign In
                                    </>
                                )}
                            </Button>
                        </form>

                        <div className="mt-6 pt-6 border-t border-white/20">
                            <p className="text-xs text-gray-400 text-center">
                                This is a secure admin area. Unauthorized access is prohibited.
                            </p>
                        </div>
                    </CardContent>
                </Card>

                {/* Back to Home */}
                <div className="text-center mt-6">
                    <Button
                        variant="ghost"
                        onClick={() => window.location.href = "/"}
                        className="text-gray-300 hover:text-white"
                    >
                        ← Back to Home
                    </Button>
                </div>
            </div>
        </div>
    );
}
