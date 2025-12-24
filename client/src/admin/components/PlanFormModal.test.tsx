import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import PlanFormModal from './PlanFormModal';

// Create a test query client
const createTestQueryClient = () => new QueryClient({
    defaultOptions: {
        queries: { retry: false },
        mutations: { retry: false },
    },
});

describe('PlanFormModal', () => {
    it('renders create mode correctly', () => {
        const queryClient = createTestQueryClient();

        render(
            <QueryClientProvider client={queryClient}>
                <PlanFormModal
                    open={true}
                    onOpenChange={() => { }}
                    plan={null}
                    mode="create"
                />
            </QueryClientProvider>
        );

        // Check for dialog title
        expect(screen.getByText('Create Subscription Plan')).toBeInTheDocument();

        // Check for form fields
        expect(screen.getByLabelText(/Plan Name/i)).toBeInTheDocument();
        expect(screen.getByLabelText(/Display Name/i)).toBeInTheDocument();
        expect(screen.getByLabelText(/Monthly Price/i)).toBeInTheDocument();
        expect(screen.getByLabelText(/Yearly Price/i)).toBeInTheDocument();
    });

    it('renders edit mode correctly', () => {
        const queryClient = createTestQueryClient();
        const mockPlan = {
            id: 1,
            name: 'premium',
            displayName: 'Premium Plan',
            description: 'Premium features',
            price: {
                monthly: 99000,
                yearly: 990000,
            },
            currency: 'IDR',
            features: ['Feature 1', 'Feature 2'],
            limits: {
                transactionLimit: -1,
                accountLimit: -1,
                budgetLimit: -1,
                goalLimit: -1,
                aiInsights: true,
                advancedReports: true,
                prioritySupport: true,
                apiAccess: false,
            },
            isActive: true,
            createdAt: Date.now(),
            updatedAt: Date.now(),
        };

        render(
            <QueryClientProvider client={queryClient}>
                <PlanFormModal
                    open={true}
                    onOpenChange={() => { }}
                    plan={mockPlan}
                    mode="edit"
                />
            </QueryClientProvider>
        );

        // Check for dialog title
        expect(screen.getByText('Edit Subscription Plan')).toBeInTheDocument();

        // Check that plan name field is disabled in edit mode
        const planNameInput = screen.getByLabelText(/Plan Name/i) as HTMLInputElement;
        expect(planNameInput).toBeDisabled();
    });

    it('has all required form sections', () => {
        const queryClient = createTestQueryClient();

        render(
            <QueryClientProvider client={queryClient}>
                <PlanFormModal
                    open={true}
                    onOpenChange={() => { }}
                    plan={null}
                    mode="create"
                />
            </QueryClientProvider>
        );

        // Check for section headings
        expect(screen.getByText('Basic Information')).toBeInTheDocument();
        expect(screen.getByText('Pricing')).toBeInTheDocument();
        expect(screen.getByText('Features')).toBeInTheDocument();
        expect(screen.getByText('Limits')).toBeInTheDocument();
        expect(screen.getByText('Feature Access')).toBeInTheDocument();
    });

    it('has feature management buttons', () => {
        const queryClient = createTestQueryClient();

        render(
            <QueryClientProvider client={queryClient}>
                <PlanFormModal
                    open={true}
                    onOpenChange={() => { }}
                    plan={null}
                    mode="create"
                />
            </QueryClientProvider>
        );

        // Check for Add Feature button
        expect(screen.getByText('Add Feature')).toBeInTheDocument();
    });

    it('has all limit fields', () => {
        const queryClient = createTestQueryClient();

        render(
            <QueryClientProvider client={queryClient}>
                <PlanFormModal
                    open={true}
                    onOpenChange={() => { }}
                    plan={null}
                    mode="create"
                />
            </QueryClientProvider>
        );

        // Check for limit fields
        expect(screen.getByLabelText(/Transaction Limit/i)).toBeInTheDocument();
        expect(screen.getByLabelText(/Account Limit/i)).toBeInTheDocument();
        expect(screen.getByLabelText(/Budget Limit/i)).toBeInTheDocument();
        expect(screen.getByLabelText(/Goal Limit/i)).toBeInTheDocument();
    });

    it('has all feature access toggles', () => {
        const queryClient = createTestQueryClient();

        render(
            <QueryClientProvider client={queryClient}>
                <PlanFormModal
                    open={true}
                    onOpenChange={() => { }}
                    plan={null}
                    mode="create"
                />
            </QueryClientProvider>
        );

        // Check for feature access toggles
        expect(screen.getByText('AI Insights')).toBeInTheDocument();
        expect(screen.getByText('Advanced Reports')).toBeInTheDocument();
        expect(screen.getByText('Priority Support')).toBeInTheDocument();
        expect(screen.getByText('API Access')).toBeInTheDocument();
    });

    it('has submit and cancel buttons', () => {
        const queryClient = createTestQueryClient();

        render(
            <QueryClientProvider client={queryClient}>
                <PlanFormModal
                    open={true}
                    onOpenChange={() => { }}
                    plan={null}
                    mode="create"
                />
            </QueryClientProvider>
        );

        // Check for action buttons
        expect(screen.getByText('Cancel')).toBeInTheDocument();
        expect(screen.getByText('Create Plan')).toBeInTheDocument();
    });
});
