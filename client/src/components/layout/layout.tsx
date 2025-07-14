import { ReactNode } from "react";
import Navbar from "@/components/layout/navbar";
import Sidebar from "@/components/layout/sidebar";
import MobileHeader from "@/components/layout/mobile-header";
import MobileNav from "@/components/layout/mobile-nav";
import GlobalChat from "@/components/chat/global-chat";

interface LayoutProps {
  children: ReactNode;
}

export default function Layout({ children }: LayoutProps) {
  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100">
      {/* Navbar */}
      <Navbar />
      
      {/* Sidebar */}
      <Sidebar />
      
      {/* Main content area */}
      <div className="lg:pl-64 pt-16">
        <div className="min-h-screen w-full">
          <div className="w-full max-w-none">
            {children}
          </div>
        </div>
      </div>
      
      <MobileNav />
      <GlobalChat />
    </div>
  );
}
