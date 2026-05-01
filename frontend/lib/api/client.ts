'use client';

import axios, { AxiosError, AxiosRequestConfig } from 'axios';

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001';

export const api = axios.create({
  baseURL: `${API_URL}/api`,
  withCredentials: false,
  timeout: 30_000,
});

let accessToken: string | null = null;
let refreshToken: string | null = null;
let companyContextId: number | null = null;

/**
 * Una pestaña queda marcada como "impersonating" si tiene `cc_impersonating='1'` en sessionStorage.
 * Esa pestaña usa SOLO sessionStorage (no localStorage), de modo que es totalmente independiente
 * de la sesión principal del super_admin en otras pestañas.
 */
function isImpersonatingTab(): boolean {
  if (typeof window === 'undefined') return false;
  return sessionStorage.getItem('cc_impersonating') === '1';
}

function storage(): Storage | null {
  if (typeof window === 'undefined') return null;
  return isImpersonatingTab() ? sessionStorage : localStorage;
}

export const tokens = {
  set(access: string | null, refresh: string | null) {
    accessToken = access;
    refreshToken = refresh;
    const s = storage();
    if (!s) return;
    if (access) s.setItem('cc_access', access); else s.removeItem('cc_access');
    if (refresh) s.setItem('cc_refresh', refresh); else s.removeItem('cc_refresh');
  },
  loadFromStorage() {
    const s = storage();
    if (!s) return;
    accessToken = s.getItem('cc_access');
    refreshToken = s.getItem('cc_refresh');
  },
  getAccess: () => accessToken,
  getRefresh: () => refreshToken,
  setCompanyContext(id: number | null) {
    companyContextId = id;
    const s = storage();
    if (!s) return;
    if (id) s.setItem('cc_company', String(id));
    else s.removeItem('cc_company');
  },
  getCompanyContext: () => companyContextId,
  /** Marca esta pestaña como impersonation y guarda los tokens en sessionStorage */
  startImpersonation(access: string, refresh: string) {
    if (typeof window === 'undefined') return;
    sessionStorage.setItem('cc_impersonating', '1');
    accessToken = access;
    refreshToken = refresh;
    sessionStorage.setItem('cc_access', access);
    sessionStorage.setItem('cc_refresh', refresh);
  },
  isImpersonating: () => isImpersonatingTab(),
};

api.interceptors.request.use(config => {
  if (accessToken && config.headers) {
    config.headers['Authorization'] = `Bearer ${accessToken}`;
  }
  if (companyContextId && config.headers) {
    config.headers['X-Company-Id'] = String(companyContextId);
  }
  return config;
});

let refreshPromise: Promise<string> | null = null;

api.interceptors.response.use(
  res => res,
  async (error: AxiosError) => {
    const original = error.config as AxiosRequestConfig & { _retry?: boolean };
    if (error.response?.status === 401 && !original._retry && refreshToken) {
      original._retry = true;
      try {
        if (!refreshPromise) {
          refreshPromise = (async () => {
            const r = await axios.post(`${API_URL}/api/auth/refresh`, { refresh_token: refreshToken });
            const data = (r.data as any).data ?? r.data;
            tokens.set(data.access_token, data.refresh_token ?? refreshToken);
            return data.access_token as string;
          })();
        }
        const newAccess = await refreshPromise;
        refreshPromise = null;
        if (original.headers) original.headers['Authorization'] = `Bearer ${newAccess}`;
        return api.request(original);
      } catch (e) {
        tokens.set(null, null);
        if (typeof window !== 'undefined') window.location.href = '/login';
        return Promise.reject(e);
      }
    }
    return Promise.reject(error);
  },
);

/** Helper para extraer la respuesta del envelope `{ ok, data, ... }` del backend. */
export function unwrap<T>(res: { data: { ok: boolean; data: T } } | { data: T }): T {
  const d: any = (res as any).data;
  return (d && typeof d === 'object' && 'data' in d ? d.data : d) as T;
}
