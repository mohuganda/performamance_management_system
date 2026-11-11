import dayjs from 'dayjs';
import customParseFormat from 'dayjs/plugin/customParseFormat';
import relativeTime from 'dayjs/plugin/relativeTime';

dayjs.extend(customParseFormat);
dayjs.extend(relativeTime);

export type DateInput = string | number | Date | dayjs.Dayjs | null | undefined;

/**
 * Safely parses any date input into a Dayjs instance.
 * Returns null if invalid or empty.
 */
export function parseDate(input: DateInput): dayjs.Dayjs | null {
  if (!input) return null;
  if (dayjs.isDayjs(input)) return input.isValid() ? input : null;

  if (typeof input === 'string') {
    const trimmed = input.trim();
    if (!trimmed) return null;

    // Handle standard YYYY-MM-DD directly without timezone shift
    if (/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) {
      const parsed = dayjs(trimmed, 'YYYY-MM-DD');
      return parsed.isValid() ? parsed : null;
    }

    const d = dayjs(trimmed);
    return d.isValid() ? d : null;
  }

  const d = dayjs(input);
  return d.isValid() ? d : null;
}

/**
 * Format a date into a template string using Day.js.
 * @param dateInput - Date, ISO string, timestamp, or Dayjs object
 * @param formatStr - Output format template (defaults to 'MMM DD, YYYY', e.g. 'Feb 10, 2020')
 * @returns Formatted date string, or empty string / original text if invalid
 */
export function formatDate(
  dateInput: DateInput,
  formatStr: string = 'MMM DD, YYYY'
): string {
  const d = parseDate(dateInput);
  if (!d) {
    return typeof dateInput === 'string' ? dateInput : '';
  }
  return d.format(formatStr);
}

/**
 * Formats a start and end date range.
 * Examples:
 * - "Feb 10, 2020 to Feb 14, 2020"
 * @param startDate - Range start date
 * @param endDate - Range end date
 * @param formatStr - Template for formatting each date (defaults to 'MMM DD, YYYY')
 * @param separator - Separator string (defaults to ' to ')
 */
export function formatDateRange(
  startDate: DateInput,
  endDate: DateInput,
  formatStr: string = 'MMM DD, YYYY',
  separator: string = ' to '
): string {
  if (!startDate && !endDate) return '';
  if (startDate && !endDate) return formatDate(startDate, formatStr);
  if (!startDate && endDate) return formatDate(endDate, formatStr);

  const formattedStart = formatDate(startDate, formatStr);
  const formattedEnd = formatDate(endDate, formatStr);

  if (formattedStart === formattedEnd) {
    return formattedStart;
  }

  return `${formattedStart}${separator}${formattedEnd}`;
}

/**
 * Format time only (defaults to 'hh:mm A', e.g. '02:30 PM')
 */
export function formatTime(
  dateInput: DateInput,
  formatStr: string = 'hh:mm A'
): string {
  return formatDate(dateInput, formatStr);
}

/**
 * Format date and time (defaults to 'MMM DD, YYYY hh:mm A', e.g. 'Feb 10, 2020 02:30 PM')
 */
export function formatDateTime(
  dateInput: DateInput,
  formatStr: string = 'MMM DD, YYYY hh:mm A'
): string {
  return formatDate(dateInput, formatStr);
}

/**
 * Format relative time from now (e.g. '3 hours ago', 'in 2 days')
 */
export function formatRelativeTime(dateInput: DateInput): string {
  const d = parseDate(dateInput);
  if (!d) return '';
  return d.fromNow();
}

export { dayjs };
export default formatDate;
