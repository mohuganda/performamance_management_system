export const colors = {
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
} as const

export const statusColors = {
  on_track: '#15803D',
  at_risk: '#B45309',
  off_track: '#D90000',
  below_target: '#B45309',
  exceeds_target: '#15803D',
} as const
