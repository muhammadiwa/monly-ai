import { useQuery } from "@tanstack/react-query";
import { useState, useEffect } from "react";

export function useAuth() {
  // Try to get user from API (for real auth) - call this first
  const { data: apiUser, isLoading: isApiLoading } = useQuery({
    queryKey: ["/api/auth/user"],
    retry: false,
  });

  const [demoUser, setDemoUser] = useState(null);
  const [isLoadingDemo, setIsLoadingDemo] = useState(true);

  // Check for demo user in localStorage
  useEffect(() => {
    const checkDemoUser = () => {
      try {
        const storedUser = localStorage.getItem('demo-user');
        if (storedUser) {
          setDemoUser(JSON.parse(storedUser));
        }
      } catch (error) {
        console.error("Error checking demo user:", error);
      } finally {
        setIsLoadingDemo(false);
      }
    };

    checkDemoUser();
  }, []);

  // Use demo user if no API user
  const user = apiUser || demoUser;
  const isLoading = isApiLoading || isLoadingDemo;

  const logout = () => {
    localStorage.removeItem('demo-user');
    window.location.href = '/';
  };

  return {
    user,
    isLoading,
    isAuthenticated: !!user,
    logout,
  };
}
