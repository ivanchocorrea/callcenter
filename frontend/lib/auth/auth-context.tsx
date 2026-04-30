'use client';

import { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import { api, tokens, unwrap } from '@/lib/api/client';

export interface AuthUser {
  id: number;
  email: string;
  full_name: string;
  company_id: number | null;
  roles: string[];
  permissions: string[];
}

interface AuthState {
  user: AuthUser | null;
  loading: boolean;
  login: (email: string, password: string, totpCode?: string) => Promise<void>;
  logout: () => Promise<void>;
  hasRole: (role: string) => boolean;
  hasPermission: (perm: string) => boolean;
}

const AuthCtx = createContext<AuthState | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    tokens.loadFromStorage();
    if (typeof window !== 'undefined') {
      const storedCompany = localStorage.getItem('cc_company');
      if (storedCompany) tokens.setCompanyContext(parseInt(storedCompany, 10));
    }
    const access = tokens.getAccess();
    if (!access) {
      setLoading(false);
      return;
    }
    api
      .get('/auth/me')
      .then(res => {
        const me = unwrap<AuthUser & { userId?: number }>(res);
        // adaptamos el shape de me (backend devuelve {userId,email,companyId,...})
        const u: AuthUser = {
          id: (me as any).userId ?? me.id,
          email: me.email,
          full_name: (me as any).full_name ?? '',
          company_id: (me as any).companyId ?? me.company_id ?? null,
          roles: me.roles ?? [],
          permissions: me.permissions ?? [],
        };
        setUser(u);
      })
      .catch(() => setUser(null))
      .finally(() => setLoading(false));
  }, []);

  async function login(email: string, password: string, totpCode?: string) {
    const res = await api.post('/auth/login', { email, password, totp_code: totpCode });
    const data = unwrap<any>(res);
    tokens.set(data.access_token, data.refresh_token);
    if (data.user?.company_id) tokens.setCompanyContext(data.user.company_id);
    setUser(data.user as AuthUser);
  }

  async function logout() {
    const refresh = tokens.getRefresh();
    if (refresh) {
      try {
        await api.post('/auth/logout', { refresh_token: refresh });
      } catch {
        /* swallow */
      }
    }
    tokens.set(null, null);
    tokens.setCompanyContext(null);
    setUser(null);
    if (typeof window !== 'undefined') window.location.href = '/login';
  }

  const hasRole = (role: string) => !!user?.roles.includes(role);
  const hasPermission = (perm: string) => !!user?.permissions.includes(perm);

  return (
    <AuthCtx.Provider value={{ user, loading, login, logout, hasRole, hasPermission }}>
      {children}
    </AuthCtx.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthCtx);
  if (!ctx) throw new Error('useAuth debe usarse dentro de <AuthProvider>');
  return ctx;
}
