/**
 * Cliente HTTP con JWT Bearer y refresh automático.
 * En un 401, intenta renovar el access token (una vez) con el refresh token
 * y reintenta la petición; si el refresh falla, limpia la sesión y notifica.
 */
const BASE = import.meta.env.VITE_API_URL ?? '';
const ACCESS = 'nexo_access';
const REFRESH = 'nexo_refresh';

export interface Tokens {
  accessToken: string;
  refreshToken: string;
}

export const tokenStore = {
  get access() {
    return localStorage.getItem(ACCESS);
  },
  get refresh() {
    return localStorage.getItem(REFRESH);
  },
  set(t: Tokens) {
    localStorage.setItem(ACCESS, t.accessToken);
    localStorage.setItem(REFRESH, t.refreshToken);
  },
  clear() {
    localStorage.removeItem(ACCESS);
    localStorage.removeItem(REFRESH);
  },
};

// Callback que AuthContext registra para reaccionar a una sesión caducada.
let onLogout: () => void = () => {};
export function setOnLogout(cb: () => void) {
  onLogout = cb;
}

async function refreshTokens(): Promise<boolean> {
  const refreshToken = tokenStore.refresh;
  if (!refreshToken) return false;
  const res = await fetch(`${BASE}/api/auth/refresh`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ refreshToken }),
  });
  if (!res.ok) return false;
  tokenStore.set(await res.json());
  return true;
}

async function request<T>(path: string, init: RequestInit = {}, retryOn401 = true): Promise<T> {
  const access = tokenStore.access;
  const res = await fetch(`${BASE}/api${path}`, {
    ...init,
    headers: {
      'Content-Type': 'application/json',
      ...(access ? { Authorization: `Bearer ${access}` } : {}),
      ...(init.headers ?? {}),
    },
  });

  if (res.status === 401 && retryOn401) {
    if (await refreshTokens()) return request<T>(path, init, false);
    tokenStore.clear();
    onLogout();
    throw new Error('Sesión expirada. Vuelve a iniciar sesión.');
  }

  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body.message ?? `Error ${res.status}`);
  }
  return res.status === 204 ? (undefined as T) : res.json();
}

export const api = {
  get: <T>(p: string) => request<T>(p),
  post: <T>(p: string, body?: unknown) =>
    request<T>(p, { method: 'POST', body: body === undefined ? undefined : JSON.stringify(body) }),
  patch: <T>(p: string, body: unknown) => request<T>(p, { method: 'PATCH', body: JSON.stringify(body) }),
  del: <T>(p: string) => request<T>(p, { method: 'DELETE' }),
};

/** Descarga un fichero del backend (con Bearer) y dispara el guardado en el navegador. */
export async function downloadFile(path: string, filename: string): Promise<void> {
  const res = await fetch(`${BASE}/api${path}`, {
    headers: tokenStore.access ? { Authorization: `Bearer ${tokenStore.access}` } : {},
  });
  if (!res.ok) throw new Error(`No se pudo exportar (${res.status})`);
  const blob = await res.blob();
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

// Login: no reintentar con refresh (un 401 aquí = credenciales inválidas, no sesión caducada).
export const authApi = {
  login: (email: string, password: string) =>
    request<Tokens & { user: unknown }>(
      '/auth/login',
      { method: 'POST', body: JSON.stringify({ email, password }) },
      false,
    ),
};
