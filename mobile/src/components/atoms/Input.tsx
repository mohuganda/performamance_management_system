import React, { useState } from 'react';
import { TextInput, View, Text, TextInputProps } from 'react-native';
import { useTheme } from '../../app/hooks/useTheme';

export interface InputProps extends TextInputProps {
  label?: string;
  error?: string;
  className?: string;
  inputContainerClassName?: string;
  inputClassName?: string;
  bgColor?: string;
  borderColor?: string;
  focusBorderColor?: string;
  borderWidth?: number;
}

export const Input: React.FC<InputProps> = ({
  label,
  error,
  className = '',
  inputContainerClassName = '',
  inputClassName = '',
  bgColor,
  borderColor,
  focusBorderColor,
  borderWidth,
  multiline,
  numberOfLines,
  style,
  ...props
}) => {
  const [isFocused, setIsFocused] = useState(false);
  const { isDark } = useTheme();

  const containerStyle: any = {};
  if (bgColor) containerStyle.backgroundColor = bgColor;
  if (borderWidth !== undefined) containerStyle.borderWidth = borderWidth;

  if (error) {
    containerStyle.borderColor = isDark ? '#ef4444' : '#D90000';
  } else if (isFocused && focusBorderColor) {
    containerStyle.borderColor = focusBorderColor;
  } else if (borderColor) {
    containerStyle.borderColor = borderColor;
  }

  let tailwindBorderClass = '';
  if (!containerStyle.borderColor) {
    if (error) {
      tailwindBorderClass = 'border-[#D90000] dark:border-red-500';
    } else if (isFocused) {
      tailwindBorderClass = 'border-primary dark:border-gray-500';
    } else {
      tailwindBorderClass = 'border-gray-200 dark:border-zinc-700';
    }
  }

  const tailwindBgClass = bgColor ? '' : 'bg-white dark:bg-zinc-900';

  return (
    <View className={`space-y-1.5 rounded-none ${className}`}>
      {label && (
        <Text className="text-sm font-medium text-gray-700 dark:text-zinc-300 mb-1">{label}</Text>
      )}
      <View
        className={`w-full border rounded-none px-4 py-3 flex-row items-center ${tailwindBgClass} ${tailwindBorderClass} ${inputContainerClassName}`}
        style={Object.keys(containerStyle).length > 0 ? containerStyle : undefined}
      >
        <TextInput
          className={`flex-1 text-base text-gray-900 dark:text-zinc-50 p-0 ${
            multiline && !numberOfLines ? 'min-h-[80px]' : ''
          } ${inputClassName}`}
          style={[
            multiline && numberOfLines ? { minHeight: numberOfLines * 24 } : undefined,
            style as any,
          ]}
          placeholderTextColor={isDark ? '#6B7280' : '#9CA3AF'}
          onFocus={(e) => {
            setIsFocused(true);
            props.onFocus?.(e);
          }}
          onBlur={(e) => {
            setIsFocused(false);
            props.onBlur?.(e);
          }}
          multiline={multiline}
          numberOfLines={numberOfLines}
          textAlignVertical={multiline ? 'top' : 'center'}
          {...props}
        />
      </View>
      {error && (
        <Text className="text-xs text-[#D90000] dark:text-red-500 font-medium mt-0.5">{error}</Text>
      )}
    </View>
  );
};
