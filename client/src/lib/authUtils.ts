export function isUnauthorizedError(error: Error): boolean {
  return /^401: .*Unauthorized/.test(error.message);
}

export function clearAuthData(): void {
  localStorage.removeItem('auth-token');
  localStorage.removeItem('auth-user');
}

export function redirectToLogin(): void {
  clearAuthData();
  window.location.href = '/auth';
}

export function handleAuthError(error: any): void {
  // Check if error is 401, 403, or 404 (unauthorized/forbidden/user not found)
  if (error?.status === 401 || error?.status === 403 || error?.status === 404 ||
      error?.message?.includes('Invalid or expired token') ||
      error?.message?.includes('Authentication failed') ||
      error?.message?.includes('User not found')) {
    redirectToLogin();
  }
}

export function getAuthToken(): string | null {
  return localStorage.getItem('auth-token');
}

export function setAuthData(token: string, user: any): void {
  localStorage.setItem('auth-token', token);
  localStorage.setItem('auth-user', JSON.stringify(user));
}

// Global fetch wrapper that handles auth errors
export async function authFetch(url: string, options: RequestInit = {}): Promise<Response> {
  const token = getAuthToken();
  
  const authOptions: RequestInit = {
    ...options,
    headers: {
      ...options.headers,
      'Authorization': token ? `Bearer ${token}` : '',
      'Content-Type': 'application/json',
    },
    credentials: 'include',
  };

  try {
    const response = await fetch(url, authOptions);
    
    // Check for auth errors
    if (response.status === 401 || response.status === 403 || response.status === 404) {
      handleAuthError({ status: response.status });
      throw new Error('Authentication failed');
    }
    
    return response;
  } catch (error: any) {
    handleAuthError(error);
    throw error;
  }
}