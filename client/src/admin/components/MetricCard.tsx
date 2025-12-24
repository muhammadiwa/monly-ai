import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { LucideIcon } from "lucide-react";

export type MetricType = 'number' | 'currency' | 'percentage';

export interface MetricCardProps {
    title: string;
    value: string | number;
    type?: MetricType;
    currency?: string;
    trend?: {
        value: number;
        label?: string;
    };
    subtitle?: string;
    icon: LucideIcon;
    iconColor?: string;
    iconBgColor?: string;
}

export default function MetricCard({
    title,
    value,
    type = 'number',
    currency = 'IDR',
    trend,
    subtitle,
    icon: Icon,
    iconColor = 'text-blue-600',
    iconBgColor = 'bg-blue-50',
}: MetricCardProps) {
    // Format value based on type
    const formatValue = () => {
        if (typeof value === 'string') {
            return value;
        }

        switch (type) {
            case 'currency':
                if (currency === 'IDR') {
                    return `Rp ${value.toLocaleString('id-ID')}`;
                }
                if (currency === 'USD') {
                    return `$${value.toLocaleString('en-US')}`;
                }
                if (currency === 'EUR') {
                    return `€${value.toLocaleString('en-US')}`;
                }
                return `${currency} ${value.toLocaleString('en-US')}`;

            case 'percentage':
                return `${value.toFixed(1)}%`;

            case 'number':
            default:
                return value.toLocaleString('en-US');
        }
    };

    // Format trend
    const formatTrend = () => {
        if (!trend) return null;

        const isPositive = trend.value >= 0;
        const sign = isPositive ? '+' : '';
        const trendColor = isPositive ? 'text-green-600' : 'text-red-600';
        const trendText = trend.label || `${sign}${trend.value.toFixed(1)}%`;

        return (
            <p className={`text-xs ${trendColor} mt-1 font-medium`}>
                {trendText}
            </p>
        );
    };

    return (
        <Card className="hover:shadow-lg transition-shadow duration-200">
            <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-sm font-medium text-slate-600">
                    {title}
                </CardTitle>
                <div className={`p-2 rounded-lg ${iconBgColor}`}>
                    <Icon className={`h-5 w-5 ${iconColor}`} />
                </div>
            </CardHeader>
            <CardContent>
                <div className="text-2xl font-bold text-slate-900">
                    {formatValue()}
                </div>
                {formatTrend()}
                {subtitle && (
                    <p className="text-xs text-slate-500 mt-1">
                        {subtitle}
                    </p>
                )}
            </CardContent>
        </Card>
    );
}
