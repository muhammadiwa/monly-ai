import { Router, Response, RequestHandler } from 'express';
import { requireAuth, AuthRequest } from '../auth';
import { db } from '../db';
import { invoices, payments, userSubscriptions, subscriptionPlans, users } from '../../shared/schema';
import { eq, desc } from 'drizzle-orm';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';

const router = Router();

// Type assertion for requireAuth middleware
const authMiddleware = requireAuth as unknown as RequestHandler;

/**
 * GET /api/invoice/list
 * Get user's own invoices
 * Requirements: 4.2, 4.3, 8.1, 8.2
 */
router.get('/list', authMiddleware, async (req: AuthRequest, res: Response) => {
    try {
        const userId = req.user!.id;

        // Fetch invoices for the current user
        const userInvoices = await db
            .select({
                id: invoices.id,
                invoiceNumber: invoices.invoiceNumber,
                amount: invoices.amount,
                currency: invoices.currency,
                status: invoices.status,
                issuedAt: invoices.issuedAt,
                dueAt: invoices.dueAt,
                paidAt: invoices.paidAt,
                createdAt: invoices.createdAt,
                paymentId: invoices.paymentId,
            })
            .from(invoices)
            .where(eq(invoices.userId, userId))
            .orderBy(desc(invoices.createdAt));

        res.json({
            success: true,
            data: userInvoices,
        });
    } catch (error) {
        console.error('Error fetching invoice list:', error);
        res.status(500).json({
            success: false,
            error: {
                code: 'FETCH_INVOICES_ERROR',
                message: 'Failed to fetch invoices',
            },
        });
    }
});

/**
 * GET /api/invoice/:id
 * Get invoice details (verify ownership)
 * Requirements: 4.2, 4.3, 8.1, 8.2
 */
router.get('/:id', authMiddleware, async (req: AuthRequest, res: Response) => {
    try {
        const userId = req.user!.id;
        const invoiceId = parseInt(req.params.id);

        if (isNaN(invoiceId)) {
            return res.status(400).json({
                success: false,
                error: {
                    code: 'INVALID_INVOICE_ID',
                    message: 'Invalid invoice ID',
                },
            });
        }

        // Fetch invoice with ownership verification
        const invoice = await db
            .select({
                id: invoices.id,
                invoiceNumber: invoices.invoiceNumber,
                userId: invoices.userId,
                paymentId: invoices.paymentId,
                amount: invoices.amount,
                currency: invoices.currency,
                items: invoices.items,
                status: invoices.status,
                issuedAt: invoices.issuedAt,
                dueAt: invoices.dueAt,
                paidAt: invoices.paidAt,
                createdAt: invoices.createdAt,
                updatedAt: invoices.updatedAt,
            })
            .from(invoices)
            .where(eq(invoices.id, invoiceId))
            .get();

        if (!invoice) {
            return res.status(404).json({
                success: false,
                error: {
                    code: 'INVOICE_NOT_FOUND',
                    message: 'Invoice not found',
                },
            });
        }

        // Verify ownership
        if (invoice.userId !== userId) {
            return res.status(403).json({
                success: false,
                error: {
                    code: 'FORBIDDEN',
                    message: 'You do not have permission to access this invoice',
                },
            });
        }

        // Get payment details
        let payment = null;
        if (invoice.paymentId) {
            payment = await db
                .select({
                    id: payments.id,
                    paymentMethod: payments.paymentMethod,
                    status: payments.status,
                    midtransTransactionId: payments.midtransTransactionId,
                    midtransOrderId: payments.midtransOrderId,
                    paidAt: payments.paidAt,
                })
                .from(payments)
                .where(eq(payments.id, invoice.paymentId))
                .get();
        }

        // Get user details
        const user = await db
            .select({
                id: users.id,
                email: users.email,
                firstName: users.firstName,
                lastName: users.lastName,
            })
            .from(users)
            .where(eq(users.id, userId))
            .get();

        res.json({
            success: true,
            data: {
                id: invoice.id,
                invoiceNumber: invoice.invoiceNumber,
                amount: invoice.amount,
                currency: invoice.currency,
                items: JSON.parse(invoice.items),
                status: invoice.status,
                issuedAt: invoice.issuedAt,
                dueAt: invoice.dueAt,
                paidAt: invoice.paidAt,
                createdAt: invoice.createdAt,
                updatedAt: invoice.updatedAt,
                payment: payment ? {
                    id: payment.id,
                    paymentMethod: payment.paymentMethod,
                    status: payment.status,
                    midtransTransactionId: payment.midtransTransactionId,
                    midtransOrderId: payment.midtransOrderId,
                    paidAt: payment.paidAt,
                } : null,
                user: user ? {
                    id: user.id,
                    email: user.email,
                    firstName: user.firstName,
                    lastName: user.lastName,
                } : null,
            },
        });
    } catch (error) {
        console.error('Error fetching invoice details:', error);
        res.status(500).json({
            success: false,
            error: {
                code: 'FETCH_INVOICE_ERROR',
                message: 'Failed to fetch invoice details',
            },
        });
    }
});

/**
 * GET /api/invoice/:id/download
 * Download invoice PDF (verify ownership)
 * Requirements: 4.2, 4.3, 8.1, 8.2
 */
router.get('/:id/download', authMiddleware, async (req: AuthRequest, res: Response) => {
    try {
        const userId = req.user!.id;
        const invoiceId = parseInt(req.params.id);

        if (isNaN(invoiceId)) {
            return res.status(400).json({
                success: false,
                error: {
                    code: 'INVALID_INVOICE_ID',
                    message: 'Invalid invoice ID',
                },
            });
        }

        // Fetch invoice with ownership verification
        const invoice = await db
            .select({
                id: invoices.id,
                invoiceNumber: invoices.invoiceNumber,
                userId: invoices.userId,
                paymentId: invoices.paymentId,
                amount: invoices.amount,
                currency: invoices.currency,
                items: invoices.items,
                status: invoices.status,
                issuedAt: invoices.issuedAt,
                dueAt: invoices.dueAt,
                paidAt: invoices.paidAt,
            })
            .from(invoices)
            .where(eq(invoices.id, invoiceId))
            .get();

        if (!invoice) {
            return res.status(404).json({
                success: false,
                error: {
                    code: 'INVOICE_NOT_FOUND',
                    message: 'Invoice not found',
                },
            });
        }

        // Verify ownership
        if (invoice.userId !== userId) {
            return res.status(403).json({
                success: false,
                error: {
                    code: 'FORBIDDEN',
                    message: 'You do not have permission to access this invoice',
                },
            });
        }

        // Get user details
        const user = await db
            .select({
                email: users.email,
                firstName: users.firstName,
                lastName: users.lastName,
            })
            .from(users)
            .where(eq(users.id, userId))
            .get();

        if (!user) {
            return res.status(404).json({
                success: false,
                error: {
                    code: 'USER_NOT_FOUND',
                    message: 'User not found',
                },
            });
        }

        // Get payment details
        let payment = null;
        if (invoice.paymentId) {
            payment = await db
                .select({
                    paymentMethod: payments.paymentMethod,
                    status: payments.status,
                    midtransTransactionId: payments.midtransTransactionId,
                })
                .from(payments)
                .where(eq(payments.id, invoice.paymentId))
                .get();
        }

        // Generate PDF invoice (reuse admin logic)
        const doc = new jsPDF();

        // Add company header
        doc.setFontSize(20);
        doc.setFont('helvetica', 'bold');
        doc.text('INVOICE', 105, 20, { align: 'center' });

        // Add invoice details
        doc.setFontSize(10);
        doc.setFont('helvetica', 'normal');
        doc.text(`Invoice Number: ${invoice.invoiceNumber}`, 20, 40);
        doc.text(`Issue Date: ${new Date(invoice.issuedAt * 1000).toLocaleDateString()}`, 20, 46);
        doc.text(`Due Date: ${new Date(invoice.dueAt * 1000).toLocaleDateString()}`, 20, 52);
        doc.text(`Status: ${invoice.status.toUpperCase()}`, 20, 58);

        // Add customer details
        doc.setFont('helvetica', 'bold');
        doc.text('Bill To:', 20, 70);
        doc.setFont('helvetica', 'normal');
        doc.text(`${user.firstName || ''} ${user.lastName || ''}`.trim() || 'User', 20, 76);
        doc.text(user.email || '', 20, 82);

        // Add payment details if available
        if (payment) {
            doc.setFont('helvetica', 'bold');
            doc.text('Payment Details:', 120, 70);
            doc.setFont('helvetica', 'normal');
            doc.text(`Method: ${payment.paymentMethod}`, 120, 76);
            doc.text(`Status: ${payment.status}`, 120, 82);
            if (payment.midtransTransactionId) {
                doc.text(`Transaction ID: ${payment.midtransTransactionId}`, 120, 88);
            }
        }

        // Add items table
        const items = JSON.parse(invoice.items);
        const tableData = items.map((item: any) => [
            item.description,
            item.quantity.toString(),
            `${invoice.currency} ${item.unitPrice.toLocaleString()}`,
            `${invoice.currency} ${item.total.toLocaleString()}`,
        ]);

        autoTable(doc, {
            startY: 100,
            head: [['Description', 'Quantity', 'Unit Price', 'Total']],
            body: tableData,
            theme: 'striped',
            headStyles: { fillColor: [66, 139, 202] },
            styles: { fontSize: 10 },
        });

        // Add total
        const finalY = (doc as any).lastAutoTable.finalY || 100;
        doc.setFont('helvetica', 'bold');
        doc.text(`Total Amount: ${invoice.currency} ${invoice.amount.toLocaleString()}`, 20, finalY + 15);

        // Add payment status
        if (invoice.paidAt) {
            doc.setFont('helvetica', 'normal');
            doc.text(`Paid on: ${new Date(invoice.paidAt * 1000).toLocaleDateString()}`, 20, finalY + 25);
        }

        // Add footer
        doc.setFontSize(8);
        doc.setFont('helvetica', 'italic');
        doc.text('Thank you for your business!', 105, 280, { align: 'center' });

        // Convert PDF to buffer
        const pdfBuffer = Buffer.from(doc.output('arraybuffer'));

        // Set response headers for PDF download
        res.setHeader('Content-Type', 'application/pdf');
        res.setHeader('Content-Disposition', `attachment; filename="invoice-${invoice.invoiceNumber}.pdf"`);
        res.setHeader('Content-Length', pdfBuffer.length);

        res.send(pdfBuffer);
    } catch (error) {
        console.error('Error generating invoice PDF:', error);
        res.status(500).json({
            success: false,
            error: {
                code: 'PDF_GENERATION_ERROR',
                message: 'Failed to generate invoice PDF',
            },
        });
    }
});

export default router;
