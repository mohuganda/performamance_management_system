import { cn } from '@/utils/cn'
import { useAuthenticatedMediaUrl } from '@/hooks/useAuthenticatedMediaUrl'

interface UserAvatarProps {
  name: string
  photoUrl?: string | null
  size?: 'sm' | 'md' | 'lg'
  className?: string
  /** Stronger ring for photo/initials on colored header chrome. */
  onColoredChrome?: boolean
}

const sizeClasses = {
  sm: 'h-8 w-8 text-xs',
  md: 'h-10 w-10 text-sm',
  lg: 'h-24 w-24 text-2xl',
}

/**
 * Non-green palette so initials stay distinct from MoH teal/green chrome.
 * Saturated enough for white initials on light or dark headers.
 */
const AVATAR_PALETTE = [
  { bg: '#9f1239' }, // rose
  { bg: '#1b4d89' }, // navy
  { bg: '#c45c26' }, // terracotta
  { bg: '#6b2d5c' }, // plum
  { bg: '#9a3412' }, // rust
  { bg: '#4338ca' }, // indigo
  { bg: '#b45309' }, // amber
  { bg: '#1d4ed8' }, // blue
  { bg: '#86198f' }, // fuchsia
  { bg: '#b91c1c' }, // crimson
  { bg: '#0369a1' }, // sky
  { bg: '#7c2d12' }, // brown
] as const

function initialsFromName(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean)
  if (parts.length === 0) return 'U'
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase()
  return `${parts[0][0]}${parts[parts.length - 1][0]}`.toUpperCase()
}

function colorFromName(name: string) {
  const key = name.trim().toLowerCase() || 'user'
  let hash = 0
  for (let i = 0; i < key.length; i += 1) {
    hash = (hash * 31 + key.charCodeAt(i)) >>> 0
  }
  return AVATAR_PALETTE[hash % AVATAR_PALETTE.length]
}

export function UserAvatar({
  name,
  photoUrl,
  size = 'md',
  className,
  onColoredChrome = false,
}: UserAvatarProps) {
  const sizeClass = sizeClasses[size]
  const palette = colorFromName(name)
  const resolvedPhoto = useAuthenticatedMediaUrl(photoUrl)
  const chromeRing = onColoredChrome
    ? 'border-2 border-white ring-2 ring-white/90 shadow-sm'
    : 'border-2 border-white/80 ring-2 ring-black/10 shadow-sm'

  if (resolvedPhoto) {
    return (
      <img
        src={resolvedPhoto}
        alt={name}
        className={cn('rounded-full object-cover', chromeRing, sizeClass, className)}
      />
    )
  }

  return (
    <div
      className={cn(
        'flex shrink-0 items-center justify-center rounded-full font-semibold tracking-wide text-white',
        chromeRing,
        sizeClass,
        className,
      )}
      style={{ backgroundColor: palette.bg }}
      aria-hidden
      title={name}
    >
      {initialsFromName(name)}
    </div>
  )
}
