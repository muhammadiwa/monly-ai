import { useQuery } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from "@/components/ui/table";
import {
    Loader2,
    FileText,
    Download,
    CheckCircle2,
    Clock,
    XCircle,
    Receipt,
} from "lucide-react";

interface Invoice {
    id: number;
    invoiceNumber: string;
    amount: number;
    currency: string;
    status: string;
    issuedAt: number;
    dueAt: number;
    paidAt: number | null;
    createdAt: number;
    paymentId: number | null;
}

/**
 * Invoice List Component
 * Requirements: 8.1, 8.2, 8.3
 */
export default function InvoiceList() {
    const { toast } = useToast();

    // Fetch invoices from GET /api/invoice/list
    const { data: invoicesResponse, isLoading } = useQuery({
        queryKey: ['/api/invoice/list'],
        queryFn: async () => {
            const response = await apiRequest('GET', '/api/invoice/list');
            if (!response.ok) throw new Error('Failed to fetch invoices');
            return response.json();
        },
    });

    const invoices: Invoice[] = invoicesResponse?.data || [];

    const formatDate = (timestamp: number) => {
        return new Date(timestamp * 1000).toLocaleDateString('en-US', {
            year: 'numeric',
            month: 'short',
            day: 'numeric',
        });
    };

    const formatAmount = (amount: number, currency: string) => {
        if (currency === 'IDR') {
            return `Rp ${amount.toLocaleString('id-ID')}`;
        }
        return `${currency} ${amount.toLocaleString()}`;
    };

    const getStatusBadge = (status: string) => {
        switch (status.toLowerCase()) {
            case 'paid':
                return (
                    <Badge className="bg-green-100 text-green-700 border-green-200">
                        <CheckCircle2 className="w-3 h-3 mr-1" />
                        Paid
                    </Badge>
                );
            case 'pending':
                return (
                    <Badge className="bg-yellow-100 text-yellow-700 border-yellow-200">
                        <Clock className="w-3 h-3 mr-1" />
                        Pending
                    </Badge>
                );
            case 'overdue':
                return (
                    <Badge className="bg-red-100 text-red-700 border-red-200">
                        <XCircle className="w-3 h-3 mr-1" />
                        Overdue
                    </Badge>
                );
            case 'cancelled':
                return (
                    <Badge className="bg-gray-100 text-gray-700 border-gray-200">
                        <XCircle className="w-3 h-3 mr-1" />
                        Cancelled
                    </Badge>
                );
            default:
                return (
                    <Badge variant="outline">
                        {status}
                    </Badge>
                );
        }
    };

    // Handle PDF download from GET /api/invoice/:id/download
    const handleDownload = async (invoiceId: number, invoiceNumber: string) => {
        try {
            const response = await apiRequest('GET', `/api/invoice/${invoiceId}/download`);

            if (!response.ok) {
                const error = await response.json();
                throw new Error(error.error?.message || 'Failed to download invoice');
            }

            // Get the PDF blob
            const blob = await response.blob();

            // Create a download link
            const url = window.URL.createObjectURL(blob);
            const link = document.createElement('a');
            link.href = url;
            link.download = `invoice-${invoiceNumber}.pdf`;
            document.body.appendChild(link);
            link.click();

            // Cleanup
            document.body.removeChild(link);
            window.URL.revokeObjectURL(url);

            toast({
                title: "Download Started",
                description: `Invoice ${invoiceNumber} is being downloaded.`,
            });
        } catch (error: any) {
            console.error('Error downloading invoice:', error);
            toast({
                title: "Download Failed",
                description: error.message || "Failed to download invoice. Please try again.",
                variant: "destructive",
            });
        }
    };

    if (isLoading) {
        return (
            <Card>
                <CardHeader>
                    <div className="flex items-center gap-3">
                        <div className="p-3 rounded-full bg-gradient-to-r from-indigo-500 to-blue-600 text-white">
                            <Receipt className="w-6 h-6" />
                        </div>
                        <div>
                            <CardTitle>Invoices</CardTitle>
                            <CardDescription>Your billing history</CardDescription>
                        </div>
                    </div>
                </CardHeader>
                <CardContent>
                    <div className="flex items-center justify-center p-12">
                        <div className="text-center">
                            <Loader2 className="h-12 w-12 animate-spin text-primary mx-auto mb-4" />
                            <p className="text-gray-600">Loading invoices...</p>
                        </div>
                    </div>
                </CardContent>
            </Card>
        );
    }

    return (
        <Card>
            <CardHeader>
                <div className="flex items-center gap-3">
                    <div className="p-3 rounded-full bg-gradient-to-r from-indigo-500 to-blue-600 text-white">
                        <Receipt className="w-6 h-6" />
                    </div>
                    <div>
                        <CardTitle>Invoices</CardTitle>
                        <CardDescription>Your billing history and invoices</CardDescription>
                    </div>
                </div>
            </CardHeader>
            <CardContent>
                {invoices.length === 0 ? (
                    <div className="text-center py-12">
                        <div className="mx-auto w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mb-4">
                            <FileText className="w-8 h-8 text-gray-400" />
                        </div>
                        <h3 className="text-lg font-semibold text-gray-900 mb-2">No Invoices Yet</h3>
                        <p className="text-gray-600 mb-4">
                            You don't have any invoices yet. Invoices will appear here after you make a payment.
                        </p>
                    </div>
                ) : (
                    <div className="rounded-lg border border-gray-200 overflow-hidden">
                        <Table>
                            <TableHeader>
                                <TableRow className="bg-gray-50">
                                    <TableHead className="font-semibold">Invoice Number</TableHead>
                                    <TableHead className="font-semibold">Date</TableHead>
                                    <TableHead className="font-semibold">Amount</TableHead>
                                    <TableHead className="font-semibold">Status</TableHead>
                                    <TableHead className="font-semibold text-right">Actions</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {invoices.map((invoice) => (
                                    <TableRow key={invoice.id} className="hover:bg-gray-50">
                                        <TableCell className="font-medium">
                                            <div className="flex items-center gap-2">
                                                <FileText className="w-4 h-4 text-gray-500" />
                                                {invoice.invoiceNumber}
                                            </div>
                                        </TableCell>
                                        <TableCell className="text-gray-600">
                                            {formatDate(invoice.issuedAt)}
                                        </TableCell>
                                        <TableCell className="font-semibold text-gray-900">
                                            {formatAmount(invoice.amount, invoice.currency)}
                                        </TableCell>
                                        <TableCell>
                                            {getStatusBadge(invoice.status)}
                                        </TableCell>
                                        <TableCell className="text-right">
                                            <Button
                                                size="sm"
                                                variant="outline"
                                                onClick={() => handleDownload(invoice.id, invoice.invoiceNumber)}
                                                className="hover:bg-blue-50 hover:text-blue-600 hover:border-blue-300"
                                            >
                                                <Download className="w-4 h-4 mr-2" />
                                                Download
                                            </Button>
                                        </TableCell>
                                    </TableRow>
                                ))}
                            </TableBody>
                        </Table>
                    </div>
                )}
            </CardContent>
        </Card>
    );
}
