import { QueryClient, QueryFunction } from "@tanstack/react-query";

async function throwIfResNotOk(res: Response) {
  if (!res.ok) {
    const text = (await res.text()) || res.statusText;
    throw new Error(`${res.status}: ${text}`);
  }
}

export async function apiRequest(
  method: string,
  url: string,
  data?: unknown | undefined,
): Promise<Response> {
  // Get demo user ID from localStorage
  const demoUserData = localStorage.getItem('demo-user');
  const demoUserId = demoUserData ? JSON.parse(demoUserData).id : null;
  
  // Get auth token from localStorage
  const authToken = localStorage.getItem('auth-token');
  
  const headers: any = data ? { "Content-Type": "application/json" } : {};
  
  // Add demo user ID to headers if available
  if (demoUserId) {
    headers['x-demo-user-id'] = demoUserId;
  }
  
  // Add Authorization header if token exists
  if (authToken) {
    headers['Authorization'] = `Bearer ${authToken}`;
  }
  
  const res = await fetch(url, {
    method,
    headers,
    body: data ? JSON.stringify(data) : undefined,
    credentials: "include",
  });

  await throwIfResNotOk(res);
  return res;
}

type UnauthorizedBehavior = "returnNull" | "throw";
export const getQueryFn: <T>(options: {
  on401: UnauthorizedBehavior;
}) => QueryFunction<T> =
  ({ on401: unauthorizedBehavior }) =>
  async ({ queryKey }) => {
    // Get demo user ID from localStorage
    const demoUserData = localStorage.getItem('demo-user');
    const demoUserId = demoUserData ? JSON.parse(demoUserData).id : null;
    
    // Get auth token from localStorage
    const authToken = localStorage.getItem('auth-token');
    
    const headers: any = {};
    
    // Add demo user ID to headers if available
    if (demoUserId) {
      headers['x-demo-user-id'] = demoUserId;
    }
    
    // Add Authorization header if token exists
    if (authToken) {
      headers['Authorization'] = `Bearer ${authToken}`;
    }
    
    const res = await fetch(queryKey.join("") as string, {
      credentials: "include",
      headers,
    });

    if (unauthorizedBehavior === "returnNull" && res.status === 401) {
      return null;
    }

    await throwIfResNotOk(res);
    return await res.json();
  };

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      queryFn: getQueryFn({ on401: "throw" }),
      refetchInterval: false,
      refetchOnWindowFocus: false,
      staleTime: Infinity,
      retry: false,
    },
    mutations: {
      retry: false,
    },
  },
});
