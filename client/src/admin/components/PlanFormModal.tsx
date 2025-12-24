import { useState, useEffect } from "react";
import { useForm, useFieldArray } from "react-hook-form";
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
import { Loader2, Plus, X, Package } from "lucide-react";

// Form validation schema
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
    priceMonthly: z.number()
        .min(0, "Monthly price must be 0 or greater")
        .max(1000000000, "Monthly price is too large"),
    priceYearly: z.number()
        .min(0, "Yearly price must be 0 or greater")
        .max(1000000000, "Yearly price is too large"),
    currency: z.string()
        .min(3, "Currency code is required")
        .max(3, "Currency code must be 3 characters")
        .default("IDR"),
    features: z.array(z.object({
        value: z.string().min(1, "Feature cannot be empty"),
    })).min(1, "At least one feature is required"),
    limits: z.object({
        transactionLimit: z.number()
            .int("Transaction limit must be an integer")
            .min(-1, "Transaction limit must be -1 (unlimited) or greater"),
        accountLimit: z.number()
            .int("Account limit must be an integer")
            .min(-1, "Account limit must be -1 (unlimited) or greater"),
        budgetLimit: z.number()
            .int("Budget limit must be an integer")
            .min(-1, "Budget limit must be -1 (unlimited) or greater"),
        goalLimit: z.number()
            .int("Goal limit must be an integer")
            .min(-1, "Goal limit must be -1 (unlimited) or greater"),
        aiInsights: z.boolean(),
        advancedReports: z.boolean(),
        prioritySupport: z.boolean(),
        apiAccess: z.boolean(),
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
    features: string[];
    limits: {
        transactionLimit: number;
        accountLimit: number;
        budgetLimit: number;
        goalLimit: number;
        aiInsights: boolean;
        advancedReports: boolean;
        prioritySupport: boolean;
        apiAccess: boolean;
    };
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

export default function PlanFormModal({
    open,
    onOpenChange,
    plan,
    mode,
}: PlanFormModalProps) {
    const { toast } = useToast();
    const queryClient = useQueryClient();
    const [isSubmitting, setIsSubmitting] = useState(false);

    // Initialize form with default values
    const form = useForm<PlanFormValues>({
        resolver: zodResolver(planFormSchema),
        defaultValues: {
            name: "",
            displayName: "",
            description: "",
            priceMonthly: 0,
            priceYearly: 0,
            currency: "IDR",
            features: [{ value: "" }],
            limits: {
                transactionLimit: -1,
                accountLimit: -1,
                budgetLimit: -1,
                goalLimit: -1,
                aiInsights: false,
                advancedReports: false,
                prioritySupport: false,
                apiAccess: false,
            },
            isActive: true,
        },
    });

    const { fields, append, remove } = useFieldArray({
        control: form.control,
        name: "features",
    });

    // Reset form when plan changes or modal opens/closes
    useEffect(() => {
        if (open && plan && mode === "edit") {
            form.reset({
                name: plan.name,
                displayName: plan.displayName,
                description: plan.description || "",
                priceMonthly: plan.price.monthly,
                priceYearly: plan.price.yearly,
                currency: plan.currency,
                features: plan.features.map(f => ({ value: f })),
                limits: plan.limits,
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
                features: [{ value: "" }],
                limits: {
                    transactionLimit: -1,
                    accountLimit: -1,
                    budgetLimit: -1,
                    goalLimit: -1,
                    aiInsights: false,
                    advancedReports: false,
                    prioritySupport: false,
                    apiAccess: false,
                },
                isActive: true,
            });
        }
    }, [open, plan, mode, form]);

    // Create plan mutation
    const createMutation = useMutation({
        mutationFn: async (data: PlanFormValues) => {
            const adminToken = localStorage.getItem('admin-token');
            if (!adminToken) {
                throw new Error('No admin token');
            }

            const payload = {
                name: data.name,
                displayName: data.displayName,
                description: data.description || null,
                priceMonthly: data.priceMonthly,
                priceYearly: data.priceYearly,
                currency: data.currency,
                features: JSON.stringify(data.features.map(f => f.value)),
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
            toast({
                title: "Plan Created",
                description: "The subscription plan has been created successfully.",
            });
            queryClient.invalidateQueries({ queryKey: ["/api/admin/plans"] });
            onOpenChange(false);
            form.reset();
        },
        onError: (error: Error) => {
            toast({
                title: "Creation Failed",
                description: error.message,
                variant: "destructive",
            });
        },
    });

    // Update plan mutation
    const updateMutation = useMutation({
        mutationFn: async (data: PlanFormValues) => {
            if (!plan) throw new Error('No plan to update');

            const adminToken = localStorage.getItem('admin-token');
            if (!adminToken) {
                throw new Error('No admin token');
            }

            const payload = {
                displayName: data.displayName,
                description: data.description || null,
                priceMonthly: data.priceMonthly,
                priceYearly: data.priceYearly,
                currency: data.currency,
                features: JSON.stringify(data.features.map(f => f.value)),
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
            toast({
                title: "Plan Updated",
                description: "The subscription plan has been updated successfully.",
            });
            queryClient.invalidateQueries({ queryKey: ["/api/admin/plans"] });
            onOpenChange(false);
        },
        onError: (error: Error) => {
            toast({
                title: "Update Failed",
                description: error.message,
                variant: "destructive",
            });
        },
    });

    // Handle form submission
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
                            : "Update the subscription plan details. Changes will apply to new subscriptions only."}
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
                                                <Input
                                                    placeholder="e.g., premium"
                                                    {...field}
                                                    disabled={mode === "edit"}
                                                />
                                            </FormControl>
                                            <FormDescription>
                                                Lowercase, no spaces (used in code)
                                            </FormDescription>
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
                                                <Input placeholder="e.g., Premium Plan" {...field} />
                                            </FormControl>
                                            <FormDescription>
                                                Name shown to users
                                            </FormDescription>
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
                                            <Textarea
                                                placeholder="Describe the plan benefits..."
                                                className="resize-none"
                                                rows={3}
                                                {...field}
                                            />
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
                                                <Input
                                                    type="number"
                                                    placeholder="0"
                                                    {...field}
                                                    onChange={(e) => field.onChange(parseFloat(e.target.value) || 0)}
                                                />
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
                                                <Input
                                                    type="number"
                                                    placeholder="0"
                                                    {...field}
                                                    onChange={(e) => field.onChange(parseFloat(e.target.value) || 0)}
                                                />
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

                        {/* Features */}
                        <div className="space-y-4">
                            <div className="flex items-center justify-between">
                                <h3 className="text-lg font-semibold text-slate-900">Features</h3>
                                <Button
                                    type="button"
                                    variant="outline"
                                    size="sm"
                                    onClick={() => append({ value: "" })}
                                >
                                    <Plus className="h-4 w-4 mr-2" />
                                    Add Feature
                                </Button>
                            </div>

                            <div className="space-y-2">
                                {fields.map((field, index) => (
                                    <FormField
                                        key={field.id}
                                        control={form.control}
                                        name={`features.${index}.value`}
                                        render={({ field }) => (
                                            <FormItem>
                                                <div className="flex gap-2">
                                                    <FormControl>
                                                        <Input placeholder="e.g., Unlimited transactions" {...field} />
                                                    </FormControl>
                                                    {fields.length > 1 && (
                                                        <Button
                                                            type="button"
                                                            variant="ghost"
                                                            size="icon"
                                                            onClick={() => remove(index)}
                                                        >
                                                            <X className="h-4 w-4" />
                                                        </Button>
                                                    )}
                                                </div>
                                                <FormMessage />
                                            </FormItem>
                                        )}
                                    />
                                ))}
                            </div>
                        </div>

                        {/* Limits */}
                        <div className="space-y-4">
                            <h3 className="text-lg font-semibold text-slate-900">Limits</h3>
                            <p className="text-sm text-slate-600">Use -1 for unlimited</p>

                            <div className="grid grid-cols-2 gap-4">
                                <FormField
                                    control={form.control}
                                    name="limits.transactionLimit"
                                    render={({ field }) => (
                                        <FormItem>
                                            <FormLabel>Transaction Limit</FormLabel>
                                            <FormControl>
                                                <Input
                                                    type="number"
                                                    placeholder="-1"
                                                    {...field}
                                                    onChange={(e) => field.onChange(parseInt(e.target.value) || -1)}
                                                />
                                            </FormControl>
                                            <FormMessage />
                                        </FormItem>
                                    )}
                                />

                                <FormField
                                    control={form.control}
                                    name="limits.accountLimit"
                                    render={({ field }) => (
                                        <FormItem>
                                            <FormLabel>Account Limit</FormLabel>
                                            <FormControl>
                                                <Input
                                                    type="number"
                                                    placeholder="-1"
                                                    {...field}
                                                    onChange={(e) => field.onChange(parseInt(e.target.value) || -1)}
                                                />
                                            </FormControl>
                                            <FormMessage />
                                        </FormItem>
                                    )}
                                />

                                <FormField
                                    control={form.control}
                                    name="limits.budgetLimit"
                                    render={({ field }) => (
                                        <FormItem>
                                            <FormLabel>Budget Limit</FormLabel>
                                            <FormControl>
                                                <Input
                                                    type="number"
                                                    placeholder="-1"
                                                    {...field}
                                                    onChange={(e) => field.onChange(parseInt(e.target.value) || -1)}
                                                />
                                            </FormControl>
                                            <FormMessage />
                                        </FormItem>
                                    )}
                                />

                                <FormField
                                    control={form.control}
                                    name="limits.goalLimit"
                                    render={({ field }) => (
                                        <FormItem>
                                            <FormLabel>Goal Limit</FormLabel>
                                            <FormControl>
                                                <Input
                                                    type="number"
                                                    placeholder="-1"
                                                    {...field}
                                                    onChange={(e) => field.onChange(parseInt(e.target.value) || -1)}
                                                />
                                            </FormControl>
                                            <FormMessage />
                                        </FormItem>
                                    )}
                                />
                            </div>
                        </div>

                        {/* Feature Flags */}
                        <div className="space-y-4">
                            <h3 className="text-lg font-semibold text-slate-900">Feature Access</h3>

                            <div className="grid grid-cols-2 gap-4">
                                <FormField
                                    control={form.control}
                                    name="limits.aiInsights"
                                    render={({ field }) => (
                                        <FormItem className="flex items-center justify-between rounded-lg border p-4">
                                            <div className="space-y-0.5">
                                                <FormLabel className="text-base">AI Insights</FormLabel>
                                                <FormDescription>
                                                    Enable AI-powered financial insights
                                                </FormDescription>
                                            </div>
                                            <FormControl>
                                                <Switch
                                                    checked={field.value}
                                                    onCheckedChange={field.onChange}
                                                />
                                            </FormControl>
                                        </FormItem>
                                    )}
                                />

                                <FormField
                                    control={form.control}
                                    name="limits.advancedReports"
                                    render={({ field }) => (
                                        <FormItem className="flex items-center justify-between rounded-lg border p-4">
                                            <div className="space-y-0.5">
                                                <FormLabel className="text-base">Advanced Reports</FormLabel>
                                                <FormDescription>
                                                    Access to detailed analytics
                                                </FormDescription>
                                            </div>
                                            <FormControl>
                                                <Switch
                                                    checked={field.value}
                                                    onCheckedChange={field.onChange}
                                                />
                                            </FormControl>
                                        </FormItem>
                                    )}
                                />

                                <FormField
                                    control={form.control}
                                    name="limits.prioritySupport"
                                    render={({ field }) => (
                                        <FormItem className="flex items-center justify-between rounded-lg border p-4">
                                            <div className="space-y-0.5">
                                                <FormLabel className="text-base">Priority Support</FormLabel>
                                                <FormDescription>
                                                    Faster response times
                                                </FormDescription>
                                            </div>
                                            <FormControl>
                                                <Switch
                                                    checked={field.value}
                                                    onCheckedChange={field.onChange}
                                                />
                                            </FormControl>
                                        </FormItem>
                                    )}
                                />

                                <FormField
                                    control={form.control}
                                    name="limits.apiAccess"
                                    render={({ field }) => (
                                        <FormItem className="flex items-center justify-between rounded-lg border p-4">
                                            <div className="space-y-0.5">
                                                <FormLabel className="text-base">API Access</FormLabel>
                                                <FormDescription>
                                                    Programmatic access to data
                                                </FormDescription>
                                            </div>
                                            <FormControl>
                                                <Switch
                                                    checked={field.value}
                                                    onCheckedChange={field.onChange}
                                                />
                                            </FormControl>
                                        </FormItem>
                                    )}
                                />
                            </div>
                        </div>

                        {/* Status */}
                        <FormField
                            control={form.control}
                            name="isActive"
                            render={({ field }) => (
                                <FormItem className="flex items-center justify-between rounded-lg border p-4">
                                    <div className="space-y-0.5">
                                        <FormLabel className="text-base">Active Status</FormLabel>
                                        <FormDescription>
                                            Inactive plans are hidden from new subscriptions
                                        </FormDescription>
                                    </div>
                                    <FormControl>
                                        <Switch
                                            checked={field.value}
                                            onCheckedChange={field.onChange}
                                        />
                                    </FormControl>
                                </FormItem>
                            )}
                        />

                        <DialogFooter>
                            <Button
                                type="button"
                                variant="outline"
                                onClick={() => onOpenChange(false)}
                                disabled={isSubmitting}
                            >
                                Cancel
                            </Button>
                            <Button
                                type="submit"
                                disabled={isSubmitting}
                                className="bg-blue-600 hover:bg-blue-700"
                            >
                                {isSubmitting ? (
                                    <>
                                        <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                                        {mode === "create" ? "Creating..." : "Updating..."}
                                    </>
                                ) : (
                                    <>
                                        {mode === "create" ? "Create Plan" : "Update Plan"}
                                    </>
                                )}
                            </Button>
                        </DialogFooter>
                    </form>
                </Form>
            </DialogContent>
        </Dialog>
    );
}

export type { PlanFormModalProps };
