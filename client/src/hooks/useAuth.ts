import { useQuery } from "@tanstack/react-query";
import { useState, useEffect } from "react";
import {
  clearAuthData,
  handleAuthError,
  getAuthToken,
  hasValidAuthData,
  recoverFromInvalidAuth
} from "@/lib/authUtils";

export function useAuth() {
  const [authUser, setAuthUser] = useState(null);
  const [isLoadingAuth, setIsLoadingAuth] = useState(true);
  const [hasToken, setHasToken] = useState(false);

  // Check for auth token in localStorage
  useEffect(() => {
    const checkAuth = () => {
      try {
        // Validate auth data completeness
        if (hasValidAuthData()) {
          const storedAuthUser = localStorage.getItem('auth-user');
          setAuthUser(JSON.parse(storedAuthUser!));
          setHasToken(true);
        } else {
          // Check if we have token but no user data (OAuth flow)
          const authToken = getAuthToken();
          if (authToken) {
            setHasToken(true);
          } else {
            setAuthUser(null);
            setHasToken(false);
          }
        }
      } catch (error) {
        console.error("Error checking auth:", error);
        recoverFromInvalidAuth();
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
    retry: 1, // Retry once for OAuth flow
    retryDelay: 500, // Wait 500ms before retry
    enabled: hasToken, // Only run query if we have a token
    staleTime: 5 * 60 * 1000, // Consider data fresh for 5 minutes
    queryFn: async () => {
      const authToken = getAuthToken();
      if (!authToken) {
        throw new Error('No auth token');
      }

      const res = await fetch('/api/auth/user', {
        headers: {
          'Authorization': `Bearer ${authToken}`,
        },
        credentials: 'include',
      });

      if (res.status === 401 || res.status === 403 || res.status === 404) {
        // Token is invalid, expired, or user not found
        handleAuthError({ status: res.status });
        throw new Error('Authentication failed');
      }

      if (!res.ok) {
        throw new Error(`HTTP ${res.status}`);
      }

      const userData = await res.json();

      // Update localStorage with fresh user data
      if (userData) {
        localStorage.setItem('auth-user', JSON.stringify(userData));
        setAuthUser(userData);
      }

      return userData;
    }
  });

  // Handle auth errors
  useEffect(() => {
    if (error && hasToken) {
      console.error('Auth error:', error);
      handleAuthError(error);
      setAuthUser(null);
      setHasToken(false);
    }
  }, [error, hasToken]);

  // Use priority: apiUser > authUser
  const user = apiUser || authUser;
  const isLoading = isLoadingAuth || (hasToken && isApiLoading);
  const isAuthenticated = !!(hasToken && user);

  const logout = () => {
    clearAuthData();
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
