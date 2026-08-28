export const API_BASE_URL = (import.meta.env.VITE_API_BASE_URL || '').replace(/\/$/, '');

export function apiUrl(path: string): string {
  const suffix = path.startsWith('/') ? path : `/${path}`;
  if (!API_BASE_URL) {
    throw new Error('VITE_API_BASE_URL is not set. Point it at the deployed web app.');
  }
  return `${API_BASE_URL}${suffix}`;
}
