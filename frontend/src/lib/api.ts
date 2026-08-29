const API_BASE = import.meta.env.VITE_API_BASE ?? '';

async function request<T>(path: string, options: RequestInit = {}): Promise<T> {
  const response = await fetch(`${API_BASE}${path}`, {
    headers: {
      'Content-Type': 'application/json',
      ...(options.headers ?? {}),
    },
    ...options,
  });

  if (!response.ok) {
    const body = await response.json().catch(() => ({}));
    throw new Error(body.message || 'Request failed');
  }

  return (await response.json()) as T;
}

export async function apiLogin(email: string, password: string) {
  return request<{ user: { role: string; name: string; email: string }; token: string }>('/api/login', {
    method: 'POST',
    body: JSON.stringify({ email, password }),
  });
}

export async function apiHealth() {
  return request<{ ok: boolean; service: string; timestamp: string }>('/api/health');
}
