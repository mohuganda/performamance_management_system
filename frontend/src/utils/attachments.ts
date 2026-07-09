export type AttachmentMeta = {
  url: string
  name: string
  mime_type?: string
  mime?: string
  size?: number
}

export function parseAttachments(raw?: string | null): AttachmentMeta[] {
  if (!raw?.trim()) return []
  try {
    const parsed = JSON.parse(raw) as unknown
    if (Array.isArray(parsed)) {
      return parsed
        .map((item): AttachmentMeta | null => {
          if (!item || typeof item !== 'object') return null
          const row = item as Record<string, unknown>
          const url = String(row.url ?? '')
          if (!url) return null
          return {
            url,
            name: String(row.name ?? 'Attachment'),
            mime_type: String(row.mime_type ?? row.mime ?? ''),
            size: row.size != null ? Number(row.size) : undefined,
          }
        })
        .filter((item): item is AttachmentMeta => item !== null)
    }
  } catch {
    // Legacy single URL string
  }
  return [{ url: raw, name: 'Attachment', mime_type: '' }]
}

export function serializeAttachments(items: AttachmentMeta[]): string {
  if (items.length === 0) return ''
  return JSON.stringify(
    items.map((item) => ({
      url: item.url,
      name: item.name,
      mime_type: item.mime_type ?? item.mime ?? '',
      size: item.size,
    })),
  )
}

export function resolveFileUrl(url: string): string {
  if (url.startsWith('http://') || url.startsWith('https://') || url.startsWith('data:')) {
    return url
  }
  if (url.startsWith('/api/')) {
    if (url.includes('?path=')) return url
    return url
  }
  const base =
    import.meta.env.VITE_API_BASE_URL ??
    (import.meta.env.DEV ? '/api/v1' : 'http://127.0.0.1:3030/api/v1')
  const normalizedBase = base.replace(/\/$/, '')
  return `${normalizedBase}${url.startsWith('/') ? url : `/${url}`}`
}

export function isImageAttachment(item: AttachmentMeta): boolean {
  const mime = item.mime_type ?? item.mime ?? ''
  if (mime.startsWith('image/')) return true
  return /\.(png|jpe?g|gif|webp)$/i.test(item.url)
}

export function readFileAsDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(String(reader.result ?? ''))
    reader.onerror = () => reject(new Error('Could not read file'))
    reader.readAsDataURL(file)
  })
}
