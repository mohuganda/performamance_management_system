import React from 'react';
import { Loader2 } from 'lucide-react';

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  title?: string;
  variant?: 'primary' | 'secondary' | 'danger';
  loading?: boolean;
}

export const Button: React.FC<ButtonProps> = ({
  title,
  children,
  variant = 'primary',
  loading = false,
  disabled = false,
  className = '',
  ...props
}) => {
  let bgStyle = 'bg-primary dark:bg-white text-white dark:text-zinc-950 font-semibold';

  if (variant === 'secondary') {
    bgStyle = 'bg-gray-200 dark:bg-zinc-800 text-gray-800 dark:text-zinc-200 font-semibold';
  } else if (variant === 'danger') {
    bgStyle = 'bg-[#D90000] dark:bg-red-600 text-white font-semibold';
  }

  return (
    <button
      disabled={disabled || loading}
      className={`w-full px-4 py-3.5 rounded-none flex justify-center items-center gap-2 transition-opacity ${bgStyle} ${
        disabled || loading ? 'opacity-50 cursor-not-allowed' : 'active:opacity-80'
      } ${className}`}
      {...props}
    >
      {loading ? (
        <Loader2 size={18} className="animate-spin text-current" />
      ) : (
        title || children
      )}
    </button>
  );
};
