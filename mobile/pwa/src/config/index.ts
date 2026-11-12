const envApiUrl = import.meta.env.VITE_API_BASE_URL;

/**
 * In development, if the environment variable points to a remote origin without CORS (45.10.154.35),
 * default to the local same-origin proxy endpoint '/api/v1' to prevent browser CORS preflight blocks.
 */
function resolveApiBaseUrl(): string {
  if (import.meta.env.DEV) {
    if (!envApiUrl || envApiUrl.includes('45.10.154.35')) {
      return '/api/v1';
    }
  }
  return envApiUrl || '/api/v1';
}

export const config = {
  apiBaseUrl: resolveApiBaseUrl(),
  googleMapsApiKey: import.meta.env.VITE_GOOGLE_MAPS_API_KEY || '',
};
