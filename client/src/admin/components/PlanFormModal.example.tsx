/**
 * Example usage of PlanFormModal component
 * 
 * This file demonstrates how to use the PlanFormModal component
 * for creating and editing subscription plans.
 */

import { useState } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import PlanFormModal from './PlanFormModal';
import { Button } from '@/components/ui/button';

// Create a query client for the example
const queryClient = new QueryClient();

// Example subscription plan data
const examplePlan = {
    id: 1,
    name: 'premium',
    displayName: 'Premium Plan',
    description: 'Perfect for individuals who want advanced features',
    price: {
        monthly: 99000,
        yearly: 990000,
    },
    currency: 'IDR',
    features: [
        'Unlimited transactions',
        'Advanced AI insights',
        'Priority support',
        'Custom categories',
        'Export to Excel/PDF',
    ],
    limits: {
        transactionLimit: -1,
        accountLimit: 10,
        budgetLimit: 20,
        goalLimit: 10,
        aiInsights: true,
        advancedReports: true,
        prioritySupport: true,
        apiAccess: false,
    },
    isActive: true,
    createdAt: Date.now(),
    updatedAt: Date.now(),
};

export default function PlanFormModalExample() {
    const [createModalOpen, setCreateModalOpen] = useState(false);
    const [editModalOpen, setEditModalOpen] = useState(false);

    return (
        <QueryClientProvider client={queryClient}>
            <div className="p-8 space-y-4">
                <h1 className="text-2xl font-bold">PlanFormModal Examples</h1>

                <div className="space-y-4">
                    <div>
                        <h2 className="text-lg font-semibold mb-2">Create Mode</h2>
                        <p className="text-sm text-slate-600 mb-4">
                            Opens a modal to create a new subscription plan with empty form fields.
                        </p>
                        <Button onClick={() => setCreateModalOpen(true)}>
                            Open Create Plan Modal
                        </Button>
                    </div>

                    <div>
                        <h2 className="text-lg font-semibold mb-2">Edit Mode</h2>
                        <p className="text-sm text-slate-600 mb-4">
                            Opens a modal to edit an existing subscription plan with pre-filled data.
                        </p>
                        <Button onClick={() => setEditModalOpen(true)}>
                            Open Edit Plan Modal
                        </Button>
                    </div>
                </div>

                {/* Create Modal */}
                <PlanFormModal
                    open={createModalOpen}
                    onOpenChange={setCreateModalOpen}
                    plan={null}
                    mode="create"
                />

                {/* Edit Modal */}
                <PlanFormModal
                    open={editModalOpen}
                    onOpenChange={setEditModalOpen}
                    plan={examplePlan}
                    mode="edit"
                />
            </div>
        </QueryClientProvider>
    );
}

/**
 * Usage in SubscriptionPlans page:
 * 
 * ```tsx
 * import { PlanFormModal } from '../components';
 * 
 * function SubscriptionPlans() {
 *   const [modalOpen, setModalOpen] = useState(false);
 *   const [selectedPlan, setSelectedPlan] = useState(null);
 *   const [mode, setMode] = useState('create');
 * 
 *   const handleCreate = () => {
 *     setSelectedPlan(null);
 *     setMode('create');
 *     setModalOpen(true);
 *   };
 * 
 *   const handleEdit = (plan) => {
 *     setSelectedPlan(plan);
 *     setMode('edit');
 *     setModalOpen(true);
 *   };
 * 
 *   return (
 *     <>
 *       <Button onClick={handleCreate}>Create Plan</Button>
 *       
 *       <PlanFormModal
 *         open={modalOpen}
 *         onOpenChange={setModalOpen}
 *         plan={selectedPlan}
 *         mode={mode}
 *       />
 *     </>
 *   );
 * }
 * ```
 * 
 * Form Validation:
 * - Plan name: Required, lowercase, alphanumeric with hyphens/underscores
 * - Display name: Required, max 100 characters
 * - Description: Optional, max 500 characters
 * - Prices: Required, must be >= 0
 * - Currency: Required, 3 characters (e.g., IDR, USD)
 * - Features: At least 1 feature required
 * - Limits: Must be integers, -1 for unlimited
 * 
 * API Integration:
 * - Create: POST /api/admin/plans
 * - Update: PUT /api/admin/plans/:id
 * - Both require admin authentication token
 * 
 * Features:
 * - Dynamic feature list with add/remove buttons
 * - Numeric limits with -1 for unlimited
 * - Feature access toggles (AI, Reports, Support, API)
 * - Active/inactive status toggle
 * - Form validation with error messages
 * - Loading states during submission
 * - Success/error toast notifications
 * - Automatic query invalidation after success
 */
