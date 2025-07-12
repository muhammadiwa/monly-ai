import { useState } from "react";
import { Menu, User, ChartLine } from "lucide-react";
import { Button } from "@/components/ui/button";

export default function MobileHeader() {
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);

  return (
    <div className="lg:hidden bg-white shadow-sm border-b">
      <div className="flex items-center justify-between px-4 py-3">
        <Button
          variant="ghost"
          size="sm"
          onClick={() => setIsSidebarOpen(!isSidebarOpen)}
        >
          <Menu className="h-5 w-5" />
        </Button>
        
        <div className="flex items-center">
          <ChartLine className="h-6 w-6 mr-2 text-primary" />
          <span className="text-xl font-bold text-gray-800">Monly AI</span>
        </div>
        
        <Button variant="ghost" size="sm">
          <User className="h-5 w-5" />
        </Button>
      </div>
      
      {/* Mobile Sidebar Overlay */}
      {isSidebarOpen && (
        <>
          <div 
            className="fixed inset-0 bg-black bg-opacity-50 z-40"
            onClick={() => setIsSidebarOpen(false)}
          />
          <div className="fixed inset-y-0 left-0 z-50 w-64 bg-white shadow-lg transform translate-x-0 transition-transform duration-300 ease-in-out">
            {/* Content would be similar to Sidebar component */}
          </div>
        </>
      )}
    </div>
  );
}
