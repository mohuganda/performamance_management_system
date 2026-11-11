import React, { useState } from 'react';
import { useTheme } from '../../hooks/useTheme';

export interface InputProps extends React.InputHTMLAttributes<HTMLInputElement | HTMLTextAreaElement> {
  label?: string;
  error?: string;
  multiline?: boolean;
  rows?: number;
  containerClassName?: string;
}

export const Input: React.FC<InputProps> = ({
  label,
  error,
  multiline = false,
  rows = 3,
  containerClassName = '',
  className = '',
  id,
  ...props
}) => {
  const [isFocused, setIsFocused] = useState(false);
  const { colors, isDark } = useTheme();
  const inputId = id || (label ? label.toLowerCase().replace(/\s+/g, '-') : undefined);

  let borderClass = 'border-gray-200 dark:border-zinc-700';
  if (error) {
    borderClass = 'border-[#D90000] dark:border-red-500';
  } else if (isFocused) {
    borderClass = 'border-primary dark:border-gray-400';
  }

  return (
    <div className={`space-y-1.5 rounded-none ${containerClassName}`}>
      {label && (
        <label
          htmlFor={inputId}
          className="block text-sm font-medium text-gray-700 dark:text-zinc-300 mb-1"
        >
          {label}
        </label>
      )}

      <div
        className={`w-full border rounded-none px-4 py-3 flex items-center bg-white dark:bg-[#1E1E1E] ${borderClass}`}
        style={{
          borderColor: error ? (isDark ? '#ef4444' : '#D90000') : undefined,
        }}
      >
        {multiline ? (
          <textarea
            id={inputId}
            rows={rows}
            className={`w-full bg-transparent text-base text-gray-900 dark:text-zinc-50 outline-none resize-none placeholder:text-gray-400 dark:placeholder:text-zinc-500 ${className}`}
            onFocus={() => setIsFocused(true)}
            onBlur={() => setIsFocused(false)}
            {...(props as React.TextareaHTMLAttributes<HTMLTextAreaElement>)}
          />
        ) : (
          <input
            id={inputId}
            className={`w-full bg-transparent text-base text-gray-900 dark:text-zinc-50 outline-none placeholder:text-gray-400 dark:placeholder:text-zinc-500 ${className}`}
            onFocus={() => setIsFocused(true)}
            onBlur={() => setIsFocused(false)}
            {...(props as React.InputHTMLAttributes<HTMLInputElement>)}
          />
        )}
      </div>

      {error && (
        <p className="text-xs text-[#D90000] dark:text-red-500 font-medium mt-0.5">{error}</p>
      )}
    </div>
  );
};
