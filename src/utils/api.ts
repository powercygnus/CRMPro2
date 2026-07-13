/**
 * API Configuration
 * Centralized API URL configuration for production and development.
 */

/**
 * Get the base API URL from environment variables.
 * Falls back to localhost for development.
 */
export function getApiUrl(): string {
  // In dev, Vite proxies /api → backend on port 3001, so use relative URLs.
  // In production or when VITE_API_URL is explicitly set, use that value.
  return import.meta.env.VITE_API_URL || '';
}

/**
 * Build a full API endpoint URL.
 * @param path - The API path (e.g., '/api/whatsapp/test')
 */
export function getApiEndpoint(path: string): string {
  const base = getApiUrl();
  return `${base}${path.startsWith('/') ? '' : '/'}${path}`;
}
