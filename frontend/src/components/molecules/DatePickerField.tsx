import { useState } from 'react'
import {
  Input,
  Popover,
  PopoverContent,
  PopoverHandler,
} from '@material-tailwind/react'
import { format, parseISO, isValid } from 'date-fns'
import { DayPicker } from 'react-day-picker'
import { ChevronLeft, ChevronRight } from 'lucide-react'
import { mt } from '@/utils/mt'
import 'react-day-picker/dist/style.css'

type DatePickerFieldProps = {
  label: string
  value: string
  onChange: (isoDate: string) => void
  minDate?: Date
  maxDate?: Date
  className?: string
  disabled?: boolean
}

function parseValue(value: string): Date | undefined {
  if (!value) return undefined
  const parsed = parseISO(value)
  return isValid(parsed) ? parsed : undefined
}

export function DatePickerField({
  label,
  value,
  onChange,
  minDate,
  maxDate,
  className,
  disabled,
}: DatePickerFieldProps) {
  const [open, setOpen] = useState(false)
  const selected = parseValue(value)

  return (
    <Popover open={open} handler={setOpen} placement="bottom">
      <PopoverHandler>
        <Input
          {...mt}
          readOnly
          label={label}
          value={selected ? format(selected, 'dd MMM yyyy') : ''}
          onChange={() => null}
          className={className}
          disabled={disabled}
          onClick={() => !disabled && setOpen(true)}
        />
      </PopoverHandler>
      <PopoverContent {...mt} className="z-[9999] rounded-sm border border-ui-border p-2 shadow-lg">
        <DayPicker
          mode="single"
          selected={selected}
          onSelect={(date) => {
            if (!date) return
            onChange(format(date, 'yyyy-MM-dd'))
            setOpen(false)
          }}
          disabled={[
            ...(minDate ? [{ before: minDate }] : []),
            ...(maxDate ? [{ after: maxDate }] : []),
          ]}
          showOutsideDays
          className="border-0"
          classNames={{
            caption: 'flex justify-center py-2 mb-2 relative items-center',
            caption_label: 'text-sm font-medium text-ui-text',
            nav: 'flex items-center',
            nav_button:
              'h-6 w-6 bg-transparent hover:bg-ui-subtle p-1 rounded-sm transition-colors',
            nav_button_previous: 'absolute left-1',
            nav_button_next: 'absolute right-1',
            table: 'w-full border-collapse',
            head_row: 'flex font-medium text-ui-text',
            head_cell: 'm-0.5 w-9 font-normal text-xs',
            row: 'flex w-full mt-1',
            cell: 'text-ui-muted rounded-sm h-9 w-9 text-center text-sm p-0 m-0.5 relative focus-within:relative focus-within:z-20',
            day: 'h-9 w-9 p-0 font-normal rounded-sm hover:bg-ui-subtle',
            day_selected: 'bg-uganda-black text-white hover:bg-uganda-black hover:text-white',
            day_today: 'bg-ui-subtle text-ui-text font-semibold',
            day_outside: 'text-ui-muted opacity-40',
            day_disabled: 'text-ui-muted opacity-30',
            day_hidden: 'invisible',
          }}
          components={{
            IconLeft: () => <ChevronLeft className="h-4 w-4" />,
            IconRight: () => <ChevronRight className="h-4 w-4" />,
          }}
        />
      </PopoverContent>
    </Popover>
  )
}
