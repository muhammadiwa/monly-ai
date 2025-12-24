import AdminLayout from "../layout/AdminLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Users, DollarSign, CreditCard, TrendingUp } from "lucide-react";

export default function AdminDashboard() {
    // Mock data - will be replaced with real API data
    const metrics = [
        {
            title: "Total Users",
            value: "1,234",
            change: "+12.5%",
            icon: Users,
            color: "text-blue-600",
            bgColor: "bg-blue-50",
        },
        {
            title: "Monthly Revenue",
            value: "$45,678",
            change: "+8.2%",
            icon: DollarSign,
            color: "text-green-600",
            bgColor: "bg-green-50",
        },
        {
            title: "Active Subscriptions",
            value: "892",
            change: "+5.4%",
            icon: CreditCard,
            color: "text-purple-600",
            bgColor: "bg-purple-50",
        },
        {
            title: "Growth Rate",
            value: "23.5%",
            change: "+2.1%",
            icon: TrendingUp,
            color: "text-orange-600",
            bgColor: "bg-orange-50",
        },
    ];

    return (
        <AdminLayout>
            <div className="space-y-6">
                {/* Page Header */}
                <div>
                    <h1 className="text-3xl font-bold text-slate-900">Dashboard</h1>
                    <p className="text-slate-500 mt-1">Welcome back! Here's what's happening today.</p>
                </div>

                {/* Metrics Grid */}
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                    {metrics.map((metric) => {
                        const Icon = metric.icon;
                        return (
                            <Card key={metric.title} className="hover:shadow-lg transition-shadow duration-200">
                                <CardHeader className="flex flex-row items-center justify-between pb-2">
                                    <CardTitle className="text-sm font-medium text-slate-600">
                                        {metric.title}
                                    </CardTitle>
                                    <div className={`p-2 rounded-lg ${metric.bgColor}`}>
                                        <Icon className={`h-5 w-5 ${metric.color}`} />
                                    </div>
                                </CardHeader>
                                <CardContent>
                                    <div className="text-2xl font-bold text-slate-900">{metric.value}</div>
                                    <p className="text-xs text-green-600 mt-1">
                                        {metric.change} from last month
                                    </p>
                                </CardContent>
                            </Card>
                        );
                    })}
                </div>

                {/* Recent Activity */}
                <Card>
                    <CardHeader>
                        <CardTitle>Recent Activity</CardTitle>
                    </CardHeader>
                    <CardContent>
                        <div className="space-y-4">
                            <div className="flex items-center justify-between py-3 border-b">
                                <div>
                                    <p className="font-medium text-slate-900">New user registration</p>
                                    <p className="text-sm text-slate-500">John Doe joined the platform</p>
                                </div>
                                <span className="text-xs text-slate-400">5 min ago</span>
                            </div>
                            <div className="flex items-center justify-between py-3 border-b">
                                <div>
                                    <p className="font-medium text-slate-900">Payment received</p>
                                    <p className="text-sm text-slate-500">Premium subscription - $29.99</p>
                                </div>
                                <span className="text-xs text-slate-400">1 hour ago</span>
                            </div>
                            <div className="flex items-center justify-between py-3">
                                <div>
                                    <p className="font-medium text-slate-900">Subscription cancelled</p>
                                    <p className="text-sm text-slate-500">User requested cancellation</p>
                                </div>
                                <span className="text-xs text-slate-400">2 hours ago</span>
                            </div>
                        </div>
                    </CardContent>
                </Card>
            </div>
        </AdminLayout>
    );
}
