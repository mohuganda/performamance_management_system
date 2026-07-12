import { addDays, format, parseISO, startOfDay } from 'date-fns'

export type LeavePolicyConfig = {
  advance_notice_days?: number
  enforce_advance_notice?: boolean
  block_past_dates?: boolean
  exempt_sick_leave_advance_notice?: boolean
}

export type LeaveTypePolicyInput = {
  code?: string
  advance_notice_days?: number | null
}

export function minLeaveStartDate(
  policy: LeavePolicyConfig | undefined,
  leaveType: LeaveTypePolicyInput | undefined,
): Date {
  const today = startOfDay(new Date())
  let min = today

  const blockPast = policy?.block_past_dates !== false
  const enforceAdvance = policy?.enforce_advance_notice !== false
  const sickExempt =
    policy?.exempt_sick_leave_advance_notice !== false && leaveType?.code === 'sick'

  if (blockPast) {
    min = today
  }

  if (enforceAdvance && !sickExempt) {
    const advanceDays = leaveType?.advance_notice_days ?? policy?.advance_notice_days ?? 14
    if (advanceDays > 0) {
      const withNotice = addDays(today, advanceDays)
      if (withNotice > min) min = withNotice
    }
  }

  return min
}

export function validateLeaveDates(
  form: { start_date: string; end_date: string },
  policy: LeavePolicyConfig | undefined,
  leaveType: LeaveTypePolicyInput | undefined,
): string | null {
  if (!form.start_date || !form.end_date) return null

  const start = parseISO(form.start_date)
  const end = parseISO(form.end_date)
  const today = startOfDay(new Date())
  const minStart = minLeaveStartDate(policy, leaveType)

  if (policy?.block_past_dates !== false) {
    if (start < today || end < today) {
      return 'Leave cannot be applied for past dates.'
    }
  }

  if (start < minStart) {
    const advanceDays = leaveType?.advance_notice_days ?? policy?.advance_notice_days ?? 14
    if (leaveType?.code === 'sick' && policy?.exempt_sick_leave_advance_notice !== false) {
      return 'Start date cannot be in the past.'
    }
    return `Leave must be requested at least ${advanceDays} days before the start date (earliest: ${format(minStart, 'dd MMM yyyy')}).`
  }

  if (end < start) {
    return 'End date cannot be before the start date.'
  }

  return null
}
