import { useState } from "react";
import { Button } from "@/components/ui/button";
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import {
    Eye,
    UserX,
    UserCheck,
    Trash2,
    ArrowUpDown,
    ArrowUp,
    ArrowDown,
} from "lucide-react";

export interface UserListItem {
    id: string;
    name: string;
    email: string;
    subscriptionPlan: 'free' | 'premium' | 'business';
    status: 'active' | 'suspended' | 'deleted';
    registrationDate: number;
    lastLogin: number;
    transactionCount: number;
}

export interface UserTableProps {
    users: UserListItem[];
    onSuspend?: (userId: string) => void;
    onActivate?: (userId: string) => void;
    onDelete?: (userId: string) => void;
    onView?: (userId: string) => void;
}

type SortField = 'name' | 'email' | 'subscriptionPlan' | 'status' | 'transactionCount' | 'registrationDate' | 'lastLogin';
type SortDirection = 'asc' | 'desc' | null;

export default function UserTable({
    users,
    onSuspend,
    onActivate,
    onDelete,
    onView,
}: UserTableProps) {
    const [sortField, setSortField] = useState<SortField | null>(null);
    const [sortDirection, setSortDirection] = useState<SortDirection>(null);

    // Format date
    const formatDate = (timestamp: number) => {
        if (!timestamp) return 'Never';
        return new Date(timestamp * 1000).toLocaleDateString('en-US', {
            year: 'numeric',
            month: 'short',
            day: 'numeric',
        });
    };

    // Get plan badge color
    const getPlanBadgeColor = (plan: string) => {
        switch (plan) {
            case 'free':
                return 'bg-slate-100 text-slate-700 border-slate-200';
            case 'premium':
                return 'bg-purple-100 text-purple-700 border-purple-200';
            case 'business':
                return 'bg-blue-100 text-blue-700 border-blue-200';
            default:
                return 'bg-gray-100 text-gray-700 border-gray-200';
        }
    };

    // Get status badge color
    const getStatusBadgeColor = (status: string) => {
        switch (status) {
            case 'active':
                return 'bg-green-100 text-green-700 border-green-200';
            case 'suspended':
                return 'bg-orange-100 text-orange-700 border-orange-200';
            case 'deleted':
                return 'bg-red-100 text-red-700 border-red-200';
            default:
                return 'bg-gray-100 text-gray-700 border-gray-200';
        }
    };

    // Handle sorting
    const handleSort = (field: SortField) => {
        if (sortField === field) {
            // Cycle through: asc -> desc -> null
            if (sortDirection === 'asc') {
                setSortDirection('desc');
            } else if (sortDirection === 'desc') {
                setSortDirection(null);
                setSortField(null);
            }
        } else {
            setSortField(field);
            setSortDirection('asc');
        }
    };

    // Sort users
    const sortedUsers = [...users].sort((a, b) => {
        if (!sortField || !sortDirection) return 0;

        let aValue: any = a[sortField];
        let bValue: any = b[sortField];

        // Handle string comparison
        if (typeof aValue === 'string' && typeof bValue === 'string') {
            aValue = aValue.toLowerCase();
            bValue = bValue.toLowerCase();
        }

        if (aValue < bValue) return sortDirection === 'asc' ? -1 : 1;
        if (aValue > bValue) return sortDirection === 'asc' ? 1 : -1;
        return 0;
    });

    // Render sort icon
    const renderSortIcon = (field: SortField) => {
        if (sortField !== field) {
            return <ArrowUpDown className="h-3 w-3 ml-1 text-slate-400" />;
        }
        if (sortDirection === 'asc') {
            return <ArrowUp className="h-3 w-3 ml-1 text-blue-600" />;
        }
        if (sortDirection === 'desc') {
            return <ArrowDown className="h-3 w-3 ml-1 text-blue-600" />;
        }
        return <ArrowUpDown className="h-3 w-3 ml-1 text-slate-400" />;
    };

    // Handle action buttons
    const handleView = (userId: string) => {
        if (onView) {
            onView(userId);
        }
    };

    const handleSuspend = (userId: string) => {
        if (onSuspend) {
            onSuspend(userId);
        }
    };

    const handleActivate = (userId: string) => {
        if (onActivate) {
            onActivate(userId);
        }
    };

    const handleDelete = (userId: string) => {
        if (onDelete) {
            onDelete(userId);
        }
    };

    return (
        <div className="overflow-x-auto">
            <Table>
                <TableHeader>
                    <TableRow className="bg-slate-50 hover:bg-slate-50">
                        <TableHead className="font-semibold text-slate-700">
                            <button
                                onClick={() => handleSort('name')}
                                className="flex items-center hover:text-blue-600 transition-colors"
                            >
                                User
                                {renderSortIcon('name')}
                            </button>
                        </TableHead>
                        <TableHead className="font-semibold text-slate-700">
                            <button
                                onClick={() => handleSort('email')}
                                className="flex items-center hover:text-blue-600 transition-colors"
                            >
                                Email
                                {renderSortIcon('email')}
                            </button>
                        </TableHead>
                        <TableHead className="font-semibold text-slate-700">
                            <button
                                onClick={() => handleSort('subscriptionPlan')}
                                className="flex items-center hover:text-blue-600 transition-colors"
                            >
                                Plan
                                {renderSortIcon('subscriptionPlan')}
                            </button>
                        </TableHead>
                        <TableHead className="font-semibold text-slate-700">
                            <button
                                onClick={() => handleSort('status')}
                                className="flex items-center hover:text-blue-600 transition-colors"
                            >
                                Status
                                {renderSortIcon('status')}
                            </button>
                        </TableHead>
                        <TableHead className="font-semibold text-slate-700">
                            <button
                                onClick={() => handleSort('transactionCount')}
                                className="flex items-center hover:text-blue-600 transition-colors"
                            >
                                Transactions
                                {renderSortIcon('transactionCount')}
                            </button>
                        </TableHead>
                        <TableHead className="font-semibold text-slate-700">
                            <button
                                onClick={() => handleSort('registrationDate')}
                                className="flex items-center hover:text-blue-600 transition-colors"
                            >
                                Registered
                                {renderSortIcon('registrationDate')}
                            </button>
                        </TableHead>
                        <TableHead className="font-semibold text-slate-700">
                            <button
                                onClick={() => handleSort('lastLogin')}
                                className="flex items-center hover:text-blue-600 transition-colors"
                            >
                                Last Login
                                {renderSortIcon('lastLogin')}
                            </button>
                        </TableHead>
                        <TableHead className="font-semibold text-slate-700 text-right">
                            Actions
                        </TableHead>
                    </TableRow>
                </TableHeader>
                <TableBody>
                    {sortedUsers.map((user) => (
                        <TableRow
                            key={user.id}
                            className="hover:bg-slate-50 transition-colors"
                        >
                            <TableCell className="font-medium text-slate-900">
                                {user.name}
                            </TableCell>
                            <TableCell className="text-slate-600">
                                {user.email}
                            </TableCell>
                            <TableCell>
                                <Badge
                                    variant="outline"
                                    className={`${getPlanBadgeColor(user.subscriptionPlan)} font-medium capitalize`}
                                >
                                    {user.subscriptionPlan}
                                </Badge>
                            </TableCell>
                            <TableCell>
                                <Badge
                                    variant="outline"
                                    className={`${getStatusBadgeColor(user.status)} font-medium capitalize`}
                                >
                                    {user.status}
                                </Badge>
                            </TableCell>
                            <TableCell className="text-slate-600">
                                {user.transactionCount}
                            </TableCell>
                            <TableCell className="text-slate-600">
                                {formatDate(user.registrationDate)}
                            </TableCell>
                            <TableCell className="text-slate-600">
                                {formatDate(user.lastLogin)}
                            </TableCell>
                            <TableCell className="text-right">
                                <div className="flex items-center justify-end gap-2">
                                    <Button
                                        variant="ghost"
                                        size="sm"
                                        className="h-8 w-8 p-0 hover:bg-blue-50 hover:text-blue-600"
                                        title="View Details"
                                        onClick={() => handleView(user.id)}
                                    >
                                        <Eye className="h-4 w-4" />
                                    </Button>
                                    {user.status === 'active' ? (
                                        <Button
                                            variant="ghost"
                                            size="sm"
                                            className="h-8 w-8 p-0 hover:bg-orange-50 hover:text-orange-600"
                                            title="Suspend User"
                                            onClick={() => handleSuspend(user.id)}
                                        >
                                            <UserX className="h-4 w-4" />
                                        </Button>
                                    ) : user.status === 'suspended' ? (
                                        <Button
                                            variant="ghost"
                                            size="sm"
                                            className="h-8 w-8 p-0 hover:bg-green-50 hover:text-green-600"
                                            title="Activate User"
                                            onClick={() => handleActivate(user.id)}
                                        >
                                            <UserCheck className="h-4 w-4" />
                                        </Button>
                                    ) : null}
                                    <Button
                                        variant="ghost"
                                        size="sm"
                                        className="h-8 w-8 p-0 hover:bg-red-50 hover:text-red-600"
                                        title="Delete User"
                                        onClick={() => handleDelete(user.id)}
                                        disabled={user.status === 'deleted'}
                                    >
                                        <Trash2 className="h-4 w-4" />
                                    </Button>
                                </div>
                            </TableCell>
                        </TableRow>
                    ))}
                </TableBody>
            </Table>
        </div>
    );
}
