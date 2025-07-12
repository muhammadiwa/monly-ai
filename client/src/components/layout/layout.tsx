import { ReactNode } from "react";
import Sidebar from "@/components/layout/sidebar";
import MobileHeader from "@/components/layout/mobile-header";
import MobileNav from "@/components/layout/mobile-nav";

interface LayoutProps {
  children: ReactNode;
}

export default function Layout({ children }: LayoutProps) {
  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100">
      <Sidebar />
      <MobileHeader />
      
      {/* Main content area */}
      <div className="lg:pl-64">
        <div className="min-h-screen">
          {children}
        </div>
      </div>
      
      <MobileNav />
    </div>
  );
}
