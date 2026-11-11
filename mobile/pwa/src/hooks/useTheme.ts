import { useMemo } from 'react';
import { useThemeStore } from '../stores/themeStore';

export const lightTheme = {
  primary: '#1A1A1A',
  background: '#F4F4F5',
  surface: '#FFFFFF',
  text: '#18181B',
  muted: '#71717A',
  border: '#E4E4E7',
  subtle: '#FAFAFA',
  success: '#15803D',
  warning: '#B45309',
  error: '#D90000',
} as const;

export const darkTheme = {
  primary: '#FFFFFF',
  background: '#010101',
  surface: '#1E1E1E',
  text: '#F4F4F5',
  muted: '#A1A1AA',
  border: '#27272A',
  subtle: '#18181B',
  success: '#22C55E',
  warning: '#F59E0B',
  error: '#EF4444',
} as const;

export const useTheme = () => {
  const { themeMode, setThemeMode, isDark } = useThemeStore();

  const colors = useMemo(() => {
    return isDark ? darkTheme : lightTheme;
  }, [isDark]);

  return {
    themeMode,
    setThemeMode,
    isDark,
    colors,
  };
};

