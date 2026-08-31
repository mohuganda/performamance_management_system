import { cn } from '@/utils/cn'

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

/** Saturated backgrounds that keep white initials readable on light or dark headers. */
const AVATAR_PALETTE = [
  { bg: '#0d7377', ring: 'rgba(255,255,255,0.92)' }, // teal
  { bg: '#1b4d89', ring: 'rgba(255,255,255,0.92)' }, // navy
  { bg: '#c45c26', ring: 'rgba(255,255,255,0.92)' }, // terracotta
  { bg: '#6b2d5c', ring: 'rgba(255,255,255,0.92)' }, // plum
  { bg: '#2d6a4f', ring: 'rgba(255,255,255,0.92)' }, // forest
  { bg: '#9a3412', ring: 'rgba(255,255,255,0.92)' }, // rust
  { bg: '#4338ca', ring: 'rgba(255,255,255,0.92)' }, // indigo
  { bg: '#0f766e', ring: 'rgba(255,255,255,0.92)' }, // deep teal
  { bg: '#b45309', ring: 'rgba(255,255,255,0.92)' }, // amber
  { bg: '#9f1239', ring: 'rgba(255,255,255,0.92)' }, // rose
  { bg: '#1d4ed8', ring: 'rgba(255,255,255,0.92)' }, // blue
  { bg: '#166534', ring: 'rgba(255,255,255,0.92)' }, // green
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
  const chromeRing = onColoredChrome
    ? 'border-2 border-white ring-2 ring-white/90 shadow-sm'
    : 'border-2 border-white/80 ring-2 ring-black/10 shadow-sm'

  if (photoUrl) {
    return (
      <img
        src={photoUrl}
        alt={name}
        className={cn('rounded-full object-cover', chromeRing, sizeClass, className)}
      />
    )
  }

  return (
    <div
      className={cn(
        'flex items-center justify-center rounded-full font-semibold tracking-wide text-white',
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
