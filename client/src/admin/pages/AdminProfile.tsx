import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import AdminLayout from "../layout/AdminLayout";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { useToast } from "@/hooks/use-toast";
import {
    User,
    Mail,
    Shield,
    Lock,
    Save,
    Loader2,
    AlertCircle,
    CheckCircle,
    Eye,
    EyeOff,
} from "lucide-react";

interface AdminProfile {
    id: string;
    email: string;
    name: string;
    role: 'super_admin' | 'admin' | 'support';
    lastLogin?: number;
    createdAt: number;
}

interface AdminProfileResponse {
    success: boolean;
    data: AdminProfile;
}

// Helper function to format timestamp (handles both seconds and milliseconds)
const formatTimestamp = (timestamp: number): string => {
    if (!timestamp) return 'N/A';

    // If timestamp is in seconds (< year 3000 in seconds), convert to milliseconds
    const ms = timestamp < 10000000000 ? timestamp * 1000 : timestamp;

    try {
        return new Date(ms).toLocaleDateString('en-US', {
            year: 'numeric',
            month: 'long',
            day: 'numeric'
        });
    } catch (error) {
        return 'Invalid Date';
    }
};

// Helper function to format datetime (handles both seconds and milliseconds)
const formatDateTime = (timestamp: number): string => {
    if (!timestamp) return 'N/A';

    // If timestamp is in seconds (< year 3000 in seconds), convert to milliseconds
    const ms = timestamp < 10000000000 ? timestamp * 1000 : timestamp;

    try {
        return new Date(ms).toLocaleString('en-US', {
            year: 'numeric',
            month: 'long',
            day: 'numeric',
            hour: '2-digit',
            minute: '2-digit'
        });
    } catch (error) {
        return 'Invalid Date';
    }
};

export default function AdminProfile() {
    const { toast } = useToast();
    const queryClient = useQueryClient();

    const [isEditingProfile, setIsEditingProfile] = useState(false);
    const [isChangingPassword, setIsChangingPassword] = useState(false);
    const [showCurrentPassword, setShowCurrentPassword] = useState(false);
    const [showNewPassword, setShowNewPassword] = useState(false);
    const [showConfirmPassword, setShowConfirmPassword] = useState(false);

    const [profileData, setProfileData] = useState({
        name: "",
        email: "",
    });

    const [passwordData, setPasswordData] = useState({
        currentPassword: "",
        newPassword: "",
        confirmPassword: "",
    });

    // Fetch admin profile
    const { data: profileResponse, isLoading, error } = useQuery<AdminProfileResponse>({
        queryKey: ["/api/admin/profile"],
        queryFn: async () => {
            const adminToken = localStorage.getItem('admin-token') || sessionStorage.getItem('admin-token');
            if (!adminToken) {
                throw new Error('No admin token');
            }

            const res = await fetch('/api/admin/profile', {
                headers: {
                    'Authorization': `Bearer ${adminToken}`,
                },
            });

            if (!res.ok) {
                throw new Error(`HTTP ${res.status}`);
            }

            return res.json();
        },
    });

    // Initialize form data when profile loads
    useEffect(() => {
        if (profileResponse?.data && !isEditingProfile) {
            setProfileData({
                name: profileResponse.data.name,
                email: profileResponse.data.email,
            });
        }
    }, [profileResponse, isEditingProfile]);

    // Update profile mutation
    const updateProfileMutation = useMutation({
        mutationFn: async (data: { name: string; email: string }) => {
            const adminToken = localStorage.getItem('admin-token') || sessionStorage.getItem('admin-token');
            if (!adminToken) {
                throw new Error('No admin token');
            }

            const res = await fetch('/api/admin/profile', {
                method: 'PUT',
                headers: {
                    'Authorization': `Bearer ${adminToken}`,
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify(data),
            });

            if (!res.ok) {
                const errorData = await res.json();
                throw new Error(errorData.error?.message || `HTTP ${res.status}`);
            }

            return res.json();
        },
        onSuccess: () => {
            toast({
                title: "Profile Updated",
                description: "Your profile has been updated successfully.",
            });
            setIsEditingProfile(false);
            queryClient.invalidateQueries({ queryKey: ["/api/admin/profile"] });
            queryClient.invalidateQueries({ queryKey: ["/api/admin/auth/me"] });
        },
        onError: (error: Error) => {
            toast({
                title: "Update Failed",
                description: error.message || "Failed to update profile. Please try again.",
                variant: "destructive",
            });
        },
    });

    // Change password mutation
    const changePasswordMutation = useMutation({
        mutationFn: async (data: { currentPassword: string; newPassword: string }) => {
            const adminToken = localStorage.getItem('admin-token') || sessionStorage.getItem('admin-token');
            if (!adminToken) {
                throw new Error('No admin token');
            }

            const res = await fetch('/api/admin/profile/password', {
                method: 'PUT',
                headers: {
                    'Authorization': `Bearer ${adminToken}`,
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify(data),
            });

            if (!res.ok) {
                const errorData = await res.json();
                throw new Error(errorData.error?.message || `HTTP ${res.status}`);
            }

            return res.json();
        },
        onSuccess: () => {
            toast({
                title: "Password Changed",
                description: "Your password has been changed successfully.",
            });
            setIsChangingPassword(false);
            setPasswordData({
                currentPassword: "",
                newPassword: "",
                confirmPassword: "",
            });
        },
        onError: (error: Error) => {
            toast({
                title: "Password Change Failed",
                description: error.message || "Failed to change password. Please try again.",
                variant: "destructive",
            });
        },
    });

    const handleProfileSave = () => {
        if (!profileData.name.trim()) {
            toast({
                title: "Validation Error",
                description: "Name is required.",
                variant: "destructive",
            });
            return;
        }

        if (!profileData.email.trim()) {
            toast({
                title: "Validation Error",
                description: "Email is required.",
                variant: "destructive",
            });
            return;
        }

        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!emailRegex.test(profileData.email)) {
            toast({
                title: "Validation Error",
                description: "Please enter a valid email address.",
                variant: "destructive",
            });
            return;
        }

        updateProfileMutation.mutate(profileData);
    };

    const handlePasswordChange = () => {
        if (!passwordData.currentPassword) {
            toast({
                title: "Validation Error",
                description: "Current password is required.",
                variant: "destructive",
            });
            return;
        }

        if (!passwordData.newPassword) {
            toast({
                title: "Validation Error",
                description: "New password is required.",
                variant: "destructive",
            });
            return;
        }

        if (passwordData.newPassword.length < 8) {
            toast({
                title: "Validation Error",
                description: "New password must be at least 8 characters long.",
                variant: "destructive",
            });
            return;
        }

        if (passwordData.newPassword !== passwordData.confirmPassword) {
            toast({
                title: "Validation Error",
                description: "New password and confirmation do not match.",
                variant: "destructive",
            });
            return;
        }

        changePasswordMutation.mutate({
            currentPassword: passwordData.currentPassword,
            newPassword: passwordData.newPassword,
        });
    };

    const getRoleBadge = (role: string) => {
        switch (role) {
            case 'super_admin':
                return <Badge className="bg-purple-600">Super Admin</Badge>;
            case 'admin':
                return <Badge className="bg-blue-600">Admin</Badge>;
            case 'support':
                return <Badge className="bg-green-600">Support</Badge>;
            default:
                return <Badge>{role}</Badge>;
        }
    };

    const profile = profileResponse?.data;

    if (isLoading) {
        return (
            <AdminLayout>
                <div className="flex items-center justify-center py-12">
                    <Loader2 className="h-8 w-8 animate-spin text-slate-600" />
                </div>
            </AdminLayout>
        );
    }

    if (error || !profile) {
        return (
            <AdminLayout>
                <Alert variant="destructive">
                    <AlertCircle className="h-4 w-4" />
                    <AlertDescription>
                        Failed to load profile. Please try again.
                    </AlertDescription>
                </Alert>
            </AdminLayout>
        );
    }

    return (
        <AdminLayout>
            <div className="space-y-6">
                {/* Page Header */}
                <div className="flex items-center justify-between bg-gradient-to-r from-slate-50 to-white p-6 rounded-xl border border-slate-200 shadow-sm">
                    <div>
                        <h1 className="text-4xl font-bold bg-gradient-to-r from-slate-900 to-slate-700 bg-clip-text text-transparent">
                            Admin Profile
                        </h1>
                        <p className="text-slate-600 mt-2 font-medium">
                            Manage your admin account settings
                        </p>
                    </div>
                    {getRoleBadge(profile.role)}
                </div>

                {/* Profile Information Card */}
                <Card className="border-slate-200 shadow-md">
                    <CardHeader className="bg-gradient-to-r from-slate-50 to-white border-b border-slate-100">
                        <div className="flex items-center justify-between">
                            <div>
                                <CardTitle className="text-lg font-semibold text-slate-700 flex items-center gap-2">
                                    <User className="h-5 w-5 text-blue-600" />
                                    Profile Information
                                </CardTitle>
                                <CardDescription>
                                    Update your admin profile details
                                </CardDescription>
                            </div>
                            {!isEditingProfile && (
                                <Button
                                    onClick={() => setIsEditingProfile(true)}
                                    variant="outline"
                                    size="sm"
                                >
                                    Edit Profile
                                </Button>
                            )}
                        </div>
                    </CardHeader>
                    <CardContent className="pt-6">
                        <div className="space-y-4">
                            {/* Admin ID */}
                            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                                <div>
                                    <Label className="text-sm font-medium text-slate-500">Admin ID</Label>
                                    <p className="text-slate-900 mt-1 font-mono text-sm">{profile.id}</p>
                                </div>
                                <div>
                                    <Label className="text-sm font-medium text-slate-500">Role</Label>
                                    <div className="mt-1">{getRoleBadge(profile.role)}</div>
                                </div>
                                <div>
                                    <Label className="text-sm font-medium text-slate-500">Member Since</Label>
                                    <p className="text-slate-900 mt-1">
                                        {formatTimestamp(profile.createdAt)}
                                    </p>
                                </div>
                            </div>

                            <Separator />

                            {/* Name */}
                            <div>
                                <Label htmlFor="name" className="flex items-center gap-2">
                                    <User className="h-4 w-4" />
                                    Full Name
                                </Label>
                                {isEditingProfile ? (
                                    <Input
                                        id="name"
                                        value={profileData.name}
                                        onChange={(e) => setProfileData({ ...profileData, name: e.target.value })}
                                        className="mt-1"
                                        placeholder="Enter your full name"
                                    />
                                ) : (
                                    <p className="text-slate-900 mt-1 text-lg font-medium">{profile.name}</p>
                                )}
                            </div>

                            {/* Email */}
                            <div>
                                <Label htmlFor="email" className="flex items-center gap-2">
                                    <Mail className="h-4 w-4" />
                                    Email Address
                                </Label>
                                {isEditingProfile ? (
                                    <Input
                                        id="email"
                                        type="email"
                                        value={profileData.email}
                                        onChange={(e) => setProfileData({ ...profileData, email: e.target.value })}
                                        className="mt-1"
                                        placeholder="Enter your email"
                                    />
                                ) : (
                                    <p className="text-slate-900 mt-1 text-lg">{profile.email}</p>
                                )}
                            </div>

                            {/* Last Login */}
                            {profile.lastLogin && (
                                <div>
                                    <Label className="text-sm font-medium text-slate-500">Last Login</Label>
                                    <p className="text-slate-900 mt-1">
                                        {formatDateTime(profile.lastLogin)}
                                    </p>
                                </div>
                            )}

                            {/* Action Buttons */}
                            {isEditingProfile && (
                                <div className="flex gap-3 pt-4">
                                    <Button
                                        onClick={handleProfileSave}
                                        disabled={updateProfileMutation.isPending}
                                        className="bg-blue-600 hover:bg-blue-700"
                                    >
                                        {updateProfileMutation.isPending ? (
                                            <>
                                                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                                                Saving...
                                            </>
                                        ) : (
                                            <>
                                                <Save className="h-4 w-4 mr-2" />
                                                Save Changes
                                            </>
                                        )}
                                    </Button>
                                    <Button
                                        onClick={() => {
                                            setIsEditingProfile(false);
                                            setProfileData({
                                                name: profile.name,
                                                email: profile.email,
                                            });
                                        }}
                                        variant="outline"
                                        disabled={updateProfileMutation.isPending}
                                    >
                                        Cancel
                                    </Button>
                                </div>
                            )}
                        </div>
                    </CardContent>
                </Card>

                {/* Change Password Card */}
                <Card className="border-slate-200 shadow-md">
                    <CardHeader className="bg-gradient-to-r from-slate-50 to-white border-b border-slate-100">
                        <div className="flex items-center justify-between">
                            <div>
                                <CardTitle className="text-lg font-semibold text-slate-700 flex items-center gap-2">
                                    <Lock className="h-5 w-5 text-purple-600" />
                                    Change Password
                                </CardTitle>
                                <CardDescription>
                                    Update your password to keep your account secure
                                </CardDescription>
                            </div>
                            {!isChangingPassword && (
                                <Button
                                    onClick={() => setIsChangingPassword(true)}
                                    variant="outline"
                                    size="sm"
                                >
                                    Change Password
                                </Button>
                            )}
                        </div>
                    </CardHeader>
                    {isChangingPassword && (
                        <CardContent className="pt-6">
                            <div className="space-y-4">
                                <Alert className="border-blue-200 bg-blue-50">
                                    <AlertCircle className="h-4 w-4 text-blue-600" />
                                    <AlertDescription className="text-blue-800">
                                        Password must be at least 8 characters long and include a mix of letters, numbers, and special characters.
                                    </AlertDescription>
                                </Alert>

                                {/* Current Password */}
                                <div>
                                    <Label htmlFor="currentPassword">Current Password</Label>
                                    <div className="relative mt-1">
                                        <Input
                                            id="currentPassword"
                                            type={showCurrentPassword ? "text" : "password"}
                                            value={passwordData.currentPassword}
                                            onChange={(e) => setPasswordData({ ...passwordData, currentPassword: e.target.value })}
                                            placeholder="Enter your current password"
                                            className="pr-10"
                                        />
                                        <button
                                            type="button"
                                            onClick={() => setShowCurrentPassword(!showCurrentPassword)}
                                            className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                                        >
                                            {showCurrentPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                                        </button>
                                    </div>
                                </div>

                                {/* New Password */}
                                <div>
                                    <Label htmlFor="newPassword">New Password</Label>
                                    <div className="relative mt-1">
                                        <Input
                                            id="newPassword"
                                            type={showNewPassword ? "text" : "password"}
                                            value={passwordData.newPassword}
                                            onChange={(e) => setPasswordData({ ...passwordData, newPassword: e.target.value })}
                                            placeholder="Enter your new password"
                                            className="pr-10"
                                        />
                                        <button
                                            type="button"
                                            onClick={() => setShowNewPassword(!showNewPassword)}
                                            className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                                        >
                                            {showNewPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                                        </button>
                                    </div>
                                </div>

                                {/* Confirm Password */}
                                <div>
                                    <Label htmlFor="confirmPassword">Confirm New Password</Label>
                                    <div className="relative mt-1">
                                        <Input
                                            id="confirmPassword"
                                            type={showConfirmPassword ? "text" : "password"}
                                            value={passwordData.confirmPassword}
                                            onChange={(e) => setPasswordData({ ...passwordData, confirmPassword: e.target.value })}
                                            placeholder="Confirm your new password"
                                            className="pr-10"
                                        />
                                        <button
                                            type="button"
                                            onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                                            className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                                        >
                                            {showConfirmPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                                        </button>
                                    </div>
                                </div>

                                {/* Password Match Indicator */}
                                {passwordData.newPassword && passwordData.confirmPassword && (
                                    <div className="flex items-center gap-2">
                                        {passwordData.newPassword === passwordData.confirmPassword ? (
                                            <>
                                                <CheckCircle className="h-4 w-4 text-green-600" />
                                                <span className="text-sm text-green-600">Passwords match</span>
                                            </>
                                        ) : (
                                            <>
                                                <AlertCircle className="h-4 w-4 text-red-600" />
                                                <span className="text-sm text-red-600">Passwords do not match</span>
                                            </>
                                        )}
                                    </div>
                                )}

                                {/* Action Buttons */}
                                <div className="flex gap-3 pt-4">
                                    <Button
                                        onClick={handlePasswordChange}
                                        disabled={changePasswordMutation.isPending}
                                        className="bg-purple-600 hover:bg-purple-700"
                                    >
                                        {changePasswordMutation.isPending ? (
                                            <>
                                                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                                                Changing...
                                            </>
                                        ) : (
                                            <>
                                                <Lock className="h-4 w-4 mr-2" />
                                                Change Password
                                            </>
                                        )}
                                    </Button>
                                    <Button
                                        onClick={() => {
                                            setIsChangingPassword(false);
                                            setPasswordData({
                                                currentPassword: "",
                                                newPassword: "",
                                                confirmPassword: "",
                                            });
                                        }}
                                        variant="outline"
                                        disabled={changePasswordMutation.isPending}
                                    >
                                        Cancel
                                    </Button>
                                </div>
                            </div>
                        </CardContent>
                    )}
                </Card>

                {/* Security Information */}
                <Card className="border-slate-200 shadow-md">
                    <CardHeader className="bg-gradient-to-r from-slate-50 to-white border-b border-slate-100">
                        <CardTitle className="text-lg font-semibold text-slate-700 flex items-center gap-2">
                            <Shield className="h-5 w-5 text-green-600" />
                            Security Information
                        </CardTitle>
                    </CardHeader>
                    <CardContent className="pt-6">
                        <div className="space-y-4">
                            <Alert className="border-green-200 bg-green-50">
                                <CheckCircle className="h-4 w-4 text-green-600" />
                                <AlertDescription className="text-green-800">
                                    <strong>Account Secure:</strong> Your admin account is protected with encrypted password and JWT authentication.
                                </AlertDescription>
                            </Alert>

                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
                                <div className="p-4 bg-slate-50 rounded-lg border border-slate-200">
                                    <p className="font-medium text-slate-700 mb-1">Password Encryption</p>
                                    <p className="text-slate-600">bcrypt with 12 rounds</p>
                                </div>
                                <div className="p-4 bg-slate-50 rounded-lg border border-slate-200">
                                    <p className="font-medium text-slate-700 mb-1">Authentication</p>
                                    <p className="text-slate-600">JWT with secure tokens</p>
                                </div>
                                <div className="p-4 bg-slate-50 rounded-lg border border-slate-200">
                                    <p className="font-medium text-slate-700 mb-1">Session Management</p>
                                    <p className="text-slate-600">Auto-logout on inactivity</p>
                                </div>
                                <div className="p-4 bg-slate-50 rounded-lg border border-slate-200">
                                    <p className="font-medium text-slate-700 mb-1">Activity Logging</p>
                                    <p className="text-slate-600">All actions are logged</p>
                                </div>
                            </div>
                        </div>
                    </CardContent>
                </Card>
            </div>
        </AdminLayout>
    );
}
