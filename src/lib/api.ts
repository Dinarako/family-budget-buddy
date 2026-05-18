// In development the Vite proxy routes /api/* → http://localhost:3001
// so API_URL is an empty string (relative path).
// In production set VITE_API_URL to the full backend origin, e.g. https://api.example.com
const API_URL = (import.meta.env.VITE_API_URL as string | undefined) ?? '';

export class ApiError extends Error {
  status: number;
  constructor(message: string, status: number) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
  }
}

export async function apiRequest<T>(path: string, options?: RequestInit): Promise<T> {
  const token = localStorage.getItem('auth_token');
  const headers: HeadersInit = {
    'Content-Type': 'application/json',
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
    ...(options?.headers ?? {}),
  };

  const response = await fetch(`${API_URL}${path}`, { ...options, headers });
  const data = await response.json();

  if (!response.ok) {
    throw new ApiError(data.error || 'Request failed', response.status);
  }

  return data as T;
}
