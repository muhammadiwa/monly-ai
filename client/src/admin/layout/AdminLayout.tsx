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
            <div className="lg:pl-64 pt-20">
                <div className="min-h-screen w-full px-6 sm:px-8 lg:px-12 py-8">
                    <div className="w-full max-w-[1600px] mx-auto">
                        {children}
                    </div>
                </div>
            </div>
        </div>
    );
}
