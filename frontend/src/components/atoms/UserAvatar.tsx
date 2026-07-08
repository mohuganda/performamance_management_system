import { cn } from '@/utils/cn'

interface UserAvatarProps {
  name: string
  photoUrl?: string | null
  size?: 'sm' | 'md' | 'lg'
  className?: string
}

const sizeClasses = {
  sm: 'h-8 w-8 text-xs',
  md: 'h-10 w-10 text-sm',
  lg: 'h-24 w-24 text-2xl',
}

function initialsFromName(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean)
  if (parts.length === 0) return 'U'
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase()
  return `${parts[0][0]}${parts[parts.length - 1][0]}`.toUpperCase()
}

export function UserAvatar({ name, photoUrl, size = 'md', className }: UserAvatarProps) {
  const sizeClass = sizeClasses[size]

  if (photoUrl) {
    return (
      <img
        src={photoUrl}
        alt={name}
        className={cn(
          'rounded-full border-2 border-moh-green/20 object-cover shadow-sm',
          sizeClass,
          className,
        )}
      />
    )
  }

  return (
    <div
      className={cn(
        'flex items-center justify-center rounded-full border-2 border-moh-green/30 bg-moh-green/10 font-semibold text-moh-green',
        sizeClass,
        className,
      )}
      aria-hidden
    >
      {initialsFromName(name)}
    </div>
  )
}
