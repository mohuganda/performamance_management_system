import { cn } from '@/utils/cn'
import type { HTMLAttributes } from 'react'

export function Card({ className, ...props }: HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn('rounded-sm border border-ui-border bg-ui-surface p-4 shadow-sm', className)}
      {...props}
    />
  )
}
