import { colors, lightTheme, darkTheme } from './colors';
import { typography } from './typography';
import { spacing } from './spacing';

export const theme = {
  colors: {
    light: lightTheme,
    dark: darkTheme,
  },
  typography,
  spacing,
} as const;

export interface ThemeColors {
  readonly primary: string;
  readonly background: string;
  readonly surface: string;
  readonly text: string;
  readonly muted: string;
  readonly border: string;
  readonly subtle: string;
  readonly success: string;
  readonly warning: string;
  readonly error: string;
}

export { colors, lightTheme, darkTheme, typography, spacing };
