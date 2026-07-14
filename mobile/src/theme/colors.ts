export const colors = {
  primary: {
    DEFAULT: '#1A1A1A',
    50: '#F6F6F7',
    100: '#EAEAEB',
    200: '#D5D5D8',
    300: '#B4B4B9',
    400: '#8E8E93',
    500: '#1A1A1A',
    600: '#161616',
    700: '#121212',
    800: '#0E0E0E',
    900: '#0A0A0A',
    950: '#050505',
  },
  ui: {
    bg: '#F4F4F5',
    surface: '#FFFFFF',
    text: '#18181B',
    muted: '#71717A',
    border: '#E4E4E7',
    subtle: '#FAFAFA',
  },
  national: {
    black: '#1A1A1A',
    yellow: '#FCDC04',
    red: '#D90000',
  },
  success: '#15803D',
  warning: '#B45309',
  error: '#D90000',
} as const;

export const statusColors = {
  on_track: '#15803D',
  at_risk: '#B45309',
  off_track: '#D90000',
  below_target: '#B45309',
  exceeds_target: '#15803D',
} as const;

export const lightTheme = {
  primary: colors.primary.DEFAULT,
  background: colors.ui.bg,
  surface: colors.ui.surface,
  text: colors.ui.text,
  muted: colors.ui.muted,
  border: colors.ui.border,
  subtle: colors.ui.subtle,
  success: colors.success,
  warning: colors.warning,
  error: colors.error,
} as const;

export const darkTheme = {
  primary: '#FFFFFF',
  background: '#121212',
  surface: '#1E1E1E',
  text: '#F4F4F5',
  muted: '#A1A1AA',
  border: '#27272A',
  subtle: '#18181B',
  success: '#22C55E',
  warning: '#F59E0B',
  error: '#EF4444',
} as const;
