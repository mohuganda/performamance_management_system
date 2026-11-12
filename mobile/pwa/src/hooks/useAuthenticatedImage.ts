import { useState, useEffect } from 'react';
import { useAuthStore } from '../stores/authStore';
import { resolveFileUrl } from '../utils/fileUrl';

export function useAuthenticatedImage(url?: string | null) {
  const [blobUrl, setBlobUrl] = useState<string | null>(null);
  const [hasError, setHasError] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const token = useAuthStore((s) => s.token);

  useEffect(() => {
    if (!url || !url.trim()) {
      setBlobUrl(null);
      setHasError(false);
      setIsLoading(false);
      return;
    }

    const trimmed = url.trim();

    // Base64 data URLs can be used directly without network fetch
    if (trimmed.startsWith('data:')) {
      setBlobUrl(trimmed);
      setHasError(false);
      setIsLoading(false);
      return;
    }

    let isMounted = true;
    let createdUrl: string | null = null;

    const fetchImage = async () => {
      setIsLoading(true);
      setHasError(false);
      try {
        const fullUrl = resolveFileUrl(trimmed);
        if (!fullUrl) throw new Error('Invalid URL');

        const headers: Record<string, string> = {};
        if (token) {
          headers['Authorization'] = `Bearer ${token}`;
        }

        const res = await fetch(fullUrl, { headers });
        if (!res.ok) {
          throw new Error(`Failed to load image: ${res.status}`);
        }
        const blob = await res.blob();
        createdUrl = URL.createObjectURL(blob);
        if (isMounted) {
          setBlobUrl(createdUrl);
        }
      } catch (err) {
        if (isMounted) {
          setHasError(true);
          setBlobUrl(null);
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
      if (createdUrl) {
        URL.revokeObjectURL(createdUrl);
      }
    };
  }, [url, token]);

  return { src: blobUrl, hasError, isLoading };
}

export default useAuthenticatedImage;
