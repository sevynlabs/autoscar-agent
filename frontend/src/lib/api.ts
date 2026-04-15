const BASE_URL = '/api';

function getAuthHeaders(): Record<string, string> {
  if (typeof window === 'undefined') return {};
  const token = localStorage.getItem('auth_token');
  return token ? { Authorization: `Bearer ${token}` } : {};
}

async function request<T>(path: string, options?: RequestInit): Promise<T> {
  const url = `${BASE_URL}${path}`;
  const headers: Record<string, string> = {
    ...getAuthHeaders(),
  };
  if (options?.body) {
    headers['Content-Type'] = 'application/json';
  }
  const res = await fetch(url, {
    ...options,
    headers,
  });

  if (!res.ok) {
    if (res.status === 401 && typeof window !== 'undefined') {
      localStorage.removeItem('auth_token');
      window.location.href = '/login';
      throw new Error('Session expired');
    }
    const body = await res.text().catch(() => '');
    throw new Error(`API ${res.status}: ${res.statusText} - ${body}`);
  }

  return res.json() as Promise<T>;
}

interface RequestOpts {
  signal?: AbortSignal;
}

export const api = {
  get<T>(path: string, opts?: RequestOpts): Promise<T> {
    return request<T>(path, { method: 'GET', signal: opts?.signal });
  },

  post<T>(path: string, body?: unknown, opts?: RequestOpts): Promise<T> {
    return request<T>(path, {
      method: 'POST',
      body: body ? JSON.stringify(body) : undefined,
      signal: opts?.signal,
    });
  },

  patch<T>(path: string, body?: unknown, opts?: RequestOpts): Promise<T> {
    return request<T>(path, {
      method: 'PATCH',
      body: body ? JSON.stringify(body) : undefined,
      signal: opts?.signal,
    });
  },

  delete<T>(path: string, opts?: RequestOpts): Promise<T> {
    return request<T>(path, { method: 'DELETE', signal: opts?.signal });
  },

  async download(path: string, filename: string, opts?: RequestOpts): Promise<void> {
    const res = await fetch(`${BASE_URL}${path}`, {
      method: 'GET',
      headers: { ...getAuthHeaders() },
      signal: opts?.signal,
    });
    if (!res.ok) {
      if (res.status === 401 && typeof window !== 'undefined') {
        localStorage.removeItem('auth_token');
        window.location.href = '/login';
        throw new Error('Session expired');
      }
      throw new Error(`API ${res.status}: ${res.statusText}`);
    }
    const blob = await res.blob();
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  },
};
