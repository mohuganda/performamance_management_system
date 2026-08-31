import coatOfArms from '@/assets/uganda-coat-of-arms.svg'
import { cn } from '@/utils/cn'

interface BrandLogoProps {
  size?: 'sm' | 'md' | 'lg'
  showText?: boolean
  /** Use nav chrome colors (white on teal/crimson bars). */
  tone?: 'default' | 'nav'
}

const sizes = {
  sm: 'h-8 w-8',
  md: 'h-10 w-10',
  lg: 'h-14 w-14',
}

export function BrandLogo({ size = 'md', showText = true, tone = 'default' }: BrandLogoProps) {
  const onNav = tone === 'nav'
  return (
    <div className="flex items-center gap-3">
      <img
        src={coatOfArms}
        alt="Coat of arms of Uganda"
        className={`${sizes[size]} shrink-0 object-contain`}
      />
      {showText ? (
        <div>
          <p
            className={cn(
              'text-[10px] font-semibold uppercase tracking-widest',
              onNav ? 'app-nav-muted' : 'text-ui-muted',
            )}
          >
            Republic of Uganda
          </p>
          <p
            className={cn(
              'text-sm font-bold leading-tight',
              onNav ? 'text-[color:var(--nav-fg)]' : 'text-ui-text',
            )}
          >
            Ministry of Health
          </p>
          <p className={cn('text-xs', onNav ? 'app-nav-muted' : 'text-ui-muted')}>PMS - iHRIS</p>
        </div>
      ) : null}
    </div>
  )
}
