import { useState, useEffect } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from "@/components/ui/dialog";
import {
    Form,
    FormControl,
    FormDescription,
    FormField,
    FormItem,
    FormLabel,
    FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { useToast } from "@/hooks/use-toast";
import { Loader2, Package } from "lucide-react";

// Form validation schema - matches seed-subscription-plans.ts structure
const planFormSchema = z.object({
    name: z.string()
        .min(1, "Plan name is required")
        .max(50, "Plan name must be less than 50 characters")
        .regex(/^[a-z0-9_-]+$/, "Plan name must be lowercase with only letters, numbers, hyphens, and underscores"),
    displayName: z.string()
        .min(1, "Display name is required")
        .max(100, "Display name must be less than 100 characters"),
    description: z.string()
        .max(500, "Description must be less than 500 characters")
        .optional(),
    priceMonthly: z.number().min(0, "Monthly price must be 0 or greater"),
    priceYearly: z.number().min(0, "Yearly price must be 0 or greater"),
    currency: z.string().min(3).max(3).default("IDR"),
    featuresList: z.string().min(1, "At least one feature description is required"),
    // Limits - matches feature-gate.ts structure
    limits: z.object({
        transactions: z.number().int().min(-1),
        budgets: z.number().int().min(-1),
        goals: z.number().int().min(-1),
        aiAnalysis: z.number().int().min(-1),
        receiptOCR: z.number().int().min(-1),
        aiChat: z.number().int().min(-1),
        whatsappNotifications: z.boolean(),
        exportData: z.boolean(),
        advancedReports: z.boolean(),
        prioritySupport: z.boolean(),
    }),
    isActive: z.boolean().default(true),
});

type PlanFormValues = z.infer<typeof planFormSchema>;

interface SubscriptionPlan {
    id: number;
    name: string;
    displayName: string;
    description: string | null;
    price: {
        monthly: number;
        yearly: number;
    };
    currency: string;
    features: string[] | string;
    limits: any;
    isActive: boolean;
    createdAt: number;
    updatedAt: number;
}

interface PlanFormModalProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    plan?: SubscriptionPlan | null;
    mode: "create" | "edit";
}

const defaultLimits = {
    transactions: 50,
    budgets: 1,
    goals: 1,
    aiAnalysis: 0,
    receiptOCR: 0,
    aiChat: 0,
    whatsappNotifications: false,
    exportData: false,
    advancedReports: false,
    prioritySupport: false,
};

export default function PlanFormModal({
    open,
    onOpenChange,
    plan,
    mode,
}: PlanFormModalProps) {
    const { toast } = useToast();
    const queryClient = useQueryClient();
    const [isSubmitting, setIsSubmitting] = useState(false);

    const form = useForm<PlanFormValues>({
        resolver: zodResolver(planFormSchema),
        defaultValues: {
            name: "",
            displayName: "",
            description: "",
            priceMonthly: 0,
            priceYearly: 0,
            currency: "IDR",
            featuresList: "",
            limits: defaultLimits,
            isActive: true,
        },
    });

    useEffect(() => {
        if (open && plan && mode === "edit") {
            let parsedLimits = defaultLimits;
            let parsedFeatures: string[] = [];

            try {
                parsedLimits = typeof plan.limits === 'string' ? JSON.parse(plan.limits) : plan.limits;
            } catch (e) {
                console.error('Failed to parse limits:', e);
            }

            try {
                parsedFeatures = typeof plan.features === 'string' ? JSON.parse(plan.features) : plan.features;
            } catch (e) {
                console.error('Failed to parse features:', e);
            }

            form.reset({
                name: plan.name,
                displayName: plan.displayName,
                description: plan.description || "",
                priceMonthly: plan.price.monthly,
                priceYearly: plan.price.yearly,
                currency: plan.currency,
                featuresList: Array.isArray(parsedFeatures) ? parsedFeatures.join('\n') : '',
                limits: {
                    transactions: parsedLimits.transactions ?? 50,
                    budgets: parsedLimits.budgets ?? 1,
                    goals: parsedLimits.goals ?? 1,
                    aiAnalysis: parsedLimits.aiAnalysis ?? 0,
                    receiptOCR: parsedLimits.receiptOCR ?? 0,
                    aiChat: parsedLimits.aiChat ?? 0,
                    whatsappNotifications: parsedLimits.whatsappNotifications ?? false,
                    exportData: parsedLimits.exportData ?? false,
                    advancedReports: parsedLimits.advancedReports ?? false,
                    prioritySupport: parsedLimits.prioritySupport ?? false,
                },
                isActive: plan.isActive,
            });
        } else if (open && mode === "create") {
            form.reset({
                name: "",
                displayName: "",
                description: "",
                priceMonthly: 0,
                priceYearly: 0,
                currency: "IDR",
                featuresList: "",
                limits: defaultLimits,
                isActive: true,
            });
        }
    }, [open, plan, mode, form]);

    const createMutation = useMutation({
        mutationFn: async (data: PlanFormValues) => {
            const adminToken = localStorage.getItem('admin-token');
            if (!adminToken) throw new Error('No admin token');

            const featuresArray = data.featuresList.split('\n').filter(f => f.trim());

            const payload = {
                name: data.name,
                displayName: data.displayName,
                description: data.description || null,
                priceMonthly: data.priceMonthly,
                priceYearly: data.priceYearly,
                currency: data.currency,
                features: JSON.stringify(featuresArray),
                limits: JSON.stringify(data.limits),
                isActive: data.isActive,
            };

            const res = await fetch('/api/admin/plans', {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${adminToken}`,
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify(payload),
            });

            if (!res.ok) {
                const error = await res.json();
                throw new Error(error.error?.message || 'Failed to create plan');
            }
            return res.json();
        },
        onSuccess: () => {
            toast({ title: "Plan Created", description: "The subscription plan has been created successfully." });
            queryClient.invalidateQueries({ queryKey: ["/api/admin/plans"] });
            onOpenChange(false);
            form.reset();
        },
        onError: (error: Error) => {
            toast({ title: "Creation Failed", description: error.message, variant: "destructive" });
        },
    });

    const updateMutation = useMutation({
        mutationFn: async (data: PlanFormValues) => {
            if (!plan) throw new Error('No plan to update');
            const adminToken = localStorage.getItem('admin-token');
            if (!adminToken) throw new Error('No admin token');

            const featuresArray = data.featuresList.split('\n').filter(f => f.trim());

            const payload = {
                displayName: data.displayName,
                description: data.description || null,
                priceMonthly: data.priceMonthly,
                priceYearly: data.priceYearly,
                currency: data.currency,
                features: JSON.stringify(featuresArray),
                limits: JSON.stringify(data.limits),
                isActive: data.isActive,
            };

            const res = await fetch(`/api/admin/plans/${plan.id}`, {
                method: 'PUT',
                headers: {
                    'Authorization': `Bearer ${adminToken}`,
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify(payload),
            });

            if (!res.ok) {
                const error = await res.json();
                throw new Error(error.error?.message || 'Failed to update plan');
            }
            return res.json();
        },
        onSuccess: () => {
            toast({ title: "Plan Updated", description: "The subscription plan has been updated successfully." });
            queryClient.invalidateQueries({ queryKey: ["/api/admin/plans"] });
            onOpenChange(false);
        },
        onError: (error: Error) => {
            toast({ title: "Update Failed", description: error.message, variant: "destructive" });
        },
    });

    const onSubmit = async (data: PlanFormValues) => {
        setIsSubmitting(true);
        try {
            if (mode === "create") {
                await createMutation.mutateAsync(data);
            } else {
                await updateMutation.mutateAsync(data);
            }
        } finally {
            setIsSubmitting(false);
        }
    };

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
                <DialogHeader>
                    <DialogTitle className="flex items-center gap-2 text-2xl">
                        <Package className="h-6 w-6 text-blue-600" />
                        {mode === "create" ? "Create Subscription Plan" : "Edit Subscription Plan"}
                    </DialogTitle>
                    <DialogDescription>
                        {mode === "create"
                            ? "Create a new subscription plan with pricing, features, and limits."
                            : "Update the subscription plan details."}
                    </DialogDescription>
                </DialogHeader>

                <Form {...form}>
                    <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
                        {/* Basic Information */}
                        <div className="space-y-4">
                            <h3 className="text-lg font-semibold text-slate-900">Basic Information</h3>
                            <div className="grid grid-cols-2 gap-4">
                                <FormField
                                    control={form.control}
                                    name="name"
                                    render={({ field }) => (
                                        <FormItem>
                                            <FormLabel>Plan Name (Internal)</FormLabel>
                                            <FormControl>
                                                <Input placeholder="e.g., starter" {...field} disabled={mode === "edit"} />
                                            </FormControl>
                                            <FormDescription>Lowercase, no spaces</FormDescription>
                                            <FormMessage />
                                        </FormItem>
                                    )}
                                />
                                <FormField
                                    control={form.control}
                                    name="displayName"
                                    render={({ field }) => (
                                        <FormItem>
                                            <FormLabel>Display Name</FormLabel>
                                            <FormControl>
                                                <Input placeholder="e.g., Starter Plan" {...field} />
                                            </FormControl>
                                            <FormMessage />
                                        </FormItem>
                                    )}
                                />
                            </div>
                            <FormField
                                control={form.control}
                                name="description"
                                render={({ field }) => (
                                    <FormItem>
                                        <FormLabel>Description</FormLabel>
                                        <FormControl>
                                            <Textarea placeholder="Plan description..." rows={2} {...field} />
                                        </FormControl>
                                        <FormMessage />
                                    </FormItem>
                                )}
                            />
                        </div>

                        {/* Pricing */}
                        <div className="space-y-4">
                            <h3 className="text-lg font-semibold text-slate-900">Pricing</h3>
                            <div className="grid grid-cols-3 gap-4">
                                <FormField
                                    control={form.control}
                                    name="priceMonthly"
                                    render={({ field }) => (
                                        <FormItem>
                                            <FormLabel>Monthly Price</FormLabel>
                                            <FormControl>
                                                <Input type="number" {...field} onChange={(e) => field.onChange(parseFloat(e.target.value) || 0)} />
                                            </FormControl>
                                            <FormMessage />
                                        </FormItem>
                                    )}
                                />
                                <FormField
                                    control={form.control}
                                    name="priceYearly"
                                    render={({ field }) => (
                                        <FormItem>
                                            <FormLabel>Yearly Price</FormLabel>
                                            <FormControl>
                                                <Input type="number" {...field} onChange={(e) => field.onChange(parseFloat(e.target.value) || 0)} />
                                            </FormControl>
                                            <FormMessage />
                                        </FormItem>
                                    )}
                                />
                                <FormField
                                    control={form.control}
                                    name="currency"
                                    render={({ field }) => (
                                        <FormItem>
                                            <FormLabel>Currency</FormLabel>
                                            <FormControl>
                                                <Input placeholder="IDR" {...field} maxLength={3} />
                                            </FormControl>
                                            <FormMessage />
                                        </FormItem>
                                    )}
                                />
                            </div>
                        </div>

                        {/* Features Description */}
                        <div className="space-y-4">
                            <h3 className="text-lg font-semibold text-slate-900">Features (Display)</h3>
                            <FormField
                                control={form.control}
                                name="featuresList"
                                render={({ field }) => (
                                    <FormItem>
                                        <FormLabel>Feature List</FormLabel>
                                        <FormControl>
                                            <Textarea
                                                placeholder="One feature per line, e.g.:&#10;50 transaksi per bulan&#10;1 kategori budget&#10;AI Chat (20 pesan/bulan)"
                                                rows={5}
                                                {...field}
                                            />
                                        </FormControl>
                                        <FormDescription>Enter one feature per line (shown to users)</FormDescription>
                                        <FormMessage />
                                    </FormItem>
                                )}
                            />
                        </div>

                        {/* Resource Limits */}
                        <div className="space-y-4">
                            <h3 className="text-lg font-semibold text-slate-900">Resource Limits</h3>
                            <p className="text-sm text-slate-600">Use -1 for unlimited, 0 to disable</p>
                            <div className="grid grid-cols-3 gap-4">
                                <FormField
                                    control={form.control}
                                    name="limits.transactions"
                                    render={({ field }) => (
                                        <FormItem>
                                            <FormLabel>Transactions/month</FormLabel>
                                            <FormControl>
                                                <Input type="number" {...field} onChange={(e) => field.onChange(parseInt(e.target.value) || 0)} />
                                            </FormControl>
                                            <FormMessage />
                                        </FormItem>
                                    )}
                                />
                                <FormField
                                    control={form.control}
                                    name="limits.budgets"
                                    render={({ field }) => (
                                        <FormItem>
                                            <FormLabel>Budgets</FormLabel>
                                            <FormControl>
                                                <Input type="number" {...field} onChange={(e) => field.onChange(parseInt(e.target.value) || 0)} />
                                            </FormControl>
                                            <FormMessage />
                                        </FormItem>
                                    )}
                                />
                                <FormField
                                    control={form.control}
                                    name="limits.goals"
                                    render={({ field }) => (
                                        <FormItem>
                                            <FormLabel>Goals</FormLabel>
                                            <FormControl>
                                                <Input type="number" {...field} onChange={(e) => field.onChange(parseInt(e.target.value) || 0)} />
                                            </FormControl>
                                            <FormMessage />
                                        </FormItem>
                                    )}
                                />
                            </div>
                        </div>

                        {/* AI Feature Limits */}
                        <div className="space-y-4">
                            <h3 className="text-lg font-semibold text-slate-900">AI Feature Limits (per month)</h3>
                            <div className="grid grid-cols-3 gap-4">
                                <FormField
                                    control={form.control}
                                    name="limits.aiChat"
                                    render={({ field }) => (
                                        <FormItem>
                                            <FormLabel>AI Chat Messages</FormLabel>
                                            <FormControl>
                                                <Input type="number" {...field} onChange={(e) => field.onChange(parseInt(e.target.value) || 0)} />
                                            </FormControl>
                                            <FormMessage />
                                        </FormItem>
                                    )}
                                />
                                <FormField
                                    control={form.control}
                                    name="limits.receiptOCR"
                                    render={({ field }) => (
                                        <FormItem>
                                            <FormLabel>Receipt OCR Scans</FormLabel>
                                            <FormControl>
                                                <Input type="number" {...field} onChange={(e) => field.onChange(parseInt(e.target.value) || 0)} />
                                            </FormControl>
                                            <FormMessage />
                                        </FormItem>
                                    )}
                                />
                                <FormField
                                    control={form.control}
                                    name="limits.aiAnalysis"
                                    render={({ field }) => (
                                        <FormItem>
                                            <FormLabel>AI Analysis</FormLabel>
                                            <FormControl>
                                                <Input type="number" {...field} onChange={(e) => field.onChange(parseInt(e.target.value) || 0)} />
                                            </FormControl>
                                            <FormMessage />
                                        </FormItem>
                                    )}
                                />
                            </div>
                        </div>

                        {/* Feature Access Toggles */}
                        <div className="space-y-4">
                            <h3 className="text-lg font-semibold text-slate-900">Feature Access</h3>
                            <div className="grid grid-cols-2 gap-4">
                                <FormField
                                    control={form.control}
                                    name="limits.whatsappNotifications"
                                    render={({ field }) => (
                                        <FormItem className="flex items-center justify-between rounded-lg border p-4">
                                            <div>
                                                <FormLabel className="text-base">WhatsApp Notifications</FormLabel>
                                                <FormDescription>Send alerts via WhatsApp</FormDescription>
                                            </div>
                                            <FormControl>
                                                <Switch checked={field.value} onCheckedChange={field.onChange} />
                                            </FormControl>
                                        </FormItem>
                                    )}
                                />
                                <FormField
                                    control={form.control}
                                    name="limits.exportData"
                                    render={({ field }) => (
                                        <FormItem className="flex items-center justify-between rounded-lg border p-4">
                                            <div>
                                                <FormLabel className="text-base">Export Data</FormLabel>
                                                <FormDescription>Export to CSV/PDF</FormDescription>
                                            </div>
                                            <FormControl>
                                                <Switch checked={field.value} onCheckedChange={field.onChange} />
                                            </FormControl>
                                        </FormItem>
                                    )}
                                />
                                <FormField
                                    control={form.control}
                                    name="limits.advancedReports"
                                    render={({ field }) => (
                                        <FormItem className="flex items-center justify-between rounded-lg border p-4">
                                            <div>
                                                <FormLabel className="text-base">Advanced Reports</FormLabel>
                                                <FormDescription>Detailed analytics</FormDescription>
                                            </div>
                                            <FormControl>
                                                <Switch checked={field.value} onCheckedChange={field.onChange} />
                                            </FormControl>
                                        </FormItem>
                                    )}
                                />
                                <FormField
                                    control={form.control}
                                    name="limits.prioritySupport"
                                    render={({ field }) => (
                                        <FormItem className="flex items-center justify-between rounded-lg border p-4">
                                            <div>
                                                <FormLabel className="text-base">Priority Support</FormLabel>
                                                <FormDescription>Faster response times</FormDescription>
                                            </div>
                                            <FormControl>
                                                <Switch checked={field.value} onCheckedChange={field.onChange} />
                                            </FormControl>
                                        </FormItem>
                                    )}
                                />
                            </div>
                        </div>

                        {/* Active Status */}
                        <FormField
                            control={form.control}
                            name="isActive"
                            render={({ field }) => (
                                <FormItem className="flex items-center justify-between rounded-lg border p-4">
                                    <div>
                                        <FormLabel className="text-base">Active</FormLabel>
                                        <FormDescription>Plan is available for purchase</FormDescription>
                                    </div>
                                    <FormControl>
                                        <Switch checked={field.value} onCheckedChange={field.onChange} />
                                    </FormControl>
                                </FormItem>
                            )}
                        />

                        <DialogFooter>
                            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
                                Cancel
                            </Button>
                            <Button type="submit" disabled={isSubmitting}>
                                {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                                {mode === "create" ? "Create Plan" : "Update Plan"}
                            </Button>
                        </DialogFooter>
                    </form>
                </Form>
            </DialogContent>
        </Dialog>
    );
}
