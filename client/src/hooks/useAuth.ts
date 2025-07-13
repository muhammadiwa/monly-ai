import { useQuery } from "@tanstack/react-query";
import { useState, useEffect } from "react";

export function useAuth() {
  const [authUser, setAuthUser] = useState(null);
  const [isLoadingAuth, setIsLoadingAuth] = useState(true);
  const [hasToken, setHasToken] = useState(false);

  // Check for auth token in localStorage
  useEffect(() => {
    const checkAuth = () => {
      try {
        // Check for auth token and user
        const authToken = localStorage.getItem('auth-token');
        const storedAuthUser = localStorage.getItem('auth-user');
        
        if (authToken && storedAuthUser) {
          setAuthUser(JSON.parse(storedAuthUser));
          setHasToken(true);
        } else {
          // If no token, user is not authenticated
          setAuthUser(null);
          setHasToken(false);
        }
      } catch (error) {
        console.error("Error checking auth:", error);
        setAuthUser(null);
        setHasToken(false);
      } finally {
        setIsLoadingAuth(false);
      }
    };

    checkAuth();
  }, []);

  // Get user from API if we have a token
  const { data: apiUser, isLoading: isApiLoading, error } = useQuery({
    queryKey: ["/api/auth/user"],
    retry: false,
    enabled: hasToken, // Only run query if we have a token
    queryFn: async () => {
      const authToken = localStorage.getItem('auth-token');
      if (!authToken) {
        throw new Error('No auth token');
      }

      const res = await fetch('/api/auth/user', {
        headers: {
          'Authorization': `Bearer ${authToken}`,
        },
        credentials: 'include',
      });

      if (res.status === 401 || res.status === 404) {
        // Token is invalid or user not found, clear auth data
        localStorage.removeItem('auth-token');
        localStorage.removeItem('auth-user');
        setAuthUser(null);
        setHasToken(false);
        throw new Error('Authentication failed');
      }

      if (!res.ok) {
        throw new Error(`HTTP ${res.status}`);
      }

      return res.json();
    },
  });

  // Use priority: apiUser > authUser
  const user = apiUser || authUser;
  const isLoading = isLoadingAuth || (hasToken && isApiLoading);
  const isAuthenticated = !!(hasToken && user);

  const logout = () => {
    localStorage.removeItem('auth-token');
    localStorage.removeItem('auth-user');
    setAuthUser(null);
    setHasToken(false);
    window.location.href = '/auth';
  };

  return {
    user,
    isLoading,
    isAuthenticated,
    logout,
  };
}
