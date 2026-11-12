const envApiUrl = import.meta.env.VITE_API_BASE_URL;

/**
 * Resolves the API base URL.
 * When set to a relative path (e.g. '/api/v1'), requests route through
 * the local Vite dev proxy or the production Nginx reverse proxy.
 * This guarantees same-origin communication, eliminating CORS and Mixed Content blocks.
 */
function resolveApiBaseUrl(): string {
  return envApiUrl || '/api/v1';
}

export const config = {
  apiBaseUrl: resolveApiBaseUrl(),
  googleMapsApiKey: import.meta.env.VITE_GOOGLE_MAPS_API_KEY || '',
};
