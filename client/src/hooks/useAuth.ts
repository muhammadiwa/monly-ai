import { useQuery } from "@tanstack/react-query";
import { useState, useEffect } from "react";

export function useAuth() {
  const [demoUser, setDemoUser] = useState(null);
  const [authUser, setAuthUser] = useState(null);
  const [isLoadingDemo, setIsLoadingDemo] = useState(true);
  const [hasToken, setHasToken] = useState(false);

  // Check for demo user and auth token in localStorage
  useEffect(() => {
    const checkAuth = () => {
      try {
        // Check for demo user
        const storedDemoUser = localStorage.getItem('demo-user');
        if (storedDemoUser) {
          setDemoUser(JSON.parse(storedDemoUser));
        }
        
        // Check for auth token and user
        const authToken = localStorage.getItem('auth-token');
        const storedAuthUser = localStorage.getItem('auth-user');
        
        if (authToken && storedAuthUser) {
          setAuthUser(JSON.parse(storedAuthUser));
          setHasToken(true);
        }
      } catch (error) {
        console.error("Error checking auth:", error);
      } finally {
        setIsLoadingDemo(false);
      }
    };

    checkAuth();
  }, []);

  // Only try to get user from API if we have a token (for validation)
  const { data: apiUser, isLoading: isApiLoading } = useQuery({
    queryKey: ["/api/auth/user"],
    retry: false,
    enabled: hasToken, // Only run query if we have a token
  });

  // Use priority: apiUser > authUser > demoUser
  const user = apiUser || authUser || demoUser;
  const isLoading = isLoadingDemo || (hasToken && isApiLoading);

  const logout = () => {
    localStorage.removeItem('demo-user');
    localStorage.removeItem('auth-token');
    localStorage.removeItem('auth-user');
    window.location.href = '/';
  };

  return {
    user,
    isLoading,
    isAuthenticated: !!user,
    logout,
  };
}
