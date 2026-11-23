import { createContext, useContext, useEffect, useState, useCallback, useMemo } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { api, setAccessToken, setRefreshToken, setUnauthorizedHandler, refreshToken } from '../lib/api';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [booting, setBooting] = useState(true);
  const [portal, setPortal] = useState(false);
  const queryClient = useQueryClient();

  const clear = useCallback(() => {
    setAccessToken(null);
    setRefreshToken(null);
    setUser(null);
    setPortal(false);
    queryClient.clear();
  }, [queryClient]);

  useEffect(() => {
    setUnauthorizedHandler(clear);
    (async () => {
      // Try to restore session from the HttpOnly refresh cookie on load
      try {
        const data = await refreshToken();
        setAccessToken(data.accessToken);
        if (data.refreshToken) setRefreshToken(data.refreshToken);
        if (data.user?.role === 'CLIENT') { setPortal(true); setUser(data.user); }
        else setUser(data.user);
      } catch { /* no session */ }
      setBooting(false);
    })();
  }, [clear]);

  const login = useCallback(async (credentials) => {
    const data = await api.post('/auth/login', credentials);
    setAccessToken(data.accessToken);
    setRefreshToken(data.refreshToken);
    setUser(data.user);
    setPortal(false);
    return data.user;
  }, []);

  const loginClient = useCallback(async (credentials) => {
    const data = await api.post('/auth/client/login', credentials);
    setAccessToken(data.accessToken);
    setRefreshToken(data.refreshToken);
    setUser(data.user);
    setPortal(true);
    return data.user;
  }, []);

  const register = useCallback(async (payload) => {
    const data = await api.post('/auth/register', payload);
    setAccessToken(data.accessToken);
    setRefreshToken(data.refreshToken);
    setUser(data.user);
    setPortal(false);
    return data;
  }, []);

  const logout = useCallback(async () => {
    try { await api.post('/auth/logout', {}); } catch { /* ignore */ }
    clear();
  }, [clear]);

  const refreshMe = useCallback(async () => {
    try {
      const data = await api.get('/auth/me');
      // Client users must not be sent through /auth/me path for login state; keep existing
      if (data?.user && data.user.role !== 'CLIENT') setUser(data.user);
      return data?.user;
    } catch { return null; }
  }, []);

  const can = useCallback((permission) => {
    if (!user) return false;
    if (user.isSuperAdmin) return true;
    const perms = user.membership?.permissions || [];
    if (perms.includes('*')) return true;
    if (Array.isArray(permission)) return permission.some((p) => perms.includes(p));
    return perms.includes(permission);
  }, [user]);

  const value = useMemo(() => ({
    user, booting, portal, login, loginClient, register, logout, refreshMe, can, setUser,
    isAuthenticated: Boolean(user),
    organization: user?.organization || null,
  }), [user, booting, portal, login, loginClient, register, logout, refreshMe, can]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export const useAuth = () => {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used inside AuthProvider');
  return ctx;
};
