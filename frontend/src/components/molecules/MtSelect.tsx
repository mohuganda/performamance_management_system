import { Children, isValidElement, type ReactElement, type ReactNode } from 'react'
import { Select as MtSelectBase, type SelectProps } from '@material-tailwind/react'
import { mt } from '@/utils/mt'

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
export function Select({ children, value, selected, menuProps, ...props }: SelectProps) {
  const labelResolver =
    typeof selected === 'function'
      ? selected
      : () => resolveSelectedLabel(value, children)

  return (
    <MtSelectBase
      {...mt}
      {...props}
      className={[props.className, 'text-ui-text'].filter(Boolean).join(' ')}
      menuProps={{
        ...menuProps,
        className: [
          'max-h-72 overflow-auto border border-ui-border bg-ui-surface text-ui-text shadow-lg',
          menuProps?.className,
        ]
          .filter(Boolean)
          .join(' '),
      }}
      labelProps={{
        ...props.labelProps,
        className: [props.labelProps?.className, 'text-ui-muted'].filter(Boolean).join(' '),
      }}
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

/** @deprecated Use Select — leading field icons are no longer used. */
export function IconSelect({ icon: _icon, iconClassName: _iconClassName, className, children, ...props }: IconSelectProps) {
  return (
    <Select className={className} {...props}>
      {children}
    </Select>
  )
}

export { Option } from '@material-tailwind/react'
