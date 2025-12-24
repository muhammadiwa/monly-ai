import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import AdminLayout from "../layout/AdminLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from "@/components/ui/table";
import {
    Activity,
    AlertCircle,
    CheckCircle,
    XCircle,
    Loader2,
    RefreshCw,
    Webhook,
    Calendar,
    ChevronLeft,
    ChevronRight,
} from "lucide-react";

interface MidtransStatus {
    connectionStatus: 'connected' | 'disconnected' | 'not_configured';
    connectionMessage: string;
    apiReachable: boolean;
    credentials: {
        serverKey: string;
        clientKey: string;
        isConfigured: boolean;
        hasServerKey: boolean;
        hasClientKey: boolean;
    };
    environment: {
        isProduction: boolean;
        apiUrl: string;
    };
    webhookUrl: string;
}

interface WebhookLog {
    id: number;
    orderId: string;
    transactionId: string | null;
    eventType: string;
    payload: any;
    signature: string | null;
    status: string;
    errorMessage: string | null;
    createdAt: number;
}

interface MidtransStatusResponse {
    success: boolean;
    data: MidtransStatus;
}

interface WebhookLogsResponse {
    success: boolean;
    data: {
        logs: WebhookLog[];
        total: number;
        page: number;
        totalPages: number;
        limit: number;
    };
}

export default function MidtransMonitoring() {
    const [page, setPage] = useState(1);
    const limit = 10;

    // Fetch Midtrans status
    const { data: statusData, isLoading: statusLoading, error: statusError, refetch: refetchStatus } = useQuery<MidtransStatusResponse>({
        queryKey: ["/api/admin/midtrans/status"],
        queryFn: async () => {
            const adminToken = localStorage.getItem('admin-token');
            if (!adminToken) {
                throw new Error('No admin token');
            }

            const res = await fetch('/api/admin/midtrans/status', {
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

    // Fetch webhook logs
    const { data: logsData, isLoading: logsLoading, error: logsError } = useQuery<WebhookLogsResponse>({
        queryKey: ["/api/admin/midtrans/webhooks", page],
        queryFn: async () => {
            const adminToken = localStorage.getItem('admin-token');
            if (!adminToken) {
                throw new Error('No admin token');
            }

            const params = new URLSearchParams({
                page: page.toString(),
                limit: limit.toString(),
            });

            const res = await fetch(`/api/admin/midtrans/webhooks?${params.toString()}`, {
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

    const status = statusData?.data;
    const logs = logsData?.data?.logs || [];
    const total = logsData?.data?.total || 0;
    const totalPages = logsData?.data?.totalPages || 1;

    // Format date
    const formatDateTime = (timestamp: number) => {
        return new Date(timestamp * 1000).toLocaleString('en-US', {
            year: 'numeric',
            month: 'short',
            day: 'numeric',
            hour: '2-digit',
            minute: '2-digit',
        });
    };

    // Get status badge color
    const getStatusBadgeColor = (status: string) => {
        switch (status) {
            case 'processed':
                return 'bg-green-100 text-green-700 border-green-200';
            case 'failed':
                return 'bg-red-100 text-red-700 border-red-200';
            default:
                return 'bg-gray-100 text-gray-700 border-gray-200';
        }
    };

    return (
        <AdminLayout>
            <div className="space-y-6">
                {/* Page Header */}
                <div className="flex items-center justify-between bg-gradient-to-r from-slate-50 to-white p-6 rounded-xl border border-slate-200 shadow-sm">
                    <div>
                        <h1 className="text-4xl font-bold bg-gradient-to-r from-slate-900 to-slate-700 bg-clip-text text-transparent">
                            Midtrans Monitoring
                        </h1>
                        <p className="text-slate-600 mt-2 font-medium">
                            Monitor Midtrans payment gateway status and webhook logs
                        </p>
                    </div>
                    <Button
                        variant="outline"
                        onClick={() => refetchStatus()}
                        className="border-blue-600 text-blue-600 hover:bg-blue-50"
                    >
                        <RefreshCw className="h-4 w-4 mr-2" />
                        Refresh Status
                    </Button>
                </div>

                {/* Connection Status */}
                <Card className="border-slate-200 shadow-md">
                    <CardHeader className="bg-gradient-to-r from-slate-50 to-white border-b border-slate-100">
                        <CardTitle className="text-lg font-semibold text-slate-700 flex items-center gap-2">
                            <Activity className="h-5 w-5 text-blue-600" />
                            Connection Status
                        </CardTitle>
                    </CardHeader>
                    <CardContent className="pt-6">
                        {statusLoading && (
                            <div className="flex items-center justify-center py-8">
                                <Loader2 className="h-8 w-8 animate-spin text-slate-600" />
                            </div>
                        )}

                        {statusError && (
                            <Alert variant="destructive">
                                <AlertCircle className="h-4 w-4" />
                                <AlertDescription>
                                    Failed to load Midtrans status. Please try again.
                                </AlertDescription>
                            </Alert>
                        )}

                        {status && (
                            <div className="space-y-4">
                                <div className="flex items-center gap-4">
                                    {status.connectionStatus === 'connected' ? (
                                        <CheckCircle className="h-8 w-8 text-green-600" />
                                    ) : (
                                        <XCircle className="h-8 w-8 text-red-600" />
                                    )}
                                    <div className="flex-1">
                                        <p className="text-lg font-semibold text-slate-900 capitalize">
                                            {status.connectionStatus.replace('_', ' ')}
                                        </p>
                                        <p className="text-sm text-slate-600">{status.connectionMessage}</p>
                                    </div>
                                    {!status.credentials.isConfigured && (
                                        <Alert className="flex-1 border-orange-200 bg-orange-50">
                                            <AlertCircle className="h-4 w-4 text-orange-600" />
                                            <AlertDescription className="text-orange-800">
                                                <strong>Configuration Required:</strong> Please configure Midtrans credentials in your <code className="bg-orange-100 px-1 rounded">.env</code> file or System Settings.
                                                <br />
                                                <span className="text-xs mt-1 block">
                                                    Set <code className="bg-orange-100 px-1 rounded">MIDTRANS_SERVER_KEY</code>, <code className="bg-orange-100 px-1 rounded">MIDTRANS_CLIENT_KEY</code>, and <code className="bg-orange-100 px-1 rounded">MIDTRANS_IS_PRODUCTION</code>
                                                </span>
                                            </AlertDescription>
                                        </Alert>
                                    )}
                                </div>

                                <div className="grid grid-cols-2 gap-4 mt-6">
                                    <div>
                                        <label className="text-sm font-medium text-slate-500">Environment</label>
                                        <div className="mt-1">
                                            <Badge
                                                variant="outline"
                                                className={status.environment.isProduction ? 'bg-green-100 text-green-700 border-green-200' : 'bg-yellow-100 text-yellow-700 border-yellow-200'}
                                            >
                                                {status.environment.isProduction ? 'Production' : 'Sandbox'}
                                            </Badge>
                                        </div>
                                    </div>
                                    <div>
                                        <label className="text-sm font-medium text-slate-500">API URL</label>
                                        <p className="text-base text-slate-900 text-sm">{status.environment.apiUrl}</p>
                                    </div>
                                    <div>
                                        <label className="text-sm font-medium text-slate-500">Server Key</label>
                                        <p className="text-base text-slate-900 font-mono text-sm">
                                            {status.credentials.serverKey}
                                        </p>
                                    </div>
                                    <div>
                                        <label className="text-sm font-medium text-slate-500">Client Key</label>
                                        <p className="text-base text-slate-900 font-mono text-sm">
                                            {status.credentials.clientKey}
                                        </p>
                                    </div>
                                    <div className="col-span-2">
                                        <label className="text-sm font-medium text-slate-500">Webhook URL</label>
                                        <p className="text-base text-slate-900 font-mono text-sm">
                                            {status.webhookUrl}
                                        </p>
                                    </div>
                                </div>

                                {status.credentials.isConfigured && (
                                    <Alert className="border-blue-200 bg-blue-50 mt-4">
                                        <AlertCircle className="h-4 w-4 text-blue-600" />
                                        <AlertDescription className="text-blue-800">
                                            <strong>Note:</strong> To change environment (Sandbox ↔ Production) or update credentials, modify your <code className="bg-blue-100 px-1 rounded">.env</code> file and restart the server.
                                            <br />
                                            <span className="text-xs mt-1 block">
                                                Future updates will allow configuration through System Settings page.
                                            </span>
                                        </AlertDescription>
                                    </Alert>
                                )}
                            </div>
                        )}
                    </CardContent>
                </Card>

                {/* Webhook Logs */}
                <Card className="border-slate-200 shadow-md">
                    <CardHeader className="bg-gradient-to-r from-slate-50 to-white border-b border-slate-100">
                        <CardTitle className="text-lg font-semibold text-slate-700 flex items-center gap-2">
                            <Webhook className="h-5 w-5 text-blue-600" />
                            Webhook Logs ({total})
                        </CardTitle>
                    </CardHeader>
                    <CardContent className="p-0">
                        {logsLoading && (
                            <div className="flex items-center justify-center py-12">
                                <Loader2 className="h-8 w-8 animate-spin text-slate-600" />
                            </div>
                        )}

                        {logsError && (
                            <div className="p-6">
                                <Alert variant="destructive">
                                    <AlertCircle className="h-4 w-4" />
                                    <AlertDescription>
                                        Failed to load webhook logs. Please try again.
                                    </AlertDescription>
                                </Alert>
                            </div>
                        )}

                        {!logsLoading && !logsError && logs.length === 0 && (
                            <div className="text-center py-12">
                                <Webhook className="h-12 w-12 text-slate-300 mx-auto mb-4" />
                                <p className="text-slate-500 font-medium">No webhook logs found</p>
                                <p className="text-slate-400 text-sm mt-1">
                                    Webhook logs will appear here when Midtrans sends notifications
                                </p>
                            </div>
                        )}

                        {!logsLoading && !logsError && logs.length > 0 && (
                            <div className="overflow-x-auto">
                                <Table>
                                    <TableHeader>
                                        <TableRow className="bg-slate-50 hover:bg-slate-50">
                                            <TableHead className="font-semibold text-slate-700">Order ID</TableHead>
                                            <TableHead className="font-semibold text-slate-700">Transaction ID</TableHead>
                                            <TableHead className="font-semibold text-slate-700">Event Type</TableHead>
                                            <TableHead className="font-semibold text-slate-700">Status</TableHead>
                                            <TableHead className="font-semibold text-slate-700">Timestamp</TableHead>
                                            <TableHead className="font-semibold text-slate-700">Details</TableHead>
                                        </TableRow>
                                    </TableHeader>
                                    <TableBody>
                                        {logs.map((log) => (
                                            <TableRow key={log.id} className="hover:bg-slate-50 transition-colors">
                                                <TableCell className="font-mono text-sm text-slate-900">
                                                    {log.orderId}
                                                </TableCell>
                                                <TableCell className="font-mono text-sm text-slate-900">
                                                    {log.transactionId || 'N/A'}
                                                </TableCell>
                                                <TableCell className="text-slate-900">
                                                    {log.eventType}
                                                </TableCell>
                                                <TableCell>
                                                    <Badge
                                                        variant="outline"
                                                        className={`${getStatusBadgeColor(log.status)} font-medium capitalize`}
                                                    >
                                                        {log.status}
                                                    </Badge>
                                                </TableCell>
                                                <TableCell className="text-slate-600 text-sm">
                                                    <div className="flex items-center gap-1">
                                                        <Calendar className="h-3 w-3 text-slate-400" />
                                                        {formatDateTime(log.createdAt)}
                                                    </div>
                                                </TableCell>
                                                <TableCell>
                                                    {log.errorMessage ? (
                                                        <div className="text-xs text-red-600 max-w-xs truncate" title={log.errorMessage}>
                                                            {log.errorMessage}
                                                        </div>
                                                    ) : (
                                                        <span className="text-slate-400 text-sm">-</span>
                                                    )}
                                                </TableCell>
                                            </TableRow>
                                        ))}
                                    </TableBody>
                                </Table>
                            </div>
                        )}
                    </CardContent>
                </Card>

                {/* Pagination */}
                {totalPages > 1 && (
                    <Card className="border-slate-200 shadow-md">
                        <CardContent className="py-4">
                            <div className="flex items-center justify-between">
                                <div className="text-sm text-slate-600">
                                    Showing page {page} of {totalPages} ({total} total logs)
                                </div>
                                <div className="flex items-center gap-2">
                                    <Button
                                        variant="outline"
                                        size="sm"
                                        onClick={() => setPage(page - 1)}
                                        disabled={page === 1}
                                        className="border-slate-300 hover:bg-slate-50"
                                    >
                                        <ChevronLeft className="h-4 w-4 mr-1" />
                                        Previous
                                    </Button>
                                    <div className="flex items-center gap-1">
                                        {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                                            let pageNum;
                                            if (totalPages <= 5) {
                                                pageNum = i + 1;
                                            } else if (page <= 3) {
                                                pageNum = i + 1;
                                            } else if (page >= totalPages - 2) {
                                                pageNum = totalPages - 4 + i;
                                            } else {
                                                pageNum = page - 2 + i;
                                            }

                                            return (
                                                <Button
                                                    key={pageNum}
                                                    variant={page === pageNum ? "default" : "outline"}
                                                    size="sm"
                                                    onClick={() => setPage(pageNum)}
                                                    className={
                                                        page === pageNum
                                                            ? "bg-blue-600 hover:bg-blue-700 text-white"
                                                            : "border-slate-300 hover:bg-slate-50"
                                                    }
                                                >
                                                    {pageNum}
                                                </Button>
                                            );
                                        })}
                                    </div>
                                    <Button
                                        variant="outline"
                                        size="sm"
                                        onClick={() => setPage(page + 1)}
                                        disabled={page === totalPages}
                                        className="border-slate-300 hover:bg-slate-50"
                                    >
                                        Next
                                        <ChevronRight className="h-4 w-4 ml-1" />
                                    </Button>
                                </div>
                            </div>
                        </CardContent>
                    </Card>
                )}
            </div>
        </AdminLayout>
    );
}
