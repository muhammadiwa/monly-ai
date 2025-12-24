import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import AdminLayout from "../layout/AdminLayout";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import {
    Settings,
    AlertCircle,
    Loader2,
    Globe,
    Flag,
    CreditCard,
    Mail,
    History,
    Edit,
    Save,
    Check,
    X,
    CheckCircle2,
    XCircle,
    AlertTriangle,
} from "lucide-react";

interface SystemSetting {
    id: number;
    category: string;
    key: string;
    value: string;
    dataType: string;
    description: string | null;
    updatedBy: string | null;
    updatedAt: number;
}

interface FeatureFlag {
    id: number;
    category: string;
    key: string;
    value: {
        enabled: boolean;
        plans: string[];
    };
    dataType: string;
    description: string | null;
    updatedBy: string | null;
    updatedAt: number;
}

interface SettingsResponse {
    success: boolean;
    data: SystemSetting[];
}

interface FeatureFlagsResponse {
    success: boolean;
    data: FeatureFlag[];
}

interface PaymentGatewayConfig {
    serverKey: string;
    clientKey: string;
    isProduction: boolean;
    webhookUrl: string;
    hasServerKey?: boolean;
    hasClientKey?: boolean;
    source?: string;
}

interface PaymentGatewayResponse {
    success: boolean;
    data: PaymentGatewayConfig;
}

interface PaymentGatewayUpdateResponse {
    success: boolean;
    message: string;
    data: {
        isProduction: boolean;
        webhookUrl: string;
        connectionTest: {
            success: boolean;
            message: string;
        };
    };
}

interface EmailConfig {
    smtpHost: string;
    smtpPort: number;
    smtpUser: string;
    smtpPassword: string;
    smtpFrom: string;
    smtpSecure: boolean;
    hasPassword?: boolean;
    source?: string;
}

interface EmailConfigResponse {
    success: boolean;
    data: EmailConfig;
}

interface EmailConfigUpdateResponse {
    success: boolean;
    message: string;
    data: EmailConfig;
}

interface EmailTestResponse {
    success: boolean;
    message: string;
}

interface AuditLogEntry {
    id: number;
    adminId: string;
    adminName: string;
    adminEmail: string;
    action: string;
    resourceType: string;
    resourceId: string | null;
    details: any;
    ipAddress: string | null;
    createdAt: number;
}

interface AuditLogResponse {
    success: boolean;
    data: {
        logs: AuditLogEntry[];
        total: number;
        page: number;
        totalPages: number;
    };
}

// Email Settings Component
function EmailSettings() {
    const { toast } = useToast();
    const queryClient = useQueryClient();
    const [isEditing, setIsEditing] = useState(false);
    const [formData, setFormData] = useState({
        smtpHost: '',
        smtpPort: 587,
        smtpUser: '',
        smtpPassword: '',
        smtpFrom: '',
        smtpSecure: false,
    });
    const [testingEmail, setTestingEmail] = useState(false);
    const [testEmailAddress, setTestEmailAddress] = useState('');
    const [testEmailResult, setTestEmailResult] = useState<{
        success: boolean;
        message: string;
    } | null>(null);

    // Fetch email configuration
    const { data, isLoading, error } = useQuery<EmailConfigResponse>({
        queryKey: ["/api/admin/settings/email"],
        queryFn: async () => {
            const adminToken = localStorage.getItem('admin-token') || sessionStorage.getItem('admin-token');
            if (!adminToken) {
                throw new Error('No admin token');
            }

            const res = await fetch('/api/admin/settings/email', {
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

    // Update email configuration
    const updateConfigMutation = useMutation({
        mutationFn: async (config: typeof formData) => {
            const adminToken = localStorage.getItem('admin-token') || sessionStorage.getItem('admin-token');
            if (!adminToken) {
                throw new Error('No admin token');
            }

            const res = await fetch('/api/admin/settings/email', {
                method: 'PUT',
                headers: {
                    'Authorization': `Bearer ${adminToken}`,
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify(config),
            });

            if (!res.ok) {
                const error = await res.json();
                throw new Error(error.error?.message || 'Failed to update email settings');
            }

            return res.json() as Promise<EmailConfigUpdateResponse>;
        },
        onSuccess: () => {
            toast({
                title: "Settings Updated",
                description: "Email settings have been updated successfully.",
            });
            queryClient.invalidateQueries({ queryKey: ["/api/admin/settings/email"] });
            setIsEditing(false);
        },
        onError: (error: Error) => {
            toast({
                title: "Update Failed",
                description: error.message,
                variant: "destructive",
            });
        },
    });

    // Test email sending
    const testEmailMutation = useMutation({
        mutationFn: async (recipientEmail: string) => {
            const adminToken = localStorage.getItem('admin-token') || sessionStorage.getItem('admin-token');
            if (!adminToken) {
                throw new Error('No admin token');
            }

            const res = await fetch('/api/admin/settings/email/test', {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${adminToken}`,
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({ recipientEmail }),
            });

            if (!res.ok) {
                const error = await res.json();
                throw new Error(error.error?.message || 'Failed to send test email');
            }

            return res.json() as Promise<EmailTestResponse>;
        },
        onSuccess: (response) => {
            setTestEmailResult({
                success: true,
                message: response.message,
            });
            toast({
                title: "Test Email Sent",
                description: response.message,
            });
        },
        onError: (error: Error) => {
            setTestEmailResult({
                success: false,
                message: error.message,
            });
            toast({
                title: "Test Failed",
                description: error.message,
                variant: "destructive",
            });
        },
    });

    // Handle edit mode
    const handleEdit = () => {
        if (data?.data) {
            setFormData({
                smtpHost: data.data.smtpHost,
                smtpPort: data.data.smtpPort,
                smtpUser: data.data.smtpUser,
                smtpPassword: '', // Don't populate password for security
                smtpFrom: data.data.smtpFrom,
                smtpSecure: data.data.smtpSecure,
            });
        }
        setIsEditing(true);
        setTestEmailResult(null);
    };

    // Handle cancel
    const handleCancel = () => {
        setIsEditing(false);
        setFormData({
            smtpHost: '',
            smtpPort: 587,
            smtpUser: '',
            smtpPassword: '',
            smtpFrom: '',
            smtpSecure: false,
        });
        setTestEmailResult(null);
    };

    // Handle save
    const handleSave = () => {
        // Validate form
        if (!formData.smtpHost.trim()) {
            toast({
                title: "Validation Error",
                description: "SMTP Host is required.",
                variant: "destructive",
            });
            return;
        }

        if (formData.smtpPort < 1 || formData.smtpPort > 65535) {
            toast({
                title: "Validation Error",
                description: "SMTP Port must be between 1 and 65535.",
                variant: "destructive",
            });
            return;
        }

        if (!formData.smtpUser.trim()) {
            toast({
                title: "Validation Error",
                description: "SMTP User is required.",
                variant: "destructive",
            });
            return;
        }

        if (!formData.smtpPassword.trim()) {
            toast({
                title: "Validation Error",
                description: "SMTP Password is required.",
                variant: "destructive",
            });
            return;
        }

        if (!formData.smtpFrom.trim()) {
            toast({
                title: "Validation Error",
                description: "Sender Email is required.",
                variant: "destructive",
            });
            return;
        }

        // Validate email format
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!emailRegex.test(formData.smtpFrom)) {
            toast({
                title: "Validation Error",
                description: "Sender Email must be a valid email address.",
                variant: "destructive",
            });
            return;
        }

        updateConfigMutation.mutate(formData);
    };

    // Handle test email
    const handleTestEmail = () => {
        if (!testEmailAddress.trim()) {
            toast({
                title: "Validation Error",
                description: "Please enter a recipient email address.",
                variant: "destructive",
            });
            return;
        }

        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!emailRegex.test(testEmailAddress)) {
            toast({
                title: "Validation Error",
                description: "Please enter a valid email address.",
                variant: "destructive",
            });
            return;
        }

        testEmailMutation.mutate(testEmailAddress);
    };

    const config = data?.data;

    if (isLoading) {
        return (
            <Card className="border-slate-200">
                <CardContent className="pt-6">
                    <div className="flex items-center justify-center py-8">
                        <Loader2 className="h-8 w-8 animate-spin text-slate-400" />
                    </div>
                </CardContent>
            </Card>
        );
    }

    if (error) {
        return (
            <Card className="border-slate-200">
                <CardContent className="pt-6">
                    <Alert variant="destructive">
                        <AlertCircle className="h-4 w-4" />
                        <AlertDescription>
                            Failed to load email settings. Please try again.
                        </AlertDescription>
                    </Alert>
                </CardContent>
            </Card>
        );
    }

    return (
        <Card className="border-slate-200">
            <CardHeader className="bg-gradient-to-r from-slate-50 to-white border-b border-slate-100">
                <div className="flex items-center justify-between">
                    <div>
                        <CardTitle className="flex items-center gap-2 text-lg">
                            <Mail className="h-5 w-5 text-orange-600" />
                            Email Settings
                        </CardTitle>
                        <CardDescription>
                            Configure SMTP settings for email notifications
                        </CardDescription>
                    </div>
                    {!isEditing && (
                        <Button
                            onClick={handleEdit}
                            variant="outline"
                            className="border-orange-200 text-orange-600 hover:bg-orange-50"
                        >
                            <Edit className="h-4 w-4 mr-2" />
                            Edit Settings
                        </Button>
                    )}
                </div>
            </CardHeader>
            <CardContent className="pt-6">
                {isEditing ? (
                    <div className="space-y-6">
                        {/* Alert about updating credentials */}
                        <Alert className="bg-blue-50 border-blue-200">
                            <AlertTriangle className="h-4 w-4 text-blue-600" />
                            <AlertDescription className="text-blue-900">
                                For security reasons, you need to re-enter your SMTP password to update settings.
                            </AlertDescription>
                        </Alert>

                        {/* SMTP Host */}
                        <div className="space-y-2">
                            <Label htmlFor="smtpHost" className="text-sm font-medium">
                                SMTP Host *
                            </Label>
                            <Input
                                id="smtpHost"
                                type="text"
                                value={formData.smtpHost}
                                onChange={(e) => setFormData({ ...formData, smtpHost: e.target.value })}
                                placeholder="smtp.gmail.com"
                            />
                            <p className="text-xs text-slate-500">
                                Your SMTP server hostname
                            </p>
                        </div>

                        {/* SMTP Port */}
                        <div className="space-y-2">
                            <Label htmlFor="smtpPort" className="text-sm font-medium">
                                SMTP Port *
                            </Label>
                            <Input
                                id="smtpPort"
                                type="number"
                                min="1"
                                max="65535"
                                value={formData.smtpPort}
                                onChange={(e) => setFormData({ ...formData, smtpPort: parseInt(e.target.value) || 587 })}
                                placeholder="587"
                            />
                            <p className="text-xs text-slate-500">
                                Common ports: 587 (TLS), 465 (SSL), 25 (unsecured)
                            </p>
                        </div>

                        {/* SMTP User */}
                        <div className="space-y-2">
                            <Label htmlFor="smtpUser" className="text-sm font-medium">
                                SMTP Username *
                            </Label>
                            <Input
                                id="smtpUser"
                                type="text"
                                value={formData.smtpUser}
                                onChange={(e) => setFormData({ ...formData, smtpUser: e.target.value })}
                                placeholder="your-email@gmail.com"
                            />
                            <p className="text-xs text-slate-500">
                                Your SMTP authentication username (usually your email)
                            </p>
                        </div>

                        {/* SMTP Password */}
                        <div className="space-y-2">
                            <Label htmlFor="smtpPassword" className="text-sm font-medium">
                                SMTP Password *
                            </Label>
                            <Input
                                id="smtpPassword"
                                type="password"
                                value={formData.smtpPassword}
                                onChange={(e) => setFormData({ ...formData, smtpPassword: e.target.value })}
                                placeholder="Enter your SMTP password..."
                            />
                            <p className="text-xs text-slate-500">
                                Your SMTP authentication password or app-specific password
                            </p>
                        </div>

                        {/* Sender Email */}
                        <div className="space-y-2">
                            <Label htmlFor="smtpFrom" className="text-sm font-medium">
                                Sender Email *
                            </Label>
                            <Input
                                id="smtpFrom"
                                type="email"
                                value={formData.smtpFrom}
                                onChange={(e) => setFormData({ ...formData, smtpFrom: e.target.value })}
                                placeholder="noreply@yourdomain.com"
                            />
                            <p className="text-xs text-slate-500">
                                Email address that will appear as the sender
                            </p>
                        </div>

                        {/* Secure Connection Toggle */}
                        <div className="flex items-center justify-between p-4 bg-slate-50 rounded-lg border border-slate-200">
                            <div className="space-y-1">
                                <Label htmlFor="smtpSecure" className="text-sm font-medium">
                                    Use Secure Connection (TLS/SSL)
                                </Label>
                                <p className="text-xs text-slate-500">
                                    Enable TLS/SSL encryption for secure email transmission
                                </p>
                            </div>
                            <Switch
                                id="smtpSecure"
                                checked={formData.smtpSecure}
                                onCheckedChange={(checked) => setFormData({ ...formData, smtpSecure: checked })}
                                className="data-[state=checked]:bg-orange-600"
                            />
                        </div>

                        {/* Action Buttons */}
                        <div className="flex items-center gap-3 pt-4 border-t border-slate-200">
                            <Button
                                onClick={handleSave}
                                disabled={updateConfigMutation.isPending}
                                className="bg-orange-600 hover:bg-orange-700"
                            >
                                {updateConfigMutation.isPending ? (
                                    <>
                                        <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                                        Saving...
                                    </>
                                ) : (
                                    <>
                                        <Save className="h-4 w-4 mr-2" />
                                        Save Settings
                                    </>
                                )}
                            </Button>
                            <Button
                                onClick={handleCancel}
                                variant="outline"
                                disabled={updateConfigMutation.isPending}
                            >
                                Cancel
                            </Button>
                        </div>
                    </div>
                ) : (
                    <div className="space-y-6">
                        {/* Test Email Result */}
                        {testEmailResult && (
                            <Alert
                                variant={testEmailResult.success ? "default" : "destructive"}
                                className={testEmailResult.success ? "bg-green-50 border-green-200" : ""}
                            >
                                {testEmailResult.success ? (
                                    <CheckCircle2 className="h-4 w-4 text-green-600" />
                                ) : (
                                    <XCircle className="h-4 w-4" />
                                )}
                                <AlertDescription className={testEmailResult.success ? "text-green-900" : ""}>
                                    {testEmailResult.message}
                                </AlertDescription>
                            </Alert>
                        )}

                        {/* Current Configuration Display */}
                        <div className="space-y-4">
                            {/* SMTP Host */}
                            <div className="flex items-center justify-between p-4 bg-slate-50 rounded-lg border border-slate-200">
                                <div className="flex-1">
                                    <div className="font-medium text-slate-900">SMTP Host</div>
                                    <div className="text-sm text-slate-500 mt-1">
                                        SMTP server hostname
                                    </div>
                                </div>
                                <div className="text-sm text-slate-600 font-mono bg-white px-3 py-1 rounded border border-slate-200">
                                    {config?.smtpHost || 'Not configured'}
                                </div>
                            </div>

                            {/* SMTP Port */}
                            <div className="flex items-center justify-between p-4 bg-slate-50 rounded-lg border border-slate-200">
                                <div className="flex-1">
                                    <div className="font-medium text-slate-900">SMTP Port</div>
                                    <div className="text-sm text-slate-500 mt-1">
                                        SMTP server port
                                    </div>
                                </div>
                                <div className="text-sm text-slate-600 font-mono bg-white px-3 py-1 rounded border border-slate-200">
                                    {config?.smtpPort || 'Not configured'}
                                </div>
                            </div>

                            {/* SMTP User */}
                            <div className="flex items-center justify-between p-4 bg-slate-50 rounded-lg border border-slate-200">
                                <div className="flex-1">
                                    <div className="font-medium text-slate-900">SMTP Username</div>
                                    <div className="text-sm text-slate-500 mt-1">
                                        SMTP authentication username
                                    </div>
                                </div>
                                <div className="text-sm text-slate-600 font-mono bg-white px-3 py-1 rounded border border-slate-200">
                                    {config?.smtpUser || 'Not configured'}
                                </div>
                            </div>

                            {/* SMTP Password Status */}
                            <div className="flex items-center justify-between p-4 bg-slate-50 rounded-lg border border-slate-200">
                                <div className="flex-1">
                                    <div className="font-medium text-slate-900">SMTP Password</div>
                                    <div className="text-sm text-slate-500 mt-1">
                                        SMTP authentication password
                                    </div>
                                </div>
                                <div className="flex items-center gap-3">
                                    {config?.hasPassword ? (
                                        <>
                                            <Badge variant="default" className="bg-green-100 text-green-800">
                                                <Check className="h-3 w-3 mr-1" />
                                                Configured
                                            </Badge>
                                            <div className="text-sm text-slate-600 font-mono bg-white px-3 py-1 rounded border border-slate-200">
                                                ••••••••
                                            </div>
                                        </>
                                    ) : (
                                        <Badge variant="secondary" className="bg-orange-100 text-orange-800">
                                            <AlertTriangle className="h-3 w-3 mr-1" />
                                            Not Configured
                                        </Badge>
                                    )}
                                </div>
                            </div>

                            {/* Sender Email */}
                            <div className="flex items-center justify-between p-4 bg-slate-50 rounded-lg border border-slate-200">
                                <div className="flex-1">
                                    <div className="font-medium text-slate-900">Sender Email</div>
                                    <div className="text-sm text-slate-500 mt-1">
                                        Email address for outgoing messages
                                    </div>
                                </div>
                                <div className="text-sm text-slate-600 font-mono bg-white px-3 py-1 rounded border border-slate-200">
                                    {config?.smtpFrom || 'Not configured'}
                                </div>
                            </div>

                            {/* Secure Connection */}
                            <div className="flex items-center justify-between p-4 bg-slate-50 rounded-lg border border-slate-200">
                                <div className="flex-1">
                                    <div className="font-medium text-slate-900">Secure Connection</div>
                                    <div className="text-sm text-slate-500 mt-1">
                                        TLS/SSL encryption status
                                    </div>
                                </div>
                                <Badge
                                    variant={config?.smtpSecure ? "default" : "secondary"}
                                    className={config?.smtpSecure ? "bg-green-100 text-green-800" : "bg-gray-100 text-gray-800"}
                                >
                                    {config?.smtpSecure ? "Enabled" : "Disabled"}
                                </Badge>
                            </div>

                            {/* Configuration Source */}
                            {config?.source && (
                                <div className="flex items-center gap-2 text-xs text-slate-500 bg-slate-50 px-3 py-2 rounded border border-slate-200">
                                    <AlertCircle className="h-3 w-3" />
                                    <span>
                                        Configuration source: <span className="font-medium">{config.source}</span>
                                    </span>
                                </div>
                            )}
                        </div>

                        {/* Test Email Section */}
                        <div className="pt-6 border-t border-slate-200">
                            <h3 className="text-sm font-medium text-slate-900 mb-3">Test Email Configuration</h3>
                            <div className="flex items-end gap-3">
                                <div className="flex-1 space-y-2">
                                    <Label htmlFor="testEmail" className="text-sm">
                                        Recipient Email
                                    </Label>
                                    <Input
                                        id="testEmail"
                                        type="email"
                                        value={testEmailAddress}
                                        onChange={(e) => setTestEmailAddress(e.target.value)}
                                        placeholder="test@example.com"
                                    />
                                </div>
                                <Button
                                    onClick={handleTestEmail}
                                    disabled={testEmailMutation.isPending || !config?.hasPassword}
                                    variant="outline"
                                    className="border-orange-200 text-orange-600 hover:bg-orange-50"
                                >
                                    {testEmailMutation.isPending ? (
                                        <>
                                            <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                                            Sending...
                                        </>
                                    ) : (
                                        <>
                                            <Mail className="h-4 w-4 mr-2" />
                                            Send Test Email
                                        </>
                                    )}
                                </Button>
                            </div>
                            {!config?.hasPassword && (
                                <p className="text-xs text-orange-600 mt-2">
                                    Please configure email settings before testing
                                </p>
                            )}
                        </div>
                    </div>
                )}
            </CardContent>
        </Card>
    );
}

// Payment Gateway Settings Component
function PaymentGatewaySettings() {
    const { toast } = useToast();
    const queryClient = useQueryClient();
    const [isEditing, setIsEditing] = useState(false);
    const [formData, setFormData] = useState({
        serverKey: '',
        clientKey: '',
        isProduction: false,
        webhookUrl: '',
    });
    const [testingConnection, setTestingConnection] = useState(false);
    const [connectionTestResult, setConnectionTestResult] = useState<{
        success: boolean;
        message: string;
    } | null>(null);

    // Fetch payment gateway configuration
    const { data, isLoading, error } = useQuery<PaymentGatewayResponse>({
        queryKey: ["/api/admin/settings/payment"],
        queryFn: async () => {
            const adminToken = localStorage.getItem('admin-token');
            if (!adminToken) {
                throw new Error('No admin token');
            }

            const res = await fetch('/api/admin/settings/payment', {
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

    // Update payment gateway configuration
    const updateConfigMutation = useMutation({
        mutationFn: async (config: typeof formData) => {
            const adminToken = localStorage.getItem('admin-token');
            if (!adminToken) {
                throw new Error('No admin token');
            }

            const res = await fetch('/api/admin/settings/payment', {
                method: 'PUT',
                headers: {
                    'Authorization': `Bearer ${adminToken}`,
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify(config),
            });

            if (!res.ok) {
                const error = await res.json();
                throw new Error(error.error?.message || 'Failed to update payment gateway settings');
            }

            return res.json() as Promise<PaymentGatewayUpdateResponse>;
        },
        onSuccess: (response) => {
            toast({
                title: "Settings Updated",
                description: "Payment gateway settings have been updated successfully.",
            });
            queryClient.invalidateQueries({ queryKey: ["/api/admin/settings/payment"] });
            setIsEditing(false);

            // Show connection test result
            if (response.data.connectionTest) {
                setConnectionTestResult(response.data.connectionTest);
            }
        },
        onError: (error: Error) => {
            toast({
                title: "Update Failed",
                description: error.message,
                variant: "destructive",
            });
        },
    });

    // Handle edit mode
    const handleEdit = () => {
        if (data?.data) {
            // When editing, we need to prompt for new keys since we can't decrypt the stored ones
            setFormData({
                serverKey: '',
                clientKey: '',
                isProduction: data.data.isProduction,
                webhookUrl: data.data.webhookUrl || '',
            });
        }
        setIsEditing(true);
        setConnectionTestResult(null);
    };

    // Handle cancel
    const handleCancel = () => {
        setIsEditing(false);
        setFormData({
            serverKey: '',
            clientKey: '',
            isProduction: false,
            webhookUrl: '',
        });
        setConnectionTestResult(null);
    };

    // Handle save
    const handleSave = () => {
        // Validate form
        if (!formData.serverKey.trim()) {
            toast({
                title: "Validation Error",
                description: "Server Key is required.",
                variant: "destructive",
            });
            return;
        }

        if (!formData.clientKey.trim()) {
            toast({
                title: "Validation Error",
                description: "Client Key is required.",
                variant: "destructive",
            });
            return;
        }

        if (formData.webhookUrl && !formData.webhookUrl.startsWith('http')) {
            toast({
                title: "Validation Error",
                description: "Webhook URL must be a valid URL starting with http:// or https://",
                variant: "destructive",
            });
            return;
        }

        updateConfigMutation.mutate(formData);
    };

    // Handle test connection
    const handleTestConnection = async () => {
        if (!data?.data) return;

        setTestingConnection(true);
        setConnectionTestResult(null);

        try {
            const adminToken = localStorage.getItem('admin-token');
            if (!adminToken) {
                throw new Error('No admin token');
            }

            // We'll trigger a save which automatically tests the connection
            // For now, just show a message that they need to save first
            toast({
                title: "Test Connection",
                description: "Please save your settings first. The connection will be tested automatically.",
            });
        } catch (error) {
            toast({
                title: "Test Failed",
                description: error instanceof Error ? error.message : "Failed to test connection",
                variant: "destructive",
            });
        } finally {
            setTestingConnection(false);
        }
    };

    const config = data?.data;

    if (isLoading) {
        return (
            <Card className="border-slate-200">
                <CardContent className="pt-6">
                    <div className="flex items-center justify-center py-8">
                        <Loader2 className="h-8 w-8 animate-spin text-slate-400" />
                    </div>
                </CardContent>
            </Card>
        );
    }

    if (error) {
        return (
            <Card className="border-slate-200">
                <CardContent className="pt-6">
                    <Alert variant="destructive">
                        <AlertCircle className="h-4 w-4" />
                        <AlertDescription>
                            Failed to load payment gateway settings. Please try again.
                        </AlertDescription>
                    </Alert>
                </CardContent>
            </Card>
        );
    }

    return (
        <Card className="border-slate-200">
            <CardHeader className="bg-gradient-to-r from-slate-50 to-white border-b border-slate-100">
                <div className="flex items-center justify-between">
                    <div>
                        <CardTitle className="flex items-center gap-2 text-lg">
                            <CreditCard className="h-5 w-5 text-green-600" />
                            Payment Gateway Settings
                        </CardTitle>
                        <CardDescription>
                            Configure Midtrans payment gateway credentials
                        </CardDescription>
                    </div>
                    {!isEditing && (
                        <Button
                            onClick={handleEdit}
                            variant="outline"
                            className="border-green-200 text-green-600 hover:bg-green-50"
                        >
                            <Edit className="h-4 w-4 mr-2" />
                            Edit Settings
                        </Button>
                    )}
                </div>
            </CardHeader>
            <CardContent className="pt-6">
                {isEditing ? (
                    <div className="space-y-6">
                        {/* Alert about updating credentials */}
                        <Alert className="bg-blue-50 border-blue-200">
                            <AlertTriangle className="h-4 w-4 text-blue-600" />
                            <AlertDescription className="text-blue-900">
                                For security reasons, you need to re-enter your Midtrans credentials to update them.
                                The connection will be tested automatically when you save.
                            </AlertDescription>
                        </Alert>

                        {/* Server Key */}
                        <div className="space-y-2">
                            <Label htmlFor="serverKey" className="text-sm font-medium">
                                Midtrans Server Key *
                            </Label>
                            <Input
                                id="serverKey"
                                type="password"
                                value={formData.serverKey}
                                onChange={(e) => setFormData({ ...formData, serverKey: e.target.value })}
                                placeholder="Enter your Midtrans Server Key..."
                                className="font-mono"
                            />
                            <p className="text-xs text-slate-500">
                                Your Midtrans Server Key (starts with SB- for sandbox or Mid- for production)
                            </p>
                        </div>

                        {/* Client Key */}
                        <div className="space-y-2">
                            <Label htmlFor="clientKey" className="text-sm font-medium">
                                Midtrans Client Key *
                            </Label>
                            <Input
                                id="clientKey"
                                type="password"
                                value={formData.clientKey}
                                onChange={(e) => setFormData({ ...formData, clientKey: e.target.value })}
                                placeholder="Enter your Midtrans Client Key..."
                                className="font-mono"
                            />
                            <p className="text-xs text-slate-500">
                                Your Midtrans Client Key (starts with SB- for sandbox or Mid- for production)
                            </p>
                        </div>

                        {/* Production Mode Toggle */}
                        <div className="flex items-center justify-between p-4 bg-slate-50 rounded-lg border border-slate-200">
                            <div className="space-y-1">
                                <Label htmlFor="isProduction" className="text-sm font-medium">
                                    Production Mode
                                </Label>
                                <p className="text-xs text-slate-500">
                                    Enable this to use production Midtrans API (live payments)
                                </p>
                            </div>
                            <Switch
                                id="isProduction"
                                checked={formData.isProduction}
                                onCheckedChange={(checked) => setFormData({ ...formData, isProduction: checked })}
                                className="data-[state=checked]:bg-green-600"
                            />
                        </div>

                        {/* Webhook URL */}
                        <div className="space-y-2">
                            <Label htmlFor="webhookUrl" className="text-sm font-medium">
                                Webhook URL (Optional)
                            </Label>
                            <Input
                                id="webhookUrl"
                                type="url"
                                value={formData.webhookUrl}
                                onChange={(e) => setFormData({ ...formData, webhookUrl: e.target.value })}
                                placeholder="https://yourdomain.com/api/webhooks/midtrans"
                                className="font-mono"
                            />
                            <p className="text-xs text-slate-500">
                                The URL where Midtrans will send payment notifications
                            </p>
                        </div>

                        {/* Action Buttons */}
                        <div className="flex items-center gap-3 pt-4 border-t border-slate-200">
                            <Button
                                onClick={handleSave}
                                disabled={updateConfigMutation.isPending}
                                className="bg-green-600 hover:bg-green-700"
                            >
                                {updateConfigMutation.isPending ? (
                                    <>
                                        <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                                        Saving & Testing...
                                    </>
                                ) : (
                                    <>
                                        <Save className="h-4 w-4 mr-2" />
                                        Save & Test Connection
                                    </>
                                )}
                            </Button>
                            <Button
                                onClick={handleCancel}
                                variant="outline"
                                disabled={updateConfigMutation.isPending}
                            >
                                Cancel
                            </Button>
                        </div>
                    </div>
                ) : (
                    <div className="space-y-6">
                        {/* Connection Test Result */}
                        {connectionTestResult && (
                            <Alert
                                variant={connectionTestResult.success ? "default" : "destructive"}
                                className={connectionTestResult.success ? "bg-green-50 border-green-200" : ""}
                            >
                                {connectionTestResult.success ? (
                                    <CheckCircle2 className="h-4 w-4 text-green-600" />
                                ) : (
                                    <XCircle className="h-4 w-4" />
                                )}
                                <AlertDescription className={connectionTestResult.success ? "text-green-900" : ""}>
                                    {connectionTestResult.message}
                                </AlertDescription>
                            </Alert>
                        )}

                        {/* Current Configuration Display */}
                        <div className="space-y-4">
                            {/* Server Key Status */}
                            <div className="flex items-center justify-between p-4 bg-slate-50 rounded-lg border border-slate-200">
                                <div className="flex-1">
                                    <div className="font-medium text-slate-900">Server Key</div>
                                    <div className="text-sm text-slate-500 mt-1">
                                        Midtrans Server Key for API authentication
                                    </div>
                                </div>
                                <div className="flex items-center gap-3">
                                    {config?.hasServerKey ? (
                                        <>
                                            <Badge variant="default" className="bg-green-100 text-green-800">
                                                <Check className="h-3 w-3 mr-1" />
                                                Configured
                                            </Badge>
                                            <div className="text-sm text-slate-600 font-mono bg-white px-3 py-1 rounded border border-slate-200">
                                                {config.serverKey}
                                            </div>
                                        </>
                                    ) : (
                                        <Badge variant="secondary" className="bg-orange-100 text-orange-800">
                                            <AlertTriangle className="h-3 w-3 mr-1" />
                                            Not Configured
                                        </Badge>
                                    )}
                                </div>
                            </div>

                            {/* Client Key Status */}
                            <div className="flex items-center justify-between p-4 bg-slate-50 rounded-lg border border-slate-200">
                                <div className="flex-1">
                                    <div className="font-medium text-slate-900">Client Key</div>
                                    <div className="text-sm text-slate-500 mt-1">
                                        Midtrans Client Key for frontend integration
                                    </div>
                                </div>
                                <div className="flex items-center gap-3">
                                    {config?.hasClientKey ? (
                                        <>
                                            <Badge variant="default" className="bg-green-100 text-green-800">
                                                <Check className="h-3 w-3 mr-1" />
                                                Configured
                                            </Badge>
                                            <div className="text-sm text-slate-600 font-mono bg-white px-3 py-1 rounded border border-slate-200">
                                                {config.clientKey}
                                            </div>
                                        </>
                                    ) : (
                                        <Badge variant="secondary" className="bg-orange-100 text-orange-800">
                                            <AlertTriangle className="h-3 w-3 mr-1" />
                                            Not Configured
                                        </Badge>
                                    )}
                                </div>
                            </div>

                            {/* Production Mode */}
                            <div className="flex items-center justify-between p-4 bg-slate-50 rounded-lg border border-slate-200">
                                <div className="flex-1">
                                    <div className="font-medium text-slate-900">Environment</div>
                                    <div className="text-sm text-slate-500 mt-1">
                                        Current Midtrans API environment
                                    </div>
                                </div>
                                <Badge
                                    variant={config?.isProduction ? "default" : "secondary"}
                                    className={config?.isProduction ? "bg-red-100 text-red-800" : "bg-blue-100 text-blue-800"}
                                >
                                    {config?.isProduction ? "Production (Live)" : "Sandbox (Test)"}
                                </Badge>
                            </div>

                            {/* Webhook URL */}
                            <div className="flex items-center justify-between p-4 bg-slate-50 rounded-lg border border-slate-200">
                                <div className="flex-1">
                                    <div className="font-medium text-slate-900">Webhook URL</div>
                                    <div className="text-sm text-slate-500 mt-1">
                                        Endpoint for payment notifications
                                    </div>
                                </div>
                                <div className="text-sm text-slate-600 font-mono bg-white px-3 py-1 rounded border border-slate-200 max-w-md truncate">
                                    {config?.webhookUrl || 'Not configured'}
                                </div>
                            </div>

                            {/* Configuration Source */}
                            {config?.source && (
                                <div className="flex items-center gap-2 text-xs text-slate-500 bg-slate-50 px-3 py-2 rounded border border-slate-200">
                                    <AlertCircle className="h-3 w-3" />
                                    <span>
                                        Configuration source: <span className="font-medium">{config.source}</span>
                                    </span>
                                </div>
                            )}
                        </div>
                    </div>
                )}
            </CardContent>
        </Card>
    );
}

// Audit Log Component
function AuditLogViewer() {
    const [page, setPage] = useState(1);
    const [limit] = useState(20);
    const [filters, setFilters] = useState({
        action: '',
        resourceType: '',
        dateFrom: '',
        dateTo: '',
    });

    // Fetch audit logs
    const { data, isLoading, error } = useQuery<AuditLogResponse>({
        queryKey: ["/api/admin/settings/audit-log", page, limit, filters],
        queryFn: async () => {
            const adminToken = localStorage.getItem('admin-token') || sessionStorage.getItem('admin-token');
            if (!adminToken) {
                throw new Error('No admin token');
            }

            const params = new URLSearchParams({
                page: page.toString(),
                limit: limit.toString(),
            });

            if (filters.action) params.append('action', filters.action);
            if (filters.resourceType) params.append('resourceType', filters.resourceType);
            if (filters.dateFrom) params.append('dateFrom', filters.dateFrom);
            if (filters.dateTo) params.append('dateTo', filters.dateTo);

            const res = await fetch(`/api/admin/settings/audit-log?${params}`, {
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

    // Format date
    const formatDate = (timestamp: number) => {
        return new Date(timestamp * 1000).toLocaleString('id-ID', {
            year: 'numeric',
            month: 'short',
            day: 'numeric',
            hour: '2-digit',
            minute: '2-digit',
        });
    };

    // Get action badge color
    const getActionBadgeColor = (action: string) => {
        if (action.includes('CREATE')) return 'bg-green-100 text-green-800';
        if (action.includes('UPDATE')) return 'bg-blue-100 text-blue-800';
        if (action.includes('DELETE')) return 'bg-red-100 text-red-800';
        if (action.includes('LOGIN')) return 'bg-purple-100 text-purple-800';
        if (action.includes('LOGOUT')) return 'bg-gray-100 text-gray-800';
        return 'bg-slate-100 text-slate-800';
    };

    const logs = data?.data.logs || [];
    const totalPages = data?.data.totalPages || 1;

    if (isLoading) {
        return (
            <Card className="border-slate-200">
                <CardContent className="pt-6">
                    <div className="flex items-center justify-center py-8">
                        <Loader2 className="h-8 w-8 animate-spin text-slate-400" />
                    </div>
                </CardContent>
            </Card>
        );
    }

    if (error) {
        return (
            <Card className="border-slate-200">
                <CardContent className="pt-6">
                    <Alert variant="destructive">
                        <AlertCircle className="h-4 w-4" />
                        <AlertDescription>
                            Failed to load audit logs. Please try again.
                        </AlertDescription>
                    </Alert>
                </CardContent>
            </Card>
        );
    }

    return (
        <Card className="border-slate-200">
            <CardHeader className="bg-gradient-to-r from-slate-50 to-white border-b border-slate-100">
                <CardTitle className="flex items-center gap-2 text-lg">
                    <History className="h-5 w-5 text-slate-600" />
                    Audit Log
                </CardTitle>
                <CardDescription>
                    View admin activity and setting changes
                </CardDescription>
            </CardHeader>
            <CardContent className="pt-6">
                {/* Filters */}
                <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
                    <div className="space-y-2">
                        <Label htmlFor="actionFilter" className="text-sm">
                            Action
                        </Label>
                        <Input
                            id="actionFilter"
                            placeholder="Filter by action..."
                            value={filters.action}
                            onChange={(e) => {
                                setFilters({ ...filters, action: e.target.value });
                                setPage(1);
                            }}
                        />
                    </div>
                    <div className="space-y-2">
                        <Label htmlFor="resourceTypeFilter" className="text-sm">
                            Resource Type
                        </Label>
                        <Input
                            id="resourceTypeFilter"
                            placeholder="Filter by resource..."
                            value={filters.resourceType}
                            onChange={(e) => {
                                setFilters({ ...filters, resourceType: e.target.value });
                                setPage(1);
                            }}
                        />
                    </div>
                    <div className="space-y-2">
                        <Label htmlFor="dateFromFilter" className="text-sm">
                            Date From
                        </Label>
                        <Input
                            id="dateFromFilter"
                            type="date"
                            value={filters.dateFrom}
                            onChange={(e) => {
                                setFilters({ ...filters, dateFrom: e.target.value });
                                setPage(1);
                            }}
                        />
                    </div>
                    <div className="space-y-2">
                        <Label htmlFor="dateToFilter" className="text-sm">
                            Date To
                        </Label>
                        <Input
                            id="dateToFilter"
                            type="date"
                            value={filters.dateTo}
                            onChange={(e) => {
                                setFilters({ ...filters, dateTo: e.target.value });
                                setPage(1);
                            }}
                        />
                    </div>
                </div>

                {/* Audit Log Table */}
                {logs.length > 0 ? (
                    <div className="space-y-4">
                        <div className="rounded-lg border border-slate-200 overflow-hidden">
                            <div className="overflow-x-auto">
                                <table className="w-full">
                                    <thead className="bg-slate-50 border-b border-slate-200">
                                        <tr>
                                            <th className="px-4 py-3 text-left text-xs font-medium text-slate-600 uppercase tracking-wider">
                                                Timestamp
                                            </th>
                                            <th className="px-4 py-3 text-left text-xs font-medium text-slate-600 uppercase tracking-wider">
                                                Admin
                                            </th>
                                            <th className="px-4 py-3 text-left text-xs font-medium text-slate-600 uppercase tracking-wider">
                                                Action
                                            </th>
                                            <th className="px-4 py-3 text-left text-xs font-medium text-slate-600 uppercase tracking-wider">
                                                Resource
                                            </th>
                                            <th className="px-4 py-3 text-left text-xs font-medium text-slate-600 uppercase tracking-wider">
                                                IP Address
                                            </th>
                                        </tr>
                                    </thead>
                                    <tbody className="bg-white divide-y divide-slate-200">
                                        {logs.map((log) => (
                                            <tr key={log.id} className="hover:bg-slate-50 transition-colors">
                                                <td className="px-4 py-3 text-sm text-slate-900 whitespace-nowrap">
                                                    {formatDate(log.createdAt)}
                                                </td>
                                                <td className="px-4 py-3 text-sm">
                                                    <div className="font-medium text-slate-900">{log.adminName}</div>
                                                    <div className="text-xs text-slate-500">{log.adminEmail}</div>
                                                </td>
                                                <td className="px-4 py-3 text-sm">
                                                    <Badge className={getActionBadgeColor(log.action)}>
                                                        {log.action}
                                                    </Badge>
                                                </td>
                                                <td className="px-4 py-3 text-sm">
                                                    <div className="font-medium text-slate-900">{log.resourceType}</div>
                                                    {log.resourceId && (
                                                        <div className="text-xs text-slate-500 font-mono">
                                                            {log.resourceId}
                                                        </div>
                                                    )}
                                                </td>
                                                <td className="px-4 py-3 text-sm text-slate-600 font-mono whitespace-nowrap">
                                                    {log.ipAddress || '-'}
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        </div>

                        {/* Pagination */}
                        <div className="flex items-center justify-between">
                            <div className="text-sm text-slate-600">
                                Showing page {page} of {totalPages} ({data?.data.total} total entries)
                            </div>
                            <div className="flex items-center gap-2">
                                <Button
                                    variant="outline"
                                    size="sm"
                                    onClick={() => setPage(Math.max(1, page - 1))}
                                    disabled={page === 1}
                                >
                                    Previous
                                </Button>
                                <Button
                                    variant="outline"
                                    size="sm"
                                    onClick={() => setPage(Math.min(totalPages, page + 1))}
                                    disabled={page === totalPages}
                                >
                                    Next
                                </Button>
                            </div>
                        </div>
                    </div>
                ) : (
                    <div className="text-center py-12 text-slate-500">
                        <History className="h-12 w-12 text-slate-300 mx-auto mb-3" />
                        <p className="font-medium">No audit logs found</p>
                        <p className="text-sm mt-1">
                            {filters.action || filters.resourceType || filters.dateFrom || filters.dateTo
                                ? 'Try adjusting your filters'
                                : 'Admin activity will appear here'}
                        </p>
                    </div>
                )}
            </CardContent>
        </Card>
    );
}

export default function SystemSettings() {
    const [activeTab, setActiveTab] = useState("general");
    const { toast } = useToast();
    const queryClient = useQueryClient();

    // Edit dialog state
    const [editDialogOpen, setEditDialogOpen] = useState(false);
    const [editingSetting, setEditingSetting] = useState<SystemSetting | null>(null);
    const [editValue, setEditValue] = useState("");

    // Fetch all system settings
    const { data, isLoading, error } = useQuery<SettingsResponse>({
        queryKey: ["/api/admin/settings"],
        queryFn: async () => {
            const adminToken = localStorage.getItem('admin-token');
            if (!adminToken) {
                throw new Error('No admin token');
            }

            const res = await fetch('/api/admin/settings', {
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

    // Fetch feature flags
    const { data: featureFlagsData, isLoading: featureFlagsLoading } = useQuery<FeatureFlagsResponse>({
        queryKey: ["/api/admin/settings/features"],
        queryFn: async () => {
            const adminToken = localStorage.getItem('admin-token');
            if (!adminToken) {
                throw new Error('No admin token');
            }

            const res = await fetch('/api/admin/settings/features', {
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

    // Update setting mutation
    const updateSettingMutation = useMutation({
        mutationFn: async ({ key, value }: { key: string; value: string }) => {
            const adminToken = localStorage.getItem('admin-token');
            if (!adminToken) {
                throw new Error('No admin token');
            }

            const res = await fetch(`/api/admin/settings/${key}`, {
                method: 'PUT',
                headers: {
                    'Authorization': `Bearer ${adminToken}`,
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({ value }),
            });

            if (!res.ok) {
                const error = await res.json();
                throw new Error(error.error?.message || 'Failed to update setting');
            }

            return res.json();
        },
        onSuccess: () => {
            toast({
                title: "Setting Updated",
                description: "The setting has been updated successfully.",
            });
            queryClient.invalidateQueries({ queryKey: ["/api/admin/settings"] });
            setEditDialogOpen(false);
            setEditingSetting(null);
            setEditValue("");
        },
        onError: (error: Error) => {
            toast({
                title: "Update Failed",
                description: error.message,
                variant: "destructive",
            });
        },
    });

    // Update feature flag mutation
    const updateFeatureFlagMutation = useMutation({
        mutationFn: async ({ key, enabled, plans }: { key: string; enabled: boolean; plans: string[] }) => {
            const adminToken = localStorage.getItem('admin-token');
            if (!adminToken) {
                throw new Error('No admin token');
            }

            const res = await fetch(`/api/admin/settings/features/${key}`, {
                method: 'PUT',
                headers: {
                    'Authorization': `Bearer ${adminToken}`,
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({ enabled, plans }),
            });

            if (!res.ok) {
                const error = await res.json();
                throw new Error(error.error?.message || 'Failed to update feature flag');
            }

            return res.json();
        },
        onSuccess: () => {
            toast({
                title: "Feature Flag Updated",
                description: "The feature flag has been updated successfully.",
            });
            queryClient.invalidateQueries({ queryKey: ["/api/admin/settings/features"] });
        },
        onError: (error: Error) => {
            toast({
                title: "Update Failed",
                description: error.message,
                variant: "destructive",
            });
        },
    });

    // Handle edit setting
    const handleEditSetting = (setting: SystemSetting) => {
        setEditingSetting(setting);
        setEditValue(setting.value);
        setEditDialogOpen(true);
    };

    // Handle save setting
    const handleSaveSetting = () => {
        if (!editingSetting) return;
        if (!editValue.trim()) {
            toast({
                title: "Validation Error",
                description: "Setting value cannot be empty.",
                variant: "destructive",
            });
            return;
        }
        updateSettingMutation.mutate({ key: editingSetting.key, value: editValue });
    };

    // Handle toggle feature flag
    const handleToggleFeatureFlag = (featureKey: string, currentEnabled: boolean, plans: string[]) => {
        updateFeatureFlagMutation.mutate({
            key: featureKey,
            enabled: !currentEnabled,
            plans: plans,
        });
    };

    // Handle update feature flag plans
    const handleUpdateFeaturePlans = (featureKey: string, enabled: boolean, newPlans: string[]) => {
        updateFeatureFlagMutation.mutate({
            key: featureKey,
            enabled: enabled,
            plans: newPlans,
        });
    };

    const settings = data?.data || [];
    const featureFlags = featureFlagsData?.data || [];

    // Group settings by category
    const settingsByCategory = settings.reduce((acc, setting) => {
        if (!acc[setting.category]) {
            acc[setting.category] = [];
        }
        acc[setting.category].push(setting);
        return acc;
    }, {} as Record<string, SystemSetting[]>);

    if (isLoading) {
        return (
            <AdminLayout>
                <div className="flex items-center justify-center h-96">
                    <div className="text-center">
                        <Loader2 className="h-8 w-8 animate-spin text-slate-600 mx-auto mb-4" />
                        <p className="text-slate-600">Loading system settings...</p>
                    </div>
                </div>
            </AdminLayout>
        );
    }

    if (error) {
        return (
            <AdminLayout>
                <Alert variant="destructive">
                    <AlertCircle className="h-4 w-4" />
                    <AlertDescription>
                        Failed to load system settings. Please try again.
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
                            System Settings
                        </h1>
                        <p className="text-slate-600 mt-2 font-medium">
                            Configure application settings and feature flags
                        </p>
                    </div>
                    <div className="flex items-center gap-2 text-sm text-slate-500 bg-white px-4 py-2 rounded-lg border border-slate-200 shadow-sm">
                        <Settings className="h-4 w-4" />
                        <span className="font-medium">{settings.length} settings</span>
                    </div>
                </div>

                {/* Settings Tabs */}
                <Card className="border-slate-200 shadow-md">
                    <CardContent className="p-6">
                        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
                            <TabsList className="grid w-full grid-cols-5 bg-slate-100 p-1 rounded-lg">
                                <TabsTrigger
                                    value="general"
                                    className="flex items-center gap-2 data-[state=active]:bg-white data-[state=active]:shadow-sm"
                                >
                                    <Globe className="h-4 w-4" />
                                    <span className="hidden sm:inline">General</span>
                                </TabsTrigger>
                                <TabsTrigger
                                    value="features"
                                    className="flex items-center gap-2 data-[state=active]:bg-white data-[state=active]:shadow-sm"
                                >
                                    <Flag className="h-4 w-4" />
                                    <span className="hidden sm:inline">Features</span>
                                </TabsTrigger>
                                <TabsTrigger
                                    value="payment"
                                    className="flex items-center gap-2 data-[state=active]:bg-white data-[state=active]:shadow-sm"
                                >
                                    <CreditCard className="h-4 w-4" />
                                    <span className="hidden sm:inline">Payment</span>
                                </TabsTrigger>
                                <TabsTrigger
                                    value="email"
                                    className="flex items-center gap-2 data-[state=active]:bg-white data-[state=active]:shadow-sm"
                                >
                                    <Mail className="h-4 w-4" />
                                    <span className="hidden sm:inline">Email</span>
                                </TabsTrigger>
                                <TabsTrigger
                                    value="audit"
                                    className="flex items-center gap-2 data-[state=active]:bg-white data-[state=active]:shadow-sm"
                                >
                                    <History className="h-4 w-4" />
                                    <span className="hidden sm:inline">Audit Log</span>
                                </TabsTrigger>
                            </TabsList>

                            {/* General Settings Tab */}
                            <TabsContent value="general" className="mt-6">
                                <Card className="border-slate-200">
                                    <CardHeader className="bg-gradient-to-r from-slate-50 to-white border-b border-slate-100">
                                        <CardTitle className="flex items-center gap-2 text-lg">
                                            <Globe className="h-5 w-5 text-blue-600" />
                                            General Settings
                                        </CardTitle>
                                        <CardDescription>
                                            Configure general application settings
                                        </CardDescription>
                                    </CardHeader>
                                    <CardContent className="pt-6">
                                        <div className="space-y-4">
                                            {settingsByCategory.general && settingsByCategory.general.length > 0 ? (
                                                settingsByCategory.general.map((setting) => (
                                                    <div
                                                        key={setting.id}
                                                        className="flex items-center justify-between p-4 bg-slate-50 rounded-lg border border-slate-200 hover:border-blue-300 transition-colors"
                                                    >
                                                        <div className="flex-1">
                                                            <div className="font-medium text-slate-900">{setting.key}</div>
                                                            {setting.description && (
                                                                <div className="text-sm text-slate-500 mt-1">
                                                                    {setting.description}
                                                                </div>
                                                            )}
                                                        </div>
                                                        <div className="flex items-center gap-3">
                                                            <div className="text-sm text-slate-600 font-mono bg-white px-3 py-1 rounded border border-slate-200">
                                                                {setting.value}
                                                            </div>
                                                            <Button
                                                                variant="outline"
                                                                size="sm"
                                                                onClick={() => handleEditSetting(setting)}
                                                                className="border-blue-200 text-blue-600 hover:bg-blue-50"
                                                            >
                                                                <Edit className="h-4 w-4" />
                                                            </Button>
                                                        </div>
                                                    </div>
                                                ))
                                            ) : (
                                                <div className="text-center py-8 text-slate-500">
                                                    <Globe className="h-12 w-12 text-slate-300 mx-auto mb-3" />
                                                    <p className="font-medium">No general settings found</p>
                                                    <p className="text-sm mt-1">General settings will appear here</p>
                                                </div>
                                            )}
                                        </div>
                                    </CardContent>
                                </Card>
                            </TabsContent>

                            {/* Feature Flags Tab */}
                            <TabsContent value="features" className="mt-6">
                                <Card className="border-slate-200">
                                    <CardHeader className="bg-gradient-to-r from-slate-50 to-white border-b border-slate-100">
                                        <CardTitle className="flex items-center gap-2 text-lg">
                                            <Flag className="h-5 w-5 text-purple-600" />
                                            Feature Flags
                                        </CardTitle>
                                        <CardDescription>
                                            Enable or disable features per plan
                                        </CardDescription>
                                    </CardHeader>
                                    <CardContent className="pt-6">
                                        {featureFlagsLoading ? (
                                            <div className="flex items-center justify-center py-8">
                                                <Loader2 className="h-8 w-8 animate-spin text-slate-400" />
                                            </div>
                                        ) : (
                                            <div className="space-y-4">
                                                {featureFlags && featureFlags.length > 0 ? (
                                                    featureFlags.map((flag) => (
                                                        <div
                                                            key={flag.id}
                                                            className="flex items-start justify-between p-4 bg-slate-50 rounded-lg border border-slate-200 hover:border-purple-300 transition-colors"
                                                        >
                                                            <div className="flex-1 space-y-3">
                                                                <div className="flex items-center gap-3">
                                                                    <div className="font-medium text-slate-900">{flag.key}</div>
                                                                    <Badge
                                                                        variant={flag.value.enabled ? "default" : "secondary"}
                                                                        className={flag.value.enabled ? "bg-green-100 text-green-800 hover:bg-green-100" : ""}
                                                                    >
                                                                        {flag.value.enabled ? (
                                                                            <>
                                                                                <Check className="h-3 w-3 mr-1" />
                                                                                Enabled
                                                                            </>
                                                                        ) : (
                                                                            <>
                                                                                <X className="h-3 w-3 mr-1" />
                                                                                Disabled
                                                                            </>
                                                                        )}
                                                                    </Badge>
                                                                </div>
                                                                {flag.description && (
                                                                    <div className="text-sm text-slate-500">
                                                                        {flag.description}
                                                                    </div>
                                                                )}
                                                                <div className="flex items-center gap-2 flex-wrap">
                                                                    <span className="text-xs text-slate-500 font-medium">Available for:</span>
                                                                    {flag.value.plans && flag.value.plans.length > 0 ? (
                                                                        flag.value.plans.map((plan) => (
                                                                            <Badge
                                                                                key={plan}
                                                                                variant="outline"
                                                                                className="text-xs capitalize"
                                                                            >
                                                                                {plan}
                                                                            </Badge>
                                                                        ))
                                                                    ) : (
                                                                        <Badge variant="outline" className="text-xs">
                                                                            All Plans
                                                                        </Badge>
                                                                    )}
                                                                </div>
                                                            </div>
                                                            <div className="flex items-center gap-3 ml-4">
                                                                <Switch
                                                                    checked={flag.value.enabled}
                                                                    onCheckedChange={() =>
                                                                        handleToggleFeatureFlag(
                                                                            flag.key,
                                                                            flag.value.enabled,
                                                                            flag.value.plans || []
                                                                        )
                                                                    }
                                                                    disabled={updateFeatureFlagMutation.isPending}
                                                                    className="data-[state=checked]:bg-purple-600"
                                                                />
                                                            </div>
                                                        </div>
                                                    ))
                                                ) : (
                                                    <div className="text-center py-8 text-slate-500">
                                                        <Flag className="h-12 w-12 text-slate-300 mx-auto mb-3" />
                                                        <p className="font-medium">No feature flags found</p>
                                                        <p className="text-sm mt-1">Feature flags will appear here</p>
                                                    </div>
                                                )}
                                            </div>
                                        )}
                                    </CardContent>
                                </Card>
                            </TabsContent>

                            {/* Payment Gateway Settings Tab */}
                            <TabsContent value="payment" className="mt-6">
                                <PaymentGatewaySettings />
                            </TabsContent>

                            {/* Email Settings Tab */}
                            <TabsContent value="email" className="mt-6">
                                <EmailSettings />
                            </TabsContent>

                            {/* Audit Log Tab */}
                            <TabsContent value="audit" className="mt-6">
                                <AuditLogViewer />
                            </TabsContent>
                        </Tabs>
                    </CardContent>
                </Card>

                {/* Edit Setting Dialog */}
                <Dialog open={editDialogOpen} onOpenChange={setEditDialogOpen}>
                    <DialogContent>
                        <DialogHeader>
                            <DialogTitle className="flex items-center gap-2">
                                <Edit className="h-5 w-5 text-blue-600" />
                                Edit Setting
                            </DialogTitle>
                            <DialogDescription>
                                Update the value for this setting. Changes will be applied immediately.
                            </DialogDescription>
                        </DialogHeader>
                        {editingSetting && (
                            <div className="space-y-4 py-4">
                                <div className="space-y-2">
                                    <Label htmlFor="setting-key" className="text-sm font-medium">
                                        Setting Key
                                    </Label>
                                    <Input
                                        id="setting-key"
                                        value={editingSetting.key}
                                        disabled
                                        className="bg-slate-50 font-mono text-sm"
                                    />
                                </div>
                                {editingSetting.description && (
                                    <div className="text-sm text-slate-600 bg-blue-50 p-3 rounded-lg border border-blue-100">
                                        <span className="font-medium text-blue-900">Description:</span>{" "}
                                        {editingSetting.description}
                                    </div>
                                )}
                                <div className="space-y-2">
                                    <Label htmlFor="setting-value" className="text-sm font-medium">
                                        Value *
                                    </Label>
                                    <Input
                                        id="setting-value"
                                        value={editValue}
                                        onChange={(e) => setEditValue(e.target.value)}
                                        placeholder="Enter setting value..."
                                        className="font-mono"
                                    />
                                </div>
                            </div>
                        )}
                        <DialogFooter>
                            <Button
                                variant="outline"
                                onClick={() => {
                                    setEditDialogOpen(false);
                                    setEditingSetting(null);
                                    setEditValue("");
                                }}
                                disabled={updateSettingMutation.isPending}
                            >
                                Cancel
                            </Button>
                            <Button
                                onClick={handleSaveSetting}
                                disabled={updateSettingMutation.isPending || !editValue.trim()}
                                className="bg-blue-600 hover:bg-blue-700"
                            >
                                {updateSettingMutation.isPending ? (
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
                        </DialogFooter>
                    </DialogContent>
                </Dialog>
            </div>
        </AdminLayout>
    );
}
