import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
  DropdownMenuLabel,
} from "@/components/ui/dropdown-menu";
import { 
  Bell, 
  Globe, 
  User, 
  LogOut, 
  Settings,
  Check
} from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { useQuery } from "@tanstack/react-query";

interface NavbarProps {
  readonly className?: string;
}

export default function Navbar({ className }: NavbarProps) {
  const { user, logout } = useAuth();
  const [selectedLanguage, setSelectedLanguage] = useState('en');
  const [selectedCurrency, setSelectedCurrency] = useState('IDR');

  // Fetch user preferences (remove unused)
  const { refetch: refetchPreferences } = useQuery({
    queryKey: ["/api/user/preferences"],
    retry: false,
  });

  const handleLanguageChange = async (langCode: string) => {
    setSelectedLanguage(langCode);
    // Implement language change API call
    console.log('Language changed to:', langCode);
  };

  const handleCurrencyChange = async (currencyCode: string) => {
    setSelectedCurrency(currencyCode);
    // Implement currency change API call
    console.log('Currency changed to:', currencyCode);
    refetchPreferences();
  };

  const handleSignOut = () => {
    logout();
  };

  return (
    <nav className={`bg-white/95 backdrop-blur-lg border-b border-gray-200/80 sticky top-0 z-50 shadow-sm ${className}`}>
      <div className="w-full px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between items-center h-16">
          {/* Left side - Logo (visible on all screens) */}
          <div className="flex items-center space-x-2">
            <div className="w-8 h-8 bg-gradient-to-r from-emerald-600 to-blue-600 rounded-lg flex items-center justify-center shadow-md">
              <span className="text-white font-bold text-sm">M</span>
            </div>
            <span className="text-lg font-bold bg-gradient-to-r from-emerald-600 to-blue-600 bg-clip-text text-transparent">
              Monly AI
            </span>
          </div>

          {/* Right side - Navigation items */}
          <div className="flex items-center space-x-2">
            {/* Notifications */}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="sm" className="relative h-9 w-9 hover:bg-gray-100">
                  <Bell className="h-4 w-4" />
                  <span className="absolute -top-1 -right-1 h-4 w-4 bg-red-500 text-white rounded-full text-[10px] flex items-center justify-center font-medium">
                    3
                  </span>
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-80">
                <DropdownMenuLabel>Notifications</DropdownMenuLabel>
                <DropdownMenuSeparator />
                <DropdownMenuItem className="flex flex-col items-start p-3">
                  <div className="font-medium">Budget Alert</div>
                  <div className="text-sm text-gray-500">You've spent 80% of your grocery budget</div>
                  <div className="text-xs text-gray-400 mt-1">2 hours ago</div>
                </DropdownMenuItem>
                <DropdownMenuItem className="flex flex-col items-start p-3">
                  <div className="font-medium">New Transaction</div>
                  <div className="text-sm text-gray-500">Coffee purchase - $4.50</div>
                  <div className="text-xs text-gray-400 mt-1">1 day ago</div>
                </DropdownMenuItem>
                <DropdownMenuItem className="flex flex-col items-start p-3">
                  <div className="font-medium">Monthly Report</div>
                  <div className="text-sm text-gray-500">Your financial report is ready</div>
                  <div className="text-xs text-gray-400 mt-1">3 days ago</div>
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>

            {/* Language Selector */}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="sm" className="flex items-center space-x-1 h-9 px-2 hover:bg-gray-100">
                  <Globe className="h-4 w-4" />
                  <span className="text-sm font-medium hidden sm:inline">
                    {selectedLanguage === 'en' ? 'EN' : 'ID'}
                  </span>
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-40">
                <DropdownMenuLabel>Language</DropdownMenuLabel>
                <DropdownMenuSeparator />
                <DropdownMenuItem
                  onClick={() => handleLanguageChange('en')}
                  className="flex items-center justify-between"
                >
                  <div className="flex items-center space-x-2">
                    <span>🇺🇸</span>
                    <span>EN</span>
                  </div>
                  {selectedLanguage === 'en' && (
                    <Check className="h-4 w-4 text-green-600" />
                  )}
                </DropdownMenuItem>
                <DropdownMenuItem
                  onClick={() => handleLanguageChange('id')}
                  className="flex items-center justify-between"
                >
                  <div className="flex items-center space-x-2">
                    <span>🇮🇩</span>
                    <span>ID</span>
                  </div>
                  {selectedLanguage === 'id' && (
                    <Check className="h-4 w-4 text-green-600" />
                  )}
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>

            {/* Profile Dropdown */}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" className="relative h-9 w-9 rounded-full hover:bg-gray-100">
                  <Avatar className="h-9 w-9">
                    <AvatarImage src={user?.profileImageUrl} alt={user?.firstName} />
                    <AvatarFallback className="bg-gradient-to-br from-emerald-500 to-blue-600 text-white text-sm">
                      {(user?.firstName || 'U').charAt(0)}
                    </AvatarFallback>
                  </Avatar>
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent className="w-56" align="end" forceMount>
                <DropdownMenuLabel className="font-normal">
                  <div className="flex flex-col space-y-1">
                    <p className="text-sm font-medium leading-none">
                      {user?.firstName} {user?.lastName}
                    </p>
                    <p className="text-xs leading-none text-muted-foreground">
                      {user?.email}
                    </p>
                  </div>
                </DropdownMenuLabel>
                <DropdownMenuSeparator />
                <DropdownMenuItem className="cursor-pointer">
                  <User className="mr-2 h-4 w-4" />
                  <span>Profile Settings</span>
                </DropdownMenuItem>
                <DropdownMenuItem className="cursor-pointer">
                  <Settings className="mr-2 h-4 w-4" />
                  <span>Account Settings</span>
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem 
                  className="cursor-pointer text-red-600 focus:text-red-600"
                  onClick={handleSignOut}
                >
                  <LogOut className="mr-2 h-4 w-4" />
                  <span>Sign Out</span>
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>
      </div>
    </nav>
  );
}
