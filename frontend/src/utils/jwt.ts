/** Decode JWT `exp` claim (seconds since epoch) without verifying signature. */
export function getTokenExpiryMs(token: string | null | undefined): number | null {
  if (!token) return null
  const parts = token.split('.')
  if (parts.length < 2) return null
  try {
    const base64 = parts[1].replace(/-/g, '+').replace(/_/g, '/')
    const padded = base64 + '='.repeat((4 - (base64.length % 4)) % 4)
    const payload = JSON.parse(atob(padded)) as { exp?: number }
    if (typeof payload.exp === 'number' && payload.exp > 0) {
      return payload.exp * 1000
    }
  } catch {
    return null
  }
  return null
}
