import { Children, isValidElement, type ReactElement, type ReactNode } from 'react'
import { Select as MtSelectBase, type SelectProps } from '@material-tailwind/react'
import { mt } from '@/utils/mt'
import { cn } from '@/utils/cn'

type OptionProps = { value?: string | number; children?: ReactNode }

function optionValue(props: OptionProps) {
  return String(props.value ?? '')
}

function resolveSelectedLabel(value: SelectProps['value'], children: ReactNode): ReactNode {
  const items = Children.toArray(children).filter(isValidElement) as ReactElement<OptionProps>[]
  if (items.length === 0) return null

  const normalized = String(value ?? '')
  const match = items.find((item) => optionValue(item.props) === normalized)
  if (match) return match.props.children

  if (normalized === '') {
    const emptyOption = items.find((item) => optionValue(item.props) === '')
    return emptyOption?.props.children ?? null
  }

  return normalized || null
}

/** Material Tailwind Select with reliable selected-label rendering (async options, empty values). */
export function Select({ children, value, selected, ...props }: SelectProps) {
  const labelResolver =
    typeof selected === 'function'
      ? selected
      : () => resolveSelectedLabel(value, children)

  return (
    <MtSelectBase
      {...mt}
      {...props}
      className={[props.className, 'text-ui-text'].filter(Boolean).join(' ')}
      value={value}
      selected={labelResolver}
    >
      {children}
    </MtSelectBase>
  )
}

type IconSelectProps = SelectProps & {
  icon?: ReactNode
  iconClassName?: string
}

/** Outlined Select with a leading icon that does not overlap the selected label. */
export function IconSelect({ icon, iconClassName, className, children, ...props }: IconSelectProps) {
  if (!icon) {
    return (
      <Select className={className} {...props}>
        {children}
      </Select>
    )
  }

  return (
    <div className="relative w-full">
      <div
        className={cn(
          'pointer-events-none absolute left-3 top-2/4 z-10 flex -translate-y-2/4 items-center pt-0.5 [&_svg]:h-4 [&_svg]:w-4',
          iconClassName,
        )}
      >
        {icon}
      </div>
      <Select className={cn('[&_button>span]:!left-9', className)} {...props}>
        {children}
      </Select>
    </div>
  )
}

export { Option } from '@material-tailwind/react'
