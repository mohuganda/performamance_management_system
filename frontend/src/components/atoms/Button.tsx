import { cn } from '@/utils/cn'
import type { ButtonHTMLAttributes } from 'react'

type Variant = 'primary' | 'secondary' | 'ghost' | 'danger'

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant
}

const variants: Record<Variant, string> = {
  primary: 'bg-uganda-black text-white hover:bg-ui-text',
  secondary: 'bg-ui-subtle text-ui-text border border-ui-border hover:bg-ui-border/50',
  ghost: 'bg-transparent border border-ui-border text-ui-text hover:bg-ui-subtle',
  danger: 'bg-uganda-red text-white hover:opacity-90',
}

export function Button({ className, variant = 'primary', ...props }: ButtonProps) {
  return (
    <button
      className={cn(
        'inline-flex items-center justify-center rounded-sm px-3 py-2 text-sm font-semibold transition disabled:opacity-50',
        variants[variant],
        className,
      )}
      {...props}
    />
  )
}
