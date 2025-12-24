import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import MetricCard from './MetricCard';
import { Users, DollarSign, TrendingUp } from 'lucide-react';

describe('MetricCard', () => {
    it('renders with number type', () => {
        render(
            <MetricCard
                title="Total Users"
                value={1234}
                type="number"
                icon={Users}
            />
        );

        expect(screen.getByText('Total Users')).toBeInTheDocument();
        expect(screen.getByText('1,234')).toBeInTheDocument();
    });

    it('renders with currency type (IDR)', () => {
        render(
            <MetricCard
                title="Monthly Revenue"
                value={5000000}
                type="currency"
                currency="IDR"
                icon={DollarSign}
            />
        );

        expect(screen.getByText('Monthly Revenue')).toBeInTheDocument();
        expect(screen.getByText('Rp 5,000,000')).toBeInTheDocument();
    });

    it('renders with currency type (USD)', () => {
        render(
            <MetricCard
                title="Revenue"
                value={1500}
                type="currency"
                currency="USD"
                icon={DollarSign}
            />
        );

        expect(screen.getByText('Revenue')).toBeInTheDocument();
        expect(screen.getByText('$1,500')).toBeInTheDocument();
    });

    it('renders with percentage type', () => {
        render(
            <MetricCard
                title="Growth Rate"
                value={15.5}
                type="percentage"
                icon={TrendingUp}
            />
        );

        expect(screen.getByText('Growth Rate')).toBeInTheDocument();
        expect(screen.getByText('15.5%')).toBeInTheDocument();
    });

    it('renders with positive trend', () => {
        render(
            <MetricCard
                title="Users"
                value={100}
                type="number"
                trend={{ value: 12.5 }}
                icon={Users}
            />
        );

        expect(screen.getByText('+12.5%')).toBeInTheDocument();
        expect(screen.getByText('+12.5%')).toHaveClass('text-green-600');
    });

    it('renders with negative trend', () => {
        render(
            <MetricCard
                title="Users"
                value={100}
                type="number"
                trend={{ value: -5.2 }}
                icon={Users}
            />
        );

        expect(screen.getByText('-5.2%')).toBeInTheDocument();
        expect(screen.getByText('-5.2%')).toHaveClass('text-red-600');
    });

    it('renders with custom trend label', () => {
        render(
            <MetricCard
                title="Subscriptions"
                value={50}
                type="number"
                trend={{ value: 10, label: '10 new this month' }}
                icon={Users}
            />
        );

        expect(screen.getByText('10 new this month')).toBeInTheDocument();
    });

    it('renders with subtitle', () => {
        render(
            <MetricCard
                title="Total Users"
                value={1000}
                type="number"
                subtitle="500 active users"
                icon={Users}
            />
        );

        expect(screen.getByText('500 active users')).toBeInTheDocument();
    });

    it('renders with custom icon colors', () => {
        const { container } = render(
            <MetricCard
                title="Revenue"
                value={5000}
                type="currency"
                icon={DollarSign}
                iconColor="text-green-600"
                iconBgColor="bg-green-50"
            />
        );

        const iconContainer = container.querySelector('.bg-green-50');
        expect(iconContainer).toBeInTheDocument();

        const icon = container.querySelector('.text-green-600');
        expect(icon).toBeInTheDocument();
    });

    it('accepts string value directly', () => {
        render(
            <MetricCard
                title="Status"
                value="Active"
                icon={Users}
            />
        );

        expect(screen.getByText('Active')).toBeInTheDocument();
    });

    it('handles zero trend value', () => {
        render(
            <MetricCard
                title="Users"
                value={100}
                type="number"
                trend={{ value: 0 }}
                icon={Users}
            />
        );

        expect(screen.getByText('+0.0%')).toBeInTheDocument();
        expect(screen.getByText('+0.0%')).toHaveClass('text-green-600');
    });
});
