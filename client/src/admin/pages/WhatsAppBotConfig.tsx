import { useQuery, useMutation } from "@tanstack/react-query";
import { useState } from "react";
import AdminLayout from "../layout/AdminLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import {
    AlertDialog,
    AlertDialogAction,
    AlertDialogCancel,
    AlertDialogContent,
    AlertDialogDescription,
    AlertDialogFooter,
    AlertDialogHeader,
    AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { useToast } from "@/hooks/use-toast";
import {
    MessageSquare,
    AlertCircle,
    CheckCircle,
    XCircle,
    Loader2,
    RefreshCw,
    Phone,
    QrCode,
    Power,
    PowerOff,
    Send,
} from "lucide-react";

interface WhatsAppBotStatus {
    connected: boolean;
    status: string;
    phoneNumber?: string;
    qrCode?: string;
    message?: string;
}

interface WhatsAppStatusResponse {
    success: boolean;
    data: WhatsAppBotStatus;
}

interface WhatsAppBotStatistics {
    totalMessagesSent: number;
    activeConnections: number;
    successRate: number;
    errorLogs: Array<{
        id: number;
        type: string;
        message: string;
        errorMessage: string | null;
        sentAt: number;
    }>;
}

interface WhatsAppStatisticsResponse {
    success: boolean;
    data: WhatsAppBotStatistics;
}

export default function WhatsAppBotConfig() {
    const { toast } = useToast();
    const [showDisconnectDialog, setShowDisconnectDialog] = useState(false);
    const [testPhoneNumber, setTestPhoneNumber] = useState("");
    const [testMessage, setTestMessage] = useState("Hello! This is a test message from Monly WhatsApp Bot.");

    // Fetch WhatsApp bot status
    const { data: statusData, isLoading, error, refetch } = useQuery<WhatsAppStatusResponse>({
        queryKey: ["/api/admin/whatsapp/status"],
        queryFn: async () => {
            const adminToken = localStorage.getItem('admin-token') || sessionStorage.getItem('admin-token');
            if (!adminToken) {
                throw new Error('No admin token');
            }

            const res = await fetch('/api/admin/whatsapp/status', {
                headers: {
                    'Authorization': `Bearer ${adminToken}`,
                },
            });

            if (!res.ok) {
                throw new Error(`HTTP ${res.status}`);
            }

            return res.json();
        },
        refetchInterval: 5000, // Auto-refresh every 5 seconds
    });

    // Fetch WhatsApp bot statistics
    const { data: statisticsData, isLoading: isLoadingStats, error: statsError } = useQuery<WhatsAppStatisticsResponse>({
        queryKey: ["/api/admin/whatsapp/statistics"],
        queryFn: async () => {
            const adminToken = localStorage.getItem('admin-token') || sessionStorage.getItem('admin-token');
            if (!adminToken) {
                throw new Error('No admin token');
            }

            const res = await fetch('/api/admin/whatsapp/statistics', {
                headers: {
                    'Authorization': `Bearer ${adminToken}`,
                },
            });

            if (!res.ok) {
                throw new Error(`HTTP ${res.status}`);
            }

            return res.json();
        },
        refetchInterval: 30000, // Auto-refresh every 30 seconds
    });

    // Connect bot mutation
    const connectMutation = useMutation({
        mutationFn: async () => {
            const adminToken = localStorage.getItem('admin-token') || sessionStorage.getItem('admin-token');
            if (!adminToken) {
                throw new Error('No admin token');
            }

            const res = await fetch('/api/admin/whatsapp/connect', {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${adminToken}`,
                    'Content-Type': 'application/json',
                },
            });

            if (!res.ok) {
                const errorData = await res.json();
                throw new Error(errorData.error?.message || `HTTP ${res.status}`);
            }

            return res.json();
        },
        onSuccess: (data) => {
            console.log('Connect response:', data);

            if (data.success) {
                if (data.data.qrCode) {
                    toast({
                        title: "QR Code Generated",
                        description: "Please scan the QR code with WhatsApp to connect the bot.",
                    });
                } else if (data.data.connected) {
                    toast({
                        title: "Bot Connected",
                        description: "WhatsApp Bot is already connected and ready.",
                    });
                } else {
                    toast({
                        title: "Connection Initiated",
                        description: data.data.message || "Bot connection process started.",
                    });
                }
            }

            // Refetch status to update UI
            refetch();
        },
        onError: (error: Error) => {
            console.error('Connect error:', error);
            toast({
                title: "Connection Failed",
                description: error.message || "Failed to connect WhatsApp Bot. Please try again.",
                variant: "destructive",
            });
        },
    });

    // Disconnect bot mutation
    const disconnectMutation = useMutation({
        mutationFn: async () => {
            const adminToken = localStorage.getItem('admin-token') || sessionStorage.getItem('admin-token');
            if (!adminToken) {
                throw new Error('No admin token');
            }

            const res = await fetch('/api/admin/whatsapp/disconnect', {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${adminToken}`,
                    'Content-Type': 'application/json',
                },
            });

            if (!res.ok) {
                const errorData = await res.json();
                throw new Error(errorData.error?.message || `HTTP ${res.status}`);
            }

            return res.json();
        },
        onSuccess: (data) => {
            console.log('Disconnect response:', data);

            if (data.success) {
                toast({
                    title: "Bot Disconnected",
                    description: "WhatsApp Bot has been disconnected successfully.",
                });
            }

            // Close dialog and refetch status
            setShowDisconnectDialog(false);
            refetch();
        },
        onError: (error: Error) => {
            console.error('Disconnect error:', error);
            toast({
                title: "Disconnection Failed",
                description: error.message || "Failed to disconnect WhatsApp Bot. Please try again.",
                variant: "destructive",
            });
            setShowDisconnectDialog(false);
        },
    });

    // Test message mutation
    const testMessageMutation = useMutation({
        mutationFn: async (data: { phoneNumber: string; message: string }) => {
            const adminToken = localStorage.getItem('admin-token') || sessionStorage.getItem('admin-token');
            if (!adminToken) {
                throw new Error('No admin token');
            }

            const res = await fetch('/api/admin/whatsapp/test', {
                method: 'POST',
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
        onSuccess: (data) => {
            console.log('Test message response:', data);
            toast({
                title: "Test Message Sent",
                description: `Message successfully sent to ${data.data?.phoneNumber || 'the recipient'}.`,
            });
            // Clear form
            setTestPhoneNumber("");
            setTestMessage("Hello! This is a test message from Monly WhatsApp Bot.");
        },
        onError: (error: Error) => {
            console.error('Test message error:', error);
            toast({
                title: "Failed to Send Message",
                description: error.message || "Failed to send test message. Please try again.",
                variant: "destructive",
            });
        },
    });

    const handleSendTestMessage = () => {
        if (!testPhoneNumber.trim()) {
            toast({
                title: "Phone Number Required",
                description: "Please enter a phone number to send the test message.",
                variant: "destructive",
            });
            return;
        }

        if (!testMessage.trim()) {
            toast({
                title: "Message Required",
                description: "Please enter a message to send.",
                variant: "destructive",
            });
            return;
        }

        testMessageMutation.mutate({
            phoneNumber: testPhoneNumber,
            message: testMessage,
        });
    };

    const status = statusData?.data;

    // Get status badge color and icon
    const getStatusDisplay = () => {
        if (!status) return { icon: XCircle, color: 'text-gray-600', bgColor: 'bg-gray-100', borderColor: 'border-gray-200', label: 'Unknown' };

        switch (status.status) {
            case 'ready':
                return { icon: CheckCircle, color: 'text-green-600', bgColor: 'bg-green-100', borderColor: 'border-green-200', label: 'Connected' };
            case 'authenticated':
                return { icon: CheckCircle, color: 'text-blue-600', bgColor: 'bg-blue-100', borderColor: 'border-blue-200', label: 'Authenticated' };
            case 'qr_received':
                return { icon: QrCode, color: 'text-yellow-600', bgColor: 'bg-yellow-100', borderColor: 'border-yellow-200', label: 'QR Code Ready' };
            case 'initializing':
                return { icon: Loader2, color: 'text-blue-600', bgColor: 'bg-blue-100', borderColor: 'border-blue-200', label: 'Initializing' };
            case 'disconnected':
                return { icon: XCircle, color: 'text-red-600', bgColor: 'bg-red-100', borderColor: 'border-red-200', label: 'Disconnected' };
            default:
                return { icon: AlertCircle, color: 'text-gray-600', bgColor: 'bg-gray-100', borderColor: 'border-gray-200', label: status.status };
        }
    };

    const statusDisplay = getStatusDisplay();
    const StatusIcon = statusDisplay.icon;

    return (
        <AdminLayout>
            <div className="space-y-6">
                {/* Page Header */}
                <div className="flex items-center justify-between bg-gradient-to-r from-slate-50 to-white p-6 rounded-xl border border-slate-200 shadow-sm">
                    <div>
                        <h1 className="text-4xl font-bold bg-gradient-to-r from-slate-900 to-slate-700 bg-clip-text text-transparent">
                            WhatsApp Bot Configuration
                        </h1>
                        <p className="text-slate-600 mt-2 font-medium">
                            Monitor and configure the WhatsApp Bot that serves all users
                        </p>
                    </div>
                    <Button
                        variant="outline"
                        onClick={() => refetch()}
                        className="border-green-600 text-green-600 hover:bg-green-50"
                    >
                        <RefreshCw className="h-4 w-4 mr-2" />
                        Refresh Status
                    </Button>
                </div>

                {/* Bot Status Card */}
                <Card className="border-slate-200 shadow-md">
                    <CardHeader className="bg-gradient-to-r from-slate-50 to-white border-b border-slate-100">
                        <CardTitle className="text-lg font-semibold text-slate-700 flex items-center gap-2">
                            <MessageSquare className="h-5 w-5 text-green-600" />
                            Bot Connection Status
                        </CardTitle>
                    </CardHeader>
                    <CardContent className="pt-6">
                        {isLoading && (
                            <div className="flex items-center justify-center py-8">
                                <Loader2 className="h-8 w-8 animate-spin text-slate-600" />
                            </div>
                        )}

                        {error && (
                            <Alert variant="destructive">
                                <AlertCircle className="h-4 w-4" />
                                <AlertDescription>
                                    Failed to load WhatsApp Bot status. Please try again.
                                </AlertDescription>
                            </Alert>
                        )}

                        {status && (
                            <div className="space-y-6">
                                {/* Status Display */}
                                <div className="flex items-center gap-4">
                                    <div className={`p-4 rounded-full ${statusDisplay.bgColor}`}>
                                        <StatusIcon className={`h-8 w-8 ${statusDisplay.color} ${status.status === 'initializing' ? 'animate-spin' : ''}`} />
                                    </div>
                                    <div className="flex-1">
                                        <div className="flex items-center gap-3 mb-2">
                                            <p className="text-2xl font-bold text-slate-900">
                                                {statusDisplay.label}
                                            </p>
                                            <Badge
                                                variant="outline"
                                                className={`${statusDisplay.bgColor} ${statusDisplay.color} ${statusDisplay.borderColor} font-medium`}
                                            >
                                                {status.connected ? 'Online' : 'Offline'}
                                            </Badge>
                                        </div>
                                        {status.message && (
                                            <p className="text-sm text-slate-600">{status.message}</p>
                                        )}
                                    </div>
                                </div>

                                {/* Connection Details */}
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-6">
                                    {/* Phone Number */}
                                    <div className="p-4 bg-slate-50 rounded-lg border border-slate-200">
                                        <div className="flex items-center gap-2 mb-2">
                                            <Phone className="h-4 w-4 text-slate-500" />
                                            <label className="text-sm font-medium text-slate-500">Connected Phone Number</label>
                                        </div>
                                        {status.phoneNumber ? (
                                            <p className="text-lg font-mono text-slate-900">
                                                +{status.phoneNumber}
                                            </p>
                                        ) : (
                                            <p className="text-sm text-slate-400 italic">
                                                Not available
                                            </p>
                                        )}
                                    </div>

                                    {/* Status */}
                                    <div className="p-4 bg-slate-50 rounded-lg border border-slate-200">
                                        <div className="flex items-center gap-2 mb-2">
                                            <MessageSquare className="h-4 w-4 text-slate-500" />
                                            <label className="text-sm font-medium text-slate-500">Bot Status</label>
                                        </div>
                                        <p className="text-lg font-semibold text-slate-900 capitalize">
                                            {status.status.replace('_', ' ')}
                                        </p>
                                    </div>
                                </div>

                                {/* QR Code Display */}
                                {status.qrCode && status.status === 'qr_received' && (
                                    <div className="mt-6">
                                        <Alert className="border-yellow-200 bg-yellow-50 mb-4">
                                            <QrCode className="h-4 w-4 text-yellow-600" />
                                            <AlertDescription className="text-yellow-800">
                                                <strong>Scan QR Code:</strong> Open WhatsApp on your phone, go to Settings → Linked Devices → Link a Device, and scan the QR code below.
                                            </AlertDescription>
                                        </Alert>
                                        <div className="flex justify-center p-6 bg-white rounded-lg border-2 border-yellow-200">
                                            <img
                                                src={status.qrCode}
                                                alt="WhatsApp QR Code"
                                                className="w-64 h-64"
                                            />
                                        </div>
                                    </div>
                                )}

                                {/* Status-specific alerts */}
                                {status.status === 'disconnected' && (
                                    <Alert className="border-red-200 bg-red-50 mt-4">
                                        <AlertCircle className="h-4 w-4 text-red-600" />
                                        <AlertDescription className="text-red-800">
                                            <strong>Bot Disconnected:</strong> The WhatsApp Bot is currently disconnected. Users will not receive WhatsApp notifications until the bot is reconnected.
                                        </AlertDescription>
                                    </Alert>
                                )}

                                {status.status === 'ready' && status.connected && (
                                    <Alert className="border-green-200 bg-green-50 mt-4">
                                        <CheckCircle className="h-4 w-4 text-green-600" />
                                        <AlertDescription className="text-green-800">
                                            <strong>Bot Active:</strong> The WhatsApp Bot is connected and ready to send notifications to users.
                                        </AlertDescription>
                                    </Alert>
                                )}

                                {status.status === 'initializing' && (
                                    <Alert className="border-blue-200 bg-blue-50 mt-4">
                                        <Loader2 className="h-4 w-4 text-blue-600 animate-spin" />
                                        <AlertDescription className="text-blue-800">
                                            <strong>Initializing:</strong> The WhatsApp Bot is starting up. This may take a few moments.
                                        </AlertDescription>
                                    </Alert>
                                )}

                                {/* Connection Actions */}
                                <div className="mt-6 pt-6 border-t border-slate-200">
                                    <div className="flex items-center justify-between">
                                        <div>
                                            <h3 className="text-lg font-semibold text-slate-900 mb-1">
                                                Bot Connection
                                            </h3>
                                            <p className="text-sm text-slate-600">
                                                {status.connected
                                                    ? "Bot is currently connected and operational"
                                                    : "Connect the bot to enable WhatsApp notifications"}
                                            </p>
                                        </div>
                                        <div className="flex gap-2">
                                            <Button
                                                onClick={() => connectMutation.mutate()}
                                                disabled={
                                                    connectMutation.isPending ||
                                                    status.status === 'initializing' ||
                                                    (status.connected && status.status === 'ready')
                                                }
                                                className={
                                                    status.connected && status.status === 'ready'
                                                        ? "bg-green-600 hover:bg-green-700"
                                                        : "bg-blue-600 hover:bg-blue-700"
                                                }
                                            >
                                                {connectMutation.isPending ? (
                                                    <>
                                                        <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                                                        Connecting...
                                                    </>
                                                ) : status.connected && status.status === 'ready' ? (
                                                    <>
                                                        <CheckCircle className="h-4 w-4 mr-2" />
                                                        Connected
                                                    </>
                                                ) : status.status === 'initializing' ? (
                                                    <>
                                                        <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                                                        Initializing...
                                                    </>
                                                ) : (
                                                    <>
                                                        <Power className="h-4 w-4 mr-2" />
                                                        Connect Bot
                                                    </>
                                                )}
                                            </Button>

                                            {/* Disconnect Button - Only show when connected */}
                                            {status.connected && (status.status === 'ready' || status.status === 'authenticated') && (
                                                <Button
                                                    onClick={() => setShowDisconnectDialog(true)}
                                                    disabled={disconnectMutation.isPending}
                                                    variant="destructive"
                                                >
                                                    {disconnectMutation.isPending ? (
                                                        <>
                                                            <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                                                            Disconnecting...
                                                        </>
                                                    ) : (
                                                        <>
                                                            <PowerOff className="h-4 w-4 mr-2" />
                                                            Disconnect Bot
                                                        </>
                                                    )}
                                                </Button>
                                            )}
                                        </div>
                                    </div>

                                    {/* Connection Instructions */}
                                    {!status.connected && status.status !== 'qr_received' && (
                                        <Alert className="border-blue-200 bg-blue-50 mt-4">
                                            <AlertCircle className="h-4 w-4 text-blue-600" />
                                            <AlertDescription className="text-blue-800">
                                                <strong>How to connect:</strong>
                                                <ol className="list-decimal list-inside mt-2 space-y-1 ml-2">
                                                    <li>Click the "Connect Bot" button above</li>
                                                    <li>Wait for the QR code to appear</li>
                                                    <li>Open WhatsApp on your phone</li>
                                                    <li>Go to Settings → Linked Devices → Link a Device</li>
                                                    <li>Scan the QR code displayed below</li>
                                                </ol>
                                            </AlertDescription>
                                        </Alert>
                                    )}
                                </div>
                            </div>
                        )}
                    </CardContent>
                </Card>

                {/* Bot Statistics Card */}
                <Card className="border-slate-200 shadow-md">
                    <CardHeader className="bg-gradient-to-r from-slate-50 to-white border-b border-slate-100">
                        <CardTitle className="text-lg font-semibold text-slate-700 flex items-center gap-2">
                            <MessageSquare className="h-5 w-5 text-blue-600" />
                            Bot Statistics
                        </CardTitle>
                    </CardHeader>
                    <CardContent className="pt-6">
                        {isLoadingStats && (
                            <div className="flex items-center justify-center py-8">
                                <Loader2 className="h-8 w-8 animate-spin text-slate-600" />
                            </div>
                        )}

                        {statsError && (
                            <Alert variant="destructive">
                                <AlertCircle className="h-4 w-4" />
                                <AlertDescription>
                                    Failed to load bot statistics. Please try again.
                                </AlertDescription>
                            </Alert>
                        )}

                        {statisticsData?.data && (
                            <div className="space-y-6">
                                {/* Statistics Grid */}
                                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                                    {/* Total Messages Sent */}
                                    <div className="p-4 bg-gradient-to-br from-blue-50 to-blue-100 rounded-lg border border-blue-200">
                                        <div className="flex items-center gap-2 mb-2">
                                            <MessageSquare className="h-5 w-5 text-blue-600" />
                                            <label className="text-sm font-medium text-blue-700">Total Messages Sent</label>
                                        </div>
                                        <p className="text-3xl font-bold text-blue-900">
                                            {statisticsData.data.totalMessagesSent.toLocaleString()}
                                        </p>
                                    </div>

                                    {/* Active Connections */}
                                    <div className="p-4 bg-gradient-to-br from-green-50 to-green-100 rounded-lg border border-green-200">
                                        <div className="flex items-center gap-2 mb-2">
                                            <Phone className="h-5 w-5 text-green-600" />
                                            <label className="text-sm font-medium text-green-700">Active Connections</label>
                                        </div>
                                        <p className="text-3xl font-bold text-green-900">
                                            {statisticsData.data.activeConnections.toLocaleString()}
                                        </p>
                                    </div>

                                    {/* Success Rate */}
                                    <div className="p-4 bg-gradient-to-br from-purple-50 to-purple-100 rounded-lg border border-purple-200">
                                        <div className="flex items-center gap-2 mb-2">
                                            <CheckCircle className="h-5 w-5 text-purple-600" />
                                            <label className="text-sm font-medium text-purple-700">Success Rate</label>
                                        </div>
                                        <p className="text-3xl font-bold text-purple-900">
                                            {statisticsData.data.successRate}%
                                        </p>
                                    </div>
                                </div>

                                {/* Error Logs */}
                                {statisticsData.data.errorLogs.length > 0 && (
                                    <div className="mt-6">
                                        <h4 className="text-md font-semibold text-slate-900 mb-3 flex items-center gap-2">
                                            <AlertCircle className="h-4 w-4 text-red-600" />
                                            Recent Error Logs
                                        </h4>
                                        <div className="space-y-2">
                                            {statisticsData.data.errorLogs.map((log) => (
                                                <div
                                                    key={log.id}
                                                    className="p-3 bg-red-50 rounded-lg border border-red-200"
                                                >
                                                    <div className="flex items-start justify-between">
                                                        <div className="flex-1">
                                                            <div className="flex items-center gap-2 mb-1">
                                                                <Badge variant="outline" className="bg-red-100 text-red-700 border-red-300">
                                                                    {log.type}
                                                                </Badge>
                                                                <span className="text-xs text-slate-500">
                                                                    {new Date(log.sentAt * 1000).toLocaleString()}
                                                                </span>
                                                            </div>
                                                            <p className="text-sm text-slate-700 mb-1">
                                                                {log.message}
                                                            </p>
                                                            {log.errorMessage && (
                                                                <p className="text-xs text-red-600 font-mono">
                                                                    Error: {log.errorMessage}
                                                                </p>
                                                            )}
                                                        </div>
                                                    </div>
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                )}

                                {/* No Errors Message */}
                                {statisticsData.data.errorLogs.length === 0 && (
                                    <Alert className="border-green-200 bg-green-50">
                                        <CheckCircle className="h-4 w-4 text-green-600" />
                                        <AlertDescription className="text-green-800">
                                            <strong>No Recent Errors:</strong> All messages are being delivered successfully.
                                        </AlertDescription>
                                    </Alert>
                                )}
                            </div>
                        )}
                    </CardContent>
                </Card>

                {/* Test Message Card */}
                <Card className="border-slate-200 shadow-md">
                    <CardHeader className="bg-gradient-to-r from-slate-50 to-white border-b border-slate-100">
                        <CardTitle className="text-lg font-semibold text-slate-700 flex items-center gap-2">
                            <Send className="h-5 w-5 text-purple-600" />
                            Test Message
                        </CardTitle>
                    </CardHeader>
                    <CardContent className="pt-6">
                        {/* Bot Connection Check */}
                        {status && !status.connected && (
                            <Alert className="border-yellow-200 bg-yellow-50 mb-4">
                                <AlertCircle className="h-4 w-4 text-yellow-600" />
                                <AlertDescription className="text-yellow-800">
                                    <strong>Bot Not Connected:</strong> Please connect the WhatsApp Bot before sending test messages.
                                </AlertDescription>
                            </Alert>
                        )}

                        <div className="space-y-4">
                            <div>
                                <Label htmlFor="testPhoneNumber" className="text-sm font-medium text-slate-700">
                                    Phone Number
                                </Label>
                                <Input
                                    id="testPhoneNumber"
                                    type="text"
                                    placeholder="e.g., 628123456789 or 08123456789"
                                    value={testPhoneNumber}
                                    onChange={(e) => setTestPhoneNumber(e.target.value)}
                                    disabled={!status?.connected || testMessageMutation.isPending}
                                    className="mt-1"
                                />
                                <p className="text-xs text-slate-500 mt-1">
                                    Enter phone number with country code (e.g., 628123456789) or local format (08123456789)
                                </p>
                            </div>

                            <div>
                                <Label htmlFor="testMessage" className="text-sm font-medium text-slate-700">
                                    Message
                                </Label>
                                <Textarea
                                    id="testMessage"
                                    placeholder="Enter your test message here..."
                                    value={testMessage}
                                    onChange={(e) => setTestMessage(e.target.value)}
                                    disabled={!status?.connected || testMessageMutation.isPending}
                                    rows={4}
                                    className="mt-1"
                                />
                                <p className="text-xs text-slate-500 mt-1">
                                    {testMessage.length} characters
                                </p>
                            </div>

                            <Button
                                onClick={handleSendTestMessage}
                                disabled={!status?.connected || testMessageMutation.isPending || !testPhoneNumber.trim() || !testMessage.trim()}
                                className="w-full bg-purple-600 hover:bg-purple-700"
                            >
                                {testMessageMutation.isPending ? (
                                    <>
                                        <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                                        Sending...
                                    </>
                                ) : (
                                    <>
                                        <Send className="h-4 w-4 mr-2" />
                                        Send Test Message
                                    </>
                                )}
                            </Button>

                            <Alert className="border-blue-200 bg-blue-50">
                                <AlertCircle className="h-4 w-4 text-blue-600" />
                                <AlertDescription className="text-blue-800 text-sm">
                                    <strong>Note:</strong> The test message will be sent via the connected WhatsApp Bot. Make sure the recipient's phone number is registered on WhatsApp.
                                </AlertDescription>
                            </Alert>
                        </div>
                    </CardContent>
                </Card>

                {/* Information Card */}
                <Card className="border-slate-200 shadow-md">
                    <CardHeader className="bg-gradient-to-r from-slate-50 to-white border-b border-slate-100">
                        <CardTitle className="text-lg font-semibold text-slate-700 flex items-center gap-2">
                            <AlertCircle className="h-5 w-5 text-blue-600" />
                            About WhatsApp Bot
                        </CardTitle>
                    </CardHeader>
                    <CardContent className="pt-6">
                        <div className="space-y-4 text-slate-600">
                            <p>
                                The WhatsApp Bot is a single bot instance that serves all users in the system. It sends notifications for:
                            </p>
                            <ul className="list-disc list-inside space-y-2 ml-4">
                                <li>Transaction reminders</li>
                                <li>Budget alerts</li>
                                <li>Goal achievement notifications</li>
                                <li>Payment confirmations</li>
                                <li>System announcements</li>
                            </ul>
                            <Alert className="border-blue-200 bg-blue-50 mt-4">
                                <AlertCircle className="h-4 w-4 text-blue-600" />
                                <AlertDescription className="text-blue-800">
                                    <strong>Note:</strong> This is different from user WhatsApp integrations. Users can still connect their own WhatsApp accounts to receive personal notifications, but this bot handles system-wide messaging.
                                </AlertDescription>
                            </Alert>
                        </div>
                    </CardContent>
                </Card>

                {/* Disconnect Confirmation Dialog */}
                <AlertDialog open={showDisconnectDialog} onOpenChange={setShowDisconnectDialog}>
                    <AlertDialogContent>
                        <AlertDialogHeader>
                            <AlertDialogTitle className="flex items-center gap-2">
                                <AlertCircle className="h-5 w-5 text-red-600" />
                                Disconnect WhatsApp Bot?
                            </AlertDialogTitle>
                            <AlertDialogDescription className="space-y-3">
                                <p>
                                    Are you sure you want to disconnect the WhatsApp Bot? This will:
                                </p>
                                <ul className="list-disc list-inside space-y-1 ml-2 text-sm">
                                    <li>Stop all WhatsApp notifications to users</li>
                                    <li>Terminate the current bot session</li>
                                    <li>Require QR code scanning to reconnect</li>
                                </ul>
                                <p className="text-red-600 font-medium">
                                    Users will not receive WhatsApp notifications until the bot is reconnected.
                                </p>
                            </AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter>
                            <AlertDialogCancel>Cancel</AlertDialogCancel>
                            <AlertDialogAction
                                onClick={() => disconnectMutation.mutate()}
                                className="bg-red-600 hover:bg-red-700"
                            >
                                Yes, Disconnect Bot
                            </AlertDialogAction>
                        </AlertDialogFooter>
                    </AlertDialogContent>
                </AlertDialog>
            </div>
        </AdminLayout>
    );
}
