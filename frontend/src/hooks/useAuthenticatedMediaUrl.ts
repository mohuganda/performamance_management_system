import { useEffect, useState } from 'react'
import apiClient from '@/api/client'

function isInlineOrAbsolute(url: string) {
  return (
    url.startsWith('data:') ||
    url.startsWith('blob:') ||
    url.startsWith('http://') ||
    url.startsWith('https://')
  )
}

/** Resolve profile/signature/attachment URLs that require the auth API. */
export function useAuthenticatedMediaUrl(mediaUrl?: string | null) {
  const [src, setSrc] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    let objectUrl: string | null = null

    async function load() {
      const raw = mediaUrl?.trim() || ''
      if (!raw) {
        setSrc(null)
        return
      }
      if (isInlineOrAbsolute(raw)) {
        setSrc(raw)
        return
      }

      try {
        const path = raw.startsWith('/api/v1/')
          ? raw.replace(/^\/api\/v1/, '')
          : raw.startsWith('/files')
            ? raw
            : `/files?path=${encodeURIComponent(raw.replace(/^\//, ''))}`
        const { data } = await apiClient.get(path, { responseType: 'blob' })
        objectUrl = URL.createObjectURL(data)
        if (!cancelled) setSrc(objectUrl)
      } catch {
        if (!cancelled) setSrc(null)
      }
    }

    void load()
    return () => {
      cancelled = true
      if (objectUrl) URL.revokeObjectURL(objectUrl)
    }
  }, [mediaUrl])

  return src
}
