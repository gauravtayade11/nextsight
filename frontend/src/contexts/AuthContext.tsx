import { createContext, useContext, useState, useEffect, useCallback, useRef, ReactNode } from 'react';
import { authApi } from '../services/api';
import api from '../services/api';
import type { User, UserRole } from '../types';

interface AuthContextType {
  user: User | null;
  token: string | null;
  isAuthenticated: boolean;
  loading: boolean;
  error: string | null;
  login: (username: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
  changePassword: (currentPassword: string, newPassword: string) => Promise<void>;
  hasPermission: (permission: string) => boolean;
  hasRole: (minRole: UserRole) => boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

const TOKEN_KEY = 'nextsight_token';
const REFRESH_TOKEN_KEY = 'nextsight_refresh_token';
const USER_KEY = 'nextsight_user';
const TOKEN_EXPIRY_KEY = 'nextsight_token_expiry';

const ROLE_HIERARCHY: Record<UserRole, number> = {
  viewer: 1,
  operator: 2,
  developer: 3,
  admin: 4,
};

// Refresh token 1 minute before expiry
const REFRESH_BUFFER_MS = 60 * 1000;

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(() => {
    const stored = localStorage.getItem(USER_KEY);
    return stored ? JSON.parse(stored) : null;
  });
  const [token, setToken] = useState<string | null>(() => {
    return localStorage.getItem(TOKEN_KEY);
  });
  const [refreshToken, setRefreshToken] = useState<string | null>(() => {
    return localStorage.getItem(REFRESH_TOKEN_KEY);
  });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const refreshTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const isRefreshingRef = useRef(false);
  const justLoggedInRef = useRef(false);

  // Clear auth state
  const clearAuthState = useCallback(() => {
    localStorage.removeItem(TOKEN_KEY);
    localStorage.removeItem(REFRESH_TOKEN_KEY);
    localStorage.removeItem(USER_KEY);
    localStorage.removeItem(TOKEN_EXPIRY_KEY);
    setToken(null);
    setRefreshToken(null);
    setUser(null);
    if (refreshTimerRef.current) {
      clearTimeout(refreshTimerRef.current);
      refreshTimerRef.current = null;
    }
  }, []);

  // Refresh the access token
  const refreshAccessToken = useCallback(async (): Promise<string | null> => {
    if (!refreshToken || isRefreshingRef.current) return null;

    isRefreshingRef.current = true;
    try {
      const response = await authApi.refreshToken(refreshToken);
      const { access_token, expires_in } = response.data;

      // Store new access token
      localStorage.setItem(TOKEN_KEY, access_token);
      const expiryTime = Date.now() + (expires_in * 1000);
      localStorage.setItem(TOKEN_EXPIRY_KEY, expiryTime.toString());

      setToken(access_token);
      return access_token;
    } catch (err) {
      console.error('Token refresh failed:', err);
      clearAuthState();
      return null;
    } finally {
      isRefreshingRef.current = false;
    }
  }, [refreshToken, clearAuthState]);

  // Schedule token refresh
  const scheduleTokenRefresh = useCallback((expiresIn: number) => {
    if (refreshTimerRef.current) {
      clearTimeout(refreshTimerRef.current);
    }

    // Refresh before expiry
    const refreshTime = (expiresIn * 1000) - REFRESH_BUFFER_MS;
    if (refreshTime > 0) {
      refreshTimerRef.current = setTimeout(() => {
        refreshAccessToken();
      }, refreshTime);
    }
  }, [refreshAccessToken]);

  // Response interceptor for handling 401 errors - set up once
  useEffect(() => {
    const responseInterceptor = api.interceptors.response.use(
      (response) => response,
      async (error) => {
        const originalRequest = error.config;

        // If 401 and not already retrying, try to refresh
        if (error.response?.status === 401 && !originalRequest._retry) {
          originalRequest._retry = true;

          const storedRefreshToken = localStorage.getItem(REFRESH_TOKEN_KEY);
          if (storedRefreshToken && !isRefreshingRef.current) {
            try {
              const newToken = await refreshAccessToken();
              if (newToken) {
                originalRequest.headers.Authorization = `Bearer ${newToken}`;
                return api(originalRequest);
              }
            } catch (refreshError) {
              clearAuthState();
              return Promise.reject(refreshError);
            }
          }
        }

        return Promise.reject(error);
      }
    );

    return () => {
      api.interceptors.response.eject(responseInterceptor);
    };
  }, [refreshAccessToken, clearAuthState]);

  // Verify token on mount and set up refresh timer
  useEffect(() => {
    async function verifyToken() {
      // Skip verification if we just logged in (we already have user data)
      if (justLoggedInRef.current) {
        justLoggedInRef.current = false;
        setLoading(false);
        return;
      }

      if (!token) {
        setLoading(false);
        return;
      }

      try {
        const response = await authApi.getCurrentUser();
        setUser(response.data);
        localStorage.setItem(USER_KEY, JSON.stringify(response.data));

        // Check if we need to schedule a refresh
        const expiryTime = localStorage.getItem(TOKEN_EXPIRY_KEY);
        if (expiryTime) {
          const timeUntilExpiry = parseInt(expiryTime) - Date.now();
          if (timeUntilExpiry > REFRESH_BUFFER_MS) {
            scheduleTokenRefresh(timeUntilExpiry / 1000);
          } else if (refreshToken) {
            // Token is about to expire, refresh now
            refreshAccessToken();
          }
        }
      } catch (err) {
        // Token is invalid, try to refresh
        if (refreshToken) {
          const newToken = await refreshAccessToken();
          if (!newToken) {
            clearAuthState();
          }
        } else {
          clearAuthState();
        }
      } finally {
        setLoading(false);
      }
    }

    verifyToken();
  }, [token, refreshToken, scheduleTokenRefresh, refreshAccessToken, clearAuthState]);

  // Cleanup timer on unmount
  useEffect(() => {
    return () => {
      if (refreshTimerRef.current) {
        clearTimeout(refreshTimerRef.current);
      }
    };
  }, []);

  const login = useCallback(async (username: string, password: string) => {
    setError(null);
    setLoading(true);

    try {
      const response = await authApi.login(username, password);
      const { access_token, refresh_token, expires_in, user: userData } = response.data;

      // Store tokens and user data
      localStorage.setItem(TOKEN_KEY, access_token);
      localStorage.setItem(REFRESH_TOKEN_KEY, refresh_token);
      localStorage.setItem(USER_KEY, JSON.stringify(userData));

      const expiryTime = Date.now() + (expires_in * 1000);
      localStorage.setItem(TOKEN_EXPIRY_KEY, expiryTime.toString());

      // Mark that we just logged in to skip verifyToken in useEffect
      justLoggedInRef.current = true;

      setToken(access_token);
      setRefreshToken(refresh_token);
      setUser(userData);

      // Schedule token refresh
      scheduleTokenRefresh(expires_in);
    } catch (err: unknown) {
      const errorMessage = err instanceof Error ? err.message : 'Login failed';
      setError(errorMessage);
      throw new Error(errorMessage);
    } finally {
      setLoading(false);
    }
  }, [scheduleTokenRefresh]);

  const logout = useCallback(async () => {
    try {
      // Call backend logout to invalidate tokens
      if (token) {
        await authApi.logout(refreshToken || undefined);
      }
    } catch (err) {
      console.error('Logout API call failed:', err);
    } finally {
      clearAuthState();
    }
  }, [token, refreshToken, clearAuthState]);

  const changePassword = useCallback(async (currentPassword: string, newPassword: string) => {
    try {
      await authApi.changePassword({
        current_password: currentPassword,
        new_password: newPassword,
      });
    } catch (err: unknown) {
      const errorMessage = err instanceof Error ? err.message : 'Password change failed';
      throw new Error(errorMessage);
    }
  }, []);

  const hasPermission = useCallback((_permission: string): boolean => {
    if (!user) return false;
    if (user.role === 'admin') return true;
    // Add more permission checks based on role
    return false;
  }, [user]);

  const hasRole = useCallback((minRole: UserRole): boolean => {
    if (!user) return false;
    const userLevel = ROLE_HIERARCHY[user.role];
    const requiredLevel = ROLE_HIERARCHY[minRole];
    return userLevel >= requiredLevel;
  }, [user]);

  return (
    <AuthContext.Provider value={{
      user,
      token,
      isAuthenticated: !!token && !!user,
      loading,
      error,
      login,
      logout,
      changePassword,
      hasPermission,
      hasRole,
    }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
