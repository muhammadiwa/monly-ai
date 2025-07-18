import { useEffect, useState } from "react";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";

// Import all required icons in one statement
import { 
  User, 
  CreditCard, 
  Bell, 
  Shield, 
  Settings as SettingsIcon,
  Loader2, 
  Save, 
  Smartphone, 
  Database, 
  Coins, 
  Clock, 
  Globe, 
  Zap, 
  Eye, 
  Lock, 
  Download, 
  Trash2, 
  LogOut,
  XCircle
} from "lucide-react";

interface UserPreferences {
  id: number;
  userId: string;
  defaultCurrency: string;
  timezone: string;
  language: string;
  autoCategorize: boolean;
  createdAt: number;
  updatedAt: number;
}

interface UserProfile {
  firstName: string;
  lastName: string;
  email: string;
  profileImageUrl?: string;
}

export default function Settings() {
  const { toast } = useToast();
  const { user, isAuthenticated, isLoading, logout } = useAuth();
  const queryClient = useQueryClient();
  
  const [preferences, setPreferences] = useState<UserPreferences | null>(null);
  const [profileData, setProfileData] = useState<UserProfile>({
    firstName: "",
    lastName: "",
    email: ""
  });
  const [financialData, setFinancialData] = useState({
    currency: "IDR",
    timezone: "Asia/Jakarta", 
    language: "id",
    autoCategorize: false
  });
  const [isProfileSaving, setIsProfileSaving] = useState(false);
  const [isFinancialSaving, setIsFinancialSaving] = useState(false);

  // Fetch user preferences
  const { data: userPreferences, isLoading: preferencesLoading, error: preferencesError } = useQuery({
    queryKey: ['/api/user/preferences'],
    queryFn: async () => {
      const response = await apiRequest('GET', '/api/user/preferences');
      if (!response.ok) throw new Error('Failed to fetch preferences');
      return response.json();
    },
    enabled: isAuthenticated,
    retry: 3,
    retryDelay: 1000,
  });

  // Initialize profile data from user
  useEffect(() => {
    if (user) {
      setProfileData({
        firstName: user.firstName || "",
        lastName: user.lastName || "",
        email: user.email || "",
        profileImageUrl: user.profileImageUrl
      });
    }
  }, [user]);

  // Update local preferences state when data loads
  useEffect(() => {
    if (userPreferences) {
      setPreferences(userPreferences);
      setFinancialData({
        currency: userPreferences.defaultCurrency || "IDR",
        timezone: userPreferences.timezone || "Asia/Jakarta",
        language: userPreferences.language || "id", 
        autoCategorize: userPreferences.autoCategorize || false
      });
    }
  }, [userPreferences]);

  // Redirect to login if not authenticated
  useEffect(() => {
    if (!isLoading && !isAuthenticated) {
      toast({
        title: "Authentication Required",
        description: "Please log in to access settings",
        variant: "destructive",
      });
      setTimeout(() => {
        window.location.href = "/auth";
      }, 1000);
    }
  }, [isAuthenticated, isLoading, toast]);

  const handlePreferenceUpdate = async (key: keyof UserPreferences, value: any) => {
    if (!preferences) return;
    
    const updatedPreferences = { ...preferences, [key]: value };
    setPreferences(updatedPreferences);
    
    try {
      // Update only the changed field via API
      await apiRequest('PUT', '/api/user/preferences', { [key]: value });
      toast({
        title: "Settings Updated",
        description: "Your preferences have been saved successfully.",
      });
    } catch (error) {
      console.error('Error updating preferences:', error);
      // Revert the optimistic update on error
      setPreferences(preferences);
      toast({
        title: "Update Failed",
        description: "Failed to save your preferences. Please try again.",
        variant: "destructive",
      });
    }
  };

  const handleProfileSave = async () => {
    setIsProfileSaving(true);
    try {
      // Update profile via API
      const response = await apiRequest('PUT', '/api/user/profile', {
        firstName: profileData.firstName,
        lastName: profileData.lastName,
        email: profileData.email
      });
      
      if (!response.ok) {
        throw new Error('Failed to update profile');
      }
      
      // Refresh user data
      queryClient.invalidateQueries({ queryKey: ['/api/auth/user'] });
      
      toast({
        title: "✅ Profile Updated",
        description: "Your profile has been saved successfully",
        className: "bg-green-50 border-green-200 text-green-800",
      });
    } catch (error: any) {
      console.error('Profile update error:', error);
      toast({
        title: "❌ Update Failed",
        description: error.message || "Failed to update profile. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsProfileSaving(false);
    }
  };

  const handleFinancialSave = async () => {
    setIsFinancialSaving(true);
    try {
      // Update preferences via API
      const response = await apiRequest('PUT', '/api/user/preferences', {
        defaultCurrency: financialData.currency,
        timezone: financialData.timezone,
        language: financialData.language,
        autoCategorize: financialData.autoCategorize
      });
      
      if (!response.ok) {
        throw new Error('Failed to update financial preferences');
      }
      
      // Refresh preferences data
      queryClient.invalidateQueries({ queryKey: ['/api/user/preferences'] });
      
      toast({
        title: "✅ Financial Preferences Updated",
        description: "Your financial settings have been saved successfully",
        className: "bg-green-50 border-green-200 text-green-800",
      });
    } catch (error: any) {
      console.error('Financial preferences update error:', error);
      toast({
        title: "❌ Update Failed",
        description: error.message || "Failed to update financial preferences. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsFinancialSaving(false);
    }
  };

  const handleExportData = () => {
    toast({
      title: "📥 Export Started",
      description: "Your data export will be ready shortly",
      className: "bg-blue-50 border-blue-200 text-blue-800",
    });
  };

  const handleDeleteAccount = () => {
    toast({
      title: "🗑️ Account Deletion",
      description: "Account deletion feature coming soon",
      className: "bg-red-50 border-red-200 text-red-800",
    });
  };

  if (isLoading || preferencesLoading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-16 w-16 border-4 border-primary border-t-transparent mx-auto mb-3"></div>
          <h2 className="text-2xl font-semibold text-gray-900 mb-1">Loading Settings</h2>
          <p className="text-gray-600">Please wait while we load your preferences...</p>
        </div>
      </div>
    );
  }

  if (preferencesError) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100 flex items-center justify-center">
        <div className="text-center max-w-md mx-auto p-4">
          <XCircle className="h-16 w-16 text-red-500 mx-auto mb-3" />
          <h2 className="text-2xl font-semibold text-gray-900 mb-1">Unable to Load Settings</h2>
          <p className="text-gray-600 mb-4">There was an error loading your preferences. Please try refreshing the page.</p>
          <Button onClick={() => window.location.reload()}>
            Retry
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100">
      <div className="px-2 sm:px-4 lg:px-6 w-full">
        {/* Header */}
        <div className="mb-1">
          <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h1 className="text-2xl sm:text-3xl font-bold bg-gradient-to-r from-gray-900 to-gray-600 bg-clip-text text-transparent">Settings</h1>
              <p className="mt-0.5 text-sm sm:text-lg text-gray-600">Manage your account and preferences</p>
            </div>
          </div>
        </div>

        <Tabs defaultValue="profile" className="space-y-3">
          <TabsList className="grid w-full grid-cols-4 lg:w-fit lg:grid-cols-4 bg-white shadow-sm border border-gray-200">
            <TabsTrigger value="profile" className="flex items-center space-x-1 text-xs sm:text-sm">
              <User className="h-3 w-3 sm:h-4 sm:w-4" />
              <span>Profile</span>
            </TabsTrigger>
            <TabsTrigger value="financial" className="flex items-center space-x-1 text-xs sm:text-sm">
              <CreditCard className="h-3 w-3 sm:h-4 sm:w-4" />
              <span>Financial</span>
            </TabsTrigger>
            <TabsTrigger value="preferences" className="flex items-center space-x-1 text-xs sm:text-sm">
              <Bell className="h-3 w-3 sm:h-4 sm:w-4" />
              <span>Preferences</span>
            </TabsTrigger>
            <TabsTrigger value="security" className="flex items-center space-x-1 text-xs sm:text-sm">
              <Shield className="h-3 w-3 sm:h-4 sm:w-4" />
              <span>Security</span>
            </TabsTrigger>
          </TabsList>

          {/* Profile Tab */}
          <TabsContent value="profile" className="space-y-3">
            <Card className="shadow-lg border-0 bg-white">
              <CardHeader className="pb-2 sm:pb-3">
                <CardTitle className="text-lg sm:text-xl font-semibold text-gray-900 flex items-center gap-2">
                  <User className="h-4 w-4 sm:h-5 sm:w-5 text-primary" />
                  Profile Information
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex items-center space-x-4">
                  <Avatar className="h-16 w-16 sm:h-20 sm:w-20">
                    <AvatarImage src={profileData.profileImageUrl} />
                    <AvatarFallback className="text-lg font-semibold bg-primary/10 text-primary">
                      {profileData.firstName?.[0]}{profileData.lastName?.[0]}
                    </AvatarFallback>
                  </Avatar>
                  <div className="space-y-2">
                    <h3 className="text-xl font-semibold">{profileData.firstName} {profileData.lastName}</h3>
                    <p className="text-gray-600">{profileData.email}</p>
                    <Button variant="outline" size="sm">
                      <Smartphone className="h-4 w-4 mr-2" />
                      Change Photo
                    </Button>
                  </div>
                </div>
                
                <Separator />
                
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3 sm:gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="firstName">First Name</Label>
                    <Input 
                      id="firstName" 
                      value={profileData.firstName}
                      onChange={(e) => setProfileData(prev => ({ ...prev, firstName: e.target.value }))}
                      className="bg-white"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="lastName">Last Name</Label>
                    <Input 
                      id="lastName" 
                      value={profileData.lastName}
                      onChange={(e) => setProfileData(prev => ({ ...prev, lastName: e.target.value }))}
                      className="bg-white"
                    />
                  </div>
                </div>
                
                <div className="space-y-2">
                  <Label htmlFor="email">Email Address</Label>
                  <Input 
                    id="email" 
                    type="email" 
                    value={profileData.email}
                    onChange={(e) => setProfileData(prev => ({ ...prev, email: e.target.value }))}
                    className="bg-white"
                  />
                </div>
                
                <div className="flex gap-3">
                  <Button 
                    onClick={handleProfileSave}
                    disabled={isProfileSaving}
                    className="bg-primary hover:bg-primary/90"
                  >
                    {isProfileSaving ? (
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
                  <Button variant="outline">
                    Cancel
                  </Button>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Financial Tab */}
          <TabsContent value="financial" className="space-y-6">
            <Card className="shadow-lg border-0 bg-white/50 backdrop-blur">
              <CardHeader>
                <CardTitle className="flex items-center gap-3">
                  <CreditCard className="h-5 w-5 text-primary" />
                  Financial Preferences
                  <Badge className="bg-green-100 text-green-700 border-green-200">
                    <Database className="h-3 w-3 mr-1" />
                    Connected
                  </Badge>
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="space-y-3">
                    <Label htmlFor="currency" className="flex items-center gap-2">
                      <Coins className="h-4 w-4 text-primary" />
                      Default Currency
                    </Label>
                    <Select 
                      value={financialData.currency}
                      onValueChange={(value) => setFinancialData(prev => ({ ...prev, currency: value }))}
                    >
                      <SelectTrigger className="bg-white">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="USD">💵 USD - US Dollar</SelectItem>
                        <SelectItem value="IDR">🇮🇩 IDR - Indonesian Rupiah</SelectItem>
                        <SelectItem value="EUR">💶 EUR - Euro</SelectItem>
                        <SelectItem value="GBP">💷 GBP - British Pound</SelectItem>
                        <SelectItem value="JPY">💴 JPY - Japanese Yen</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  
                  <div className="space-y-3">
                    <Label htmlFor="timezone" className="flex items-center gap-2">
                      <Clock className="h-4 w-4 text-primary" />
                      Timezone
                    </Label>
                    <Select 
                      value={financialData.timezone}
                      onValueChange={(value) => setFinancialData(prev => ({ ...prev, timezone: value }))}
                    >
                      <SelectTrigger className="bg-white">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="UTC">🌍 UTC - Coordinated Universal Time</SelectItem>
                        <SelectItem value="Asia/Jakarta">🇮🇩 Asia/Jakarta - Indonesia Western Time</SelectItem>
                        <SelectItem value="Asia/Makassar">🇮🇩 Asia/Makassar - Indonesia Central Time</SelectItem>
                        <SelectItem value="Asia/Jayapura">🇮🇩 Asia/Jayapura - Indonesia Eastern Time</SelectItem>
                        <SelectItem value="America/New_York">🇺🇸 America/New_York - Eastern Time</SelectItem>
                        <SelectItem value="America/Los_Angeles">🇺🇸 America/Los_Angeles - Pacific Time</SelectItem>
                        <SelectItem value="Europe/London">🇬🇧 Europe/London - Greenwich Mean Time</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                <div className="space-y-3">
                  <Label htmlFor="language" className="flex items-center gap-2">
                    <Globe className="h-4 w-4 text-primary" />
                    Language
                  </Label>
                  <Select 
                    value={financialData.language}
                    onValueChange={(value) => setFinancialData(prev => ({ ...prev, language: value }))}
                  >
                    <SelectTrigger className="bg-white max-w-md">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="en">🇺🇸 English</SelectItem>
                      <SelectItem value="id">🇮🇩 Indonesian</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                
                <Separator />
                
                <div className="flex items-center justify-between p-4 bg-gradient-to-r from-blue-50 to-purple-50 rounded-lg border border-blue-200">
                  <div className="flex items-center gap-3">
                    <div className="p-2 bg-blue-100 rounded-lg">
                      <Zap className="h-5 w-5 text-blue-600" />
                    </div>
                    <div>
                      <Label htmlFor="auto-categorize" className="text-base font-medium">AI Auto-categorization</Label>
                      <p className="text-sm text-gray-600">Automatically categorize transactions using AI</p>
                    </div>
                  </div>
                  <Switch 
                    id="auto-categorize" 
                    checked={financialData.autoCategorize}
                    onCheckedChange={(checked) => setFinancialData(prev => ({ ...prev, autoCategorize: checked }))}
                  />
                </div>
                
                <div className="flex gap-3">
                  <Button 
                    onClick={handleFinancialSave}
                    disabled={isFinancialSaving}
                    className="bg-primary hover:bg-primary/90"
                  >
                    {isFinancialSaving ? (
                      <>
                        <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                        Saving...
                      </>
                    ) : (
                      <>
                        <Save className="h-4 w-4 mr-2" />
                        Save Financial Settings
                      </>
                    )}
                  </Button>
                  <Button 
                    variant="outline"
                    onClick={() => {
                      if (userPreferences) {
                        setFinancialData({
                          currency: userPreferences.defaultCurrency || "IDR",
                          timezone: userPreferences.timezone || "Asia/Jakarta",
                          language: userPreferences.language || "id",
                          autoCategorize: userPreferences.autoCategorize || false
                        });
                      }
                    }}
                  >
                    Reset
                  </Button>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Preferences Tab */}
          <TabsContent value="preferences" className="space-y-6">
            <Card className="shadow-lg border-0 bg-white/50 backdrop-blur">
              <CardHeader>
                <CardTitle className="flex items-center gap-3">
                  <Bell className="h-5 w-5 text-primary" />
                  Notifications & Alerts
                  <Badge variant="outline" className="text-yellow-700 border-yellow-300">
                    Coming Soon
                  </Badge>
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-6">
                {[
                  { id: "budget-alerts", title: "Budget Alerts", desc: "Get notified when you exceed your budget", icon: "💰" },
                  { id: "transaction-reminders", title: "Transaction Reminders", desc: "Daily reminders to log transactions", icon: "⏰" },
                  { id: "monthly-reports", title: "Monthly Reports", desc: "Receive monthly financial summary", icon: "📊" },
                  { id: "security-alerts", title: "Security Alerts", desc: "Important security notifications", icon: "🔒" }
                ].map((item) => (
                  <div key={item.id} className="flex items-center justify-between p-4 bg-white rounded-lg border">
                    <div className="flex items-center gap-3">
                      <span className="text-2xl">{item.icon}</span>
                      <div>
                        <Label htmlFor={item.id} className="text-base font-medium">{item.title}</Label>
                        <p className="text-sm text-gray-600">{item.desc}</p>
                      </div>
                    </div>
                    <Switch id={item.id} defaultChecked disabled />
                  </div>
                ))}
              </CardContent>
            </Card>
          </TabsContent>

          {/* Security Tab */}
          <TabsContent value="security" className="space-y-6">
            <Card className="shadow-lg border-0 bg-white/50 backdrop-blur">
              <CardHeader>
                <CardTitle className="flex items-center gap-3">
                  <Shield className="h-5 w-5 text-primary" />
                  Privacy & Security
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="grid gap-6">
                  <div className="flex items-center justify-between p-4 bg-white rounded-lg border">
                    <div className="flex items-center gap-3">
                      <Eye className="h-5 w-5 text-blue-500" />
                      <div>
                        <Label htmlFor="data-sharing" className="text-base font-medium">Data Sharing</Label>
                        <p className="text-sm text-gray-600">Share anonymized data to improve AI features</p>
                      </div>
                    </div>
                    <Switch id="data-sharing" />
                  </div>
                  
                  <div className="flex items-center justify-between p-4 bg-white rounded-lg border">
                    <div className="flex items-center gap-3">
                      <Lock className="h-5 w-5 text-green-500" />
                      <div>
                        <Label htmlFor="two-factor" className="text-base font-medium">Two-Factor Authentication</Label>
                        <p className="text-sm text-gray-600">Add an extra layer of security</p>
                      </div>
                    </div>
                    <Button variant="outline" size="sm">
                      Setup
                    </Button>
                  </div>
                  
                  <Separator />
                  
                  <div className="space-y-4">
                    <h4 className="font-medium text-gray-900">Data Management</h4>
                    <div className="flex items-center justify-between p-4 bg-blue-50 rounded-lg border border-blue-200">
                      <div className="flex items-center gap-3">
                        <Download className="h-5 w-5 text-blue-600" />
                        <div>
                          <Label className="text-base font-medium">Export Data</Label>
                          <p className="text-sm text-gray-600">Download all your financial data</p>
                        </div>
                      </div>
                      <Button onClick={handleExportData} variant="outline">
                        <Download className="h-4 w-4 mr-2" />
                        Export
                      </Button>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Danger Zone */}
            <Card className="shadow-lg border-0 bg-red-50/50 backdrop-blur border-red-200">
              <CardHeader>
                <CardTitle className="flex items-center gap-3 text-red-700">
                  <Trash2 className="h-5 w-5" />
                  Danger Zone
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex items-center justify-between p-4 bg-white rounded-lg border border-red-200">
                  <div>
                    <Label className="text-base font-medium text-red-700">Sign Out</Label>
                    <p className="text-sm text-gray-600">Sign out from your account</p>
                  </div>
                  <Button 
                    variant="outline" 
                    onClick={logout}
                    className="border-red-200 text-red-600 hover:bg-red-50"
                  >
                    <LogOut className="h-4 w-4 mr-2" />
                    Sign Out
                  </Button>
                </div>

                <div className="flex items-center justify-between p-4 bg-white rounded-lg border border-red-200">
                  <div>
                    <Label className="text-base font-medium text-red-700">Delete Account</Label>
                    <p className="text-sm text-gray-600">Permanently delete your account and all data</p>
                  </div>
                  <AlertDialog>
                    <AlertDialogTrigger asChild>
                      <Button variant="destructive" size="sm">
                        <Trash2 className="h-4 w-4 mr-2" />
                        Delete Account
                      </Button>
                    </AlertDialogTrigger>
                    <AlertDialogContent>
                      <AlertDialogHeader>
                        <AlertDialogTitle>Are you absolutely sure?</AlertDialogTitle>
                        <AlertDialogDescription>
                          This action cannot be undone. This will permanently delete your account
                          and remove your data from our servers.
                        </AlertDialogDescription>
                      </AlertDialogHeader>
                      <AlertDialogFooter>
                        <AlertDialogCancel>Cancel</AlertDialogCancel>
                        <AlertDialogAction 
                          onClick={handleDeleteAccount}
                          className="bg-red-600 hover:bg-red-700"
                        >
                          Yes, delete my account
                        </AlertDialogAction>
                      </AlertDialogFooter>
                    </AlertDialogContent>
                  </AlertDialog>
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}
