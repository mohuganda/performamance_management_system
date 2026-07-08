import coatOfArms from '@/assets/uganda-coat-of-arms.svg'

interface BrandLogoProps {
  size?: 'sm' | 'md' | 'lg'
  showText?: boolean
}

const sizes = {
  sm: 'h-8 w-8',
  md: 'h-10 w-10',
  lg: 'h-14 w-14',
}

export function BrandLogo({ size = 'md', showText = true }: BrandLogoProps) {
  return (
    <div className="flex items-center gap-3">
      <img
        src={coatOfArms}
        alt="Coat of arms of Uganda"
        className={`${sizes[size]} shrink-0 object-contain`}
      />
      {showText ? (
        <div>
          <p className="text-[10px] font-semibold uppercase tracking-widest text-ui-muted">
            Republic of Uganda
          </p>
          <p className="text-sm font-bold leading-tight text-ui-text">Ministry of Health</p>
          <p className="text-xs text-ui-muted">PMS - iHRIS</p>
        </div>
      ) : null}
    </div>
  )
}
