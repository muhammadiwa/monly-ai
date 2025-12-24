import { ReactNode } from "react";
import AdminSidebar from "./AdminSidebar";
import AdminHeader from "./AdminHeader";

interface AdminLayoutProps {
    children: ReactNode;
}

export default function AdminLayout({ children }: AdminLayoutProps) {
    return (
        <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100">
            {/* Admin Header */}
            <AdminHeader />

            {/* Admin Sidebar */}
            <AdminSidebar />

            {/* Main content area */}
            <div className="lg:pl-64 pt-20 px-4 sm:px-6 lg:px-8 pb-6">
                <div className="min-h-screen w-full">
                    <div className="w-full max-w-none">
                        {children}
                    </div>
                </div>
            </div>
        </div>
    );
}
