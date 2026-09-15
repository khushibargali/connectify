import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { authApi } from '../api/auth.api.js';
import { getToken, onUnauthorized, setToken } from '../api/client.js';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [token, setTokenState] = useState(() => getToken());
  const [loading, setLoading] = useState(() => Boolean(getToken()));

  const clearSession = useCallback(() => {
    setToken(null);
    setTokenState(null);
    setUser(null);
  }, []);

  // Restore the session from a stored token on first load.
  useEffect(() => {
    if (!getToken()) return undefined;
    let active = true;
    authApi
      .me()
      .then((me) => active && setUser(me))
      .catch(() => active && clearSession())
      .finally(() => active && setLoading(false));
    return () => {
      active = false;
    };
  }, [clearSession]);

  useEffect(() => onUnauthorized(clearSession), [clearSession]);

  const applySession = useCallback((session) => {
    setToken(session.token);
    setTokenState(session.token);
    setUser(session.user);
  }, []);

  const login = useCallback(async (credentials) => applySession(await authApi.login(credentials)), [applySession]);
  const register = useCallback(async (data) => applySession(await authApi.register(data)), [applySession]);
  const logout = useCallback(() => {
    const current = getToken();
    if (current) authApi.logout(current).catch(() => {});
    clearSession();
  }, [clearSession]);

  const value = useMemo(
    () => ({ user, token, loading, login, register, logout, updateUser: setUser }),
    [user, token, loading, login, register, logout],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used inside <AuthProvider>');
  return ctx;
}
