import { useState, useEffect } from 'react';
import { useAuthStore } from '../../stores/authStore';
import { resolveFileUrl } from '../../utils/fileUrl';

const memoryCache = new Map<string, string>();

/**
 * Invalidates the in-memory cache for an image URL or the entire cache.
 */
export function invalidateImageCache(url?: string | null) {
  if (!url) {
    memoryCache.clear();
    return;
  }
  const resolved = resolveFileUrl(url.trim());
  if (resolved) {
    memoryCache.delete(resolved);
  }
  memoryCache.delete(url.trim());
}

/**
 * Custom hook to safely fetch and render protected backend images (e.g. profile photos, signatures)
 * in React Native by converting the authenticated response stream to a cached Base64 data URI.
 */
export function useAuthenticatedImage(url?: string | null) {
  const [dataUri, setDataUri] = useState<string | null>(null);
  const [hasError, setHasError] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const token = useAuthStore((s) => s.token);

  useEffect(() => {
    if (!url || !url.trim()) {
      setDataUri(null);
      setHasError(false);
      setIsLoading(false);
      return;
    }

    const trimmed = url.trim();

    // Already a Base64 data URL
    if (trimmed.startsWith('data:')) {
      setDataUri(trimmed);
      setHasError(false);
      setIsLoading(false);
      return;
    }

    const fullUrl = resolveFileUrl(trimmed);
    if (!fullUrl) {
      setHasError(true);
      setIsLoading(false);
      return;
    }

    // Check memory cache first for instant rendering
    if (memoryCache.has(fullUrl)) {
      setDataUri(memoryCache.get(fullUrl)!);
      setHasError(false);
      setIsLoading(false);
      return;
    }

    // If token hasn't hydrated from AsyncStorage yet, wait for hydration
    if (!token) {
      setIsLoading(true);
      return;
    }

    let isMounted = true;

    const fetchImage = async () => {
      setIsLoading(true);
      setHasError(false);
      try {
        const response = await fetch(fullUrl, {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        });

        if (!response.ok) {
          throw new Error(`Failed to load image: ${response.status}`);
        }

        const blob = await response.blob();
        const base64 = await new Promise<string>((resolve, reject) => {
          const reader = new FileReader();
          reader.onload = () => resolve(String(reader.result));
          reader.onerror = reject;
          reader.readAsDataURL(blob);
        });

        memoryCache.set(fullUrl, base64);
        if (isMounted) {
          setDataUri(base64);
          setHasError(false);
        }
      } catch (err) {
        if (isMounted) {
          setHasError(true);
          setDataUri(null);
        }
      } finally {
        if (isMounted) {
          setIsLoading(false);
        }
      }
    };

    fetchImage();

    return () => {
      isMounted = false;
    };
  }, [url, token]);

  return { src: dataUri, hasError, isLoading };
}

export default useAuthenticatedImage;
