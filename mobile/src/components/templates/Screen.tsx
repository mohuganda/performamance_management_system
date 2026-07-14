import React from 'react';

import { View, ViewProps, StyleProp, ViewStyle } from 'react-native';
import { useSafeAreaInsets, Edge } from 'react-native-safe-area-context';

import { useTheme } from '../../app/hooks/useTheme';

interface ScreenProps extends ViewProps {
  children: React.ReactNode;
  edges?: Edge[];
  style?: StyleProp<ViewStyle>;
  className?: string;
}

export const Screen: React.FC<ScreenProps> = ({
  children,
  edges = ['bottom', 'left', 'right'],
  style,
  className,
  ...props
}) => {
  const insets = useSafeAreaInsets();
  const { colors } = useTheme();

  const insetStyle: ViewStyle = {
    paddingTop: edges.includes('top') ? insets.top : 0,
    paddingBottom: edges.includes('bottom') ? insets.bottom : 0,
    paddingLeft: edges.includes('left') ? insets.left : 0,
    paddingRight: edges.includes('right') ? insets.right : 0,
  };

  return (
    <View
      style={[insetStyle, { backgroundColor: colors.surface, paddingTop: insets.top }, style]}
      className={`flex-1 bg-background ${className || ''}`}
      {...props}>
      <View className="flex-1" style={{ backgroundColor: colors.background }}>
        {children}
      </View>
    </View>
  );
};
