/**
 * API service with automatic token refresh
 * Handles 401 responses by refreshing the access token and retrying the request
 */
import { useAuthStore, authApi } from '../stores/authStore';

const API_BASE = 'http://localhost:3001/api';

// Flag to prevent multiple simultaneous refresh attempts
let isRefreshing = false;
let refreshPromise: Promise<string | null> | null = null;

/**
 * Attempt to refresh the access token
 * Returns the new access token or null if refresh failed
 */
async function refreshAccessToken(): Promise<string | null> {
  // If already refreshing, wait for the existing refresh to complete
  if (isRefreshing && refreshPromise) {
    return refreshPromise;
  }

  isRefreshing = true;
  refreshPromise = (async () => {
    try {
      const response = await authApi.refreshToken();
      const newAccessToken = response.accessToken;

      // Update the auth store with new token
      useAuthStore.getState().setAccessToken(newAccessToken);

      // Also update user if provided
      if (response.user) {
        useAuthStore.getState().setUser(response.user);
      }

      return newAccessToken;
    } catch (error) {
      console.error('Token refresh failed:', error);
      // Clear auth state on refresh failure
      useAuthStore.getState().logout();
      return null;
    } finally {
      isRefreshing = false;
      refreshPromise = null;
    }
  })();

  return refreshPromise;
}

/**
 * Make an authenticated API request with automatic token refresh
 * @param endpoint - API endpoint (e.g., '/goals')
 * @param options - Fetch options
 * @param retryOnUnauthorized - Whether to retry on 401 (default: true)
 */
export async function apiFetch<T = unknown>(
  endpoint: string,
  options: RequestInit = {},
  retryOnUnauthorized = true
): Promise<T> {
  const { accessToken } = useAuthStore.getState();

  // Prepare headers with auth token
  const headers: HeadersInit = {
    'Content-Type': 'application/json',
    ...options.headers,
  };

  if (accessToken) {
    (headers as Record<string, string>)['Authorization'] = `Bearer ${accessToken}`;
  }

  const url = endpoint.startsWith('http') ? endpoint : `${API_BASE}${endpoint}`;

  // Make the request
  const response = await fetch(url, {
    ...options,
    headers,
    credentials: 'include',
  });

  // Handle 401 Unauthorized - attempt token refresh
  if (response.status === 401 && retryOnUnauthorized) {
    const newAccessToken = await refreshAccessToken();

    if (newAccessToken) {
      // Retry the request with new token
      (headers as Record<string, string>)['Authorization'] = `Bearer ${newAccessToken}`;

      const retryResponse = await fetch(url, {
        ...options,
        headers,
        credentials: 'include',
      });

      if (!retryResponse.ok) {
        const errorData = await retryResponse.json().catch(() => ({}));
        throw new ApiError(
          retryResponse.status,
          errorData.message || errorData.error || 'Request failed',
          errorData.code
        );
      }

      return retryResponse.json();
    } else {
      // Refresh failed, throw unauthorized error
      throw new ApiError(401, 'Session expired. Please log in again.', 'SESSION_EXPIRED');
    }
  }

  // Handle other error responses
  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw new ApiError(
      response.status,
      errorData.message || errorData.error || 'Request failed',
      errorData.code
    );
  }

  return response.json();
}

/**
 * Custom error class for API errors
 */
export class ApiError extends Error {
  status: number;
  code?: string;

  constructor(status: number, message: string, code?: string) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.code = code;
  }
}

/**
 * Convenience methods for common HTTP methods
 */
export const api = {
  get: <T = unknown>(endpoint: string, options?: RequestInit) =>
    apiFetch<T>(endpoint, { ...options, method: 'GET' }),

  post: <T = unknown>(endpoint: string, data?: unknown, options?: RequestInit) =>
    apiFetch<T>(endpoint, {
      ...options,
      method: 'POST',
      body: data ? JSON.stringify(data) : undefined,
    }),

  put: <T = unknown>(endpoint: string, data?: unknown, options?: RequestInit) =>
    apiFetch<T>(endpoint, {
      ...options,
      method: 'PUT',
      body: data ? JSON.stringify(data) : undefined,
    }),

  patch: <T = unknown>(endpoint: string, data?: unknown, options?: RequestInit) =>
    apiFetch<T>(endpoint, {
      ...options,
      method: 'PATCH',
      body: data ? JSON.stringify(data) : undefined,
    }),

  delete: <T = unknown>(endpoint: string, options?: RequestInit) =>
    apiFetch<T>(endpoint, { ...options, method: 'DELETE' }),
};

export default api;
