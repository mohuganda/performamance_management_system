import apiClient from '../api/client';

/**
 * Resolves a file URL (such as signature or profile photo) by prefixing
 * the base API URL when a relative path is provided.
 */
export function resolveFileUrl(url?: string | null): string | null {
  if (!url) return null;
  const trimmed = url.trim();
  if (!trimmed) return null;

  // Direct data URIs or already-qualified HTTP/HTTPS URLs
  if (trimmed.startsWith('data:') || trimmed.startsWith('http://') || trimmed.startsWith('https://')) {
    return trimmed;
  }

  // Base API URL, e.g. "/api/v1" or "http://localhost:3030/api/v1"
  const rawBase = apiClient.defaults.baseURL || '';
  const cleanBase = rawBase.replace(/\/+$/, '');

  // If url begins with "/api/v1" and base ends with "/api/v1", strip suffix from base to prevent duplicate segments
  if (trimmed.startsWith('/api/v1') && cleanBase.endsWith('/api/v1')) {
    const host = cleanBase.slice(0, cleanBase.length - '/api/v1'.length);
    return `${host}${trimmed}`;
  }

  // If url starts with a leading slash, append to cleanBase
  if (trimmed.startsWith('/')) {
    return `${cleanBase}${trimmed}`;
  }

  // Otherwise join with a slash
  return `${cleanBase}/${trimmed}`;
}

export default resolveFileUrl;
