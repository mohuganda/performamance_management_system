import { useEffect, useMemo } from 'react';

import { useColorScheme as useNWColorScheme } from 'nativewind';
import { useColorScheme as useRNColorScheme } from 'react-native';

import { useThemeStore } from '../store/useThemeStore';
import { theme, ThemeColors } from '../../theme';

export const useTheme = () => {
  const { themeMode, setThemeMode } = useThemeStore();
  const { colorScheme: nwScheme, setColorScheme } = useNWColorScheme();
  const systemScheme = useRNColorScheme();

  // Determine the active dark mode status
  const isDark = useMemo(() => {
    if (themeMode === 'system') {
      return systemScheme === 'dark';
    }
    return themeMode === 'dark';
  }, [themeMode, systemScheme]);

  // Synchronize NativeWind's internal state with our derived theme status
  useEffect(() => {
    const targetScheme = isDark ? 'dark' : 'light';
    // Only trigger update if different to avoid infinite loops or unnecessary renders
    if (nwScheme !== targetScheme) {
      setColorScheme(targetScheme);
    }
  }, [isDark, nwScheme, setColorScheme]);

  // Get the active colors for the current theme
  const activeColors: ThemeColors = useMemo(() => {
    return isDark ? theme.colors.dark : theme.colors.light;
  }, [isDark]);

  return {
    themeMode,
    setThemeMode,
    colorScheme: isDark ? 'dark' : 'light',
    colors: activeColors,
    isDark,
    theme,
  };
};
