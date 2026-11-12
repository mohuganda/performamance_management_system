import React from 'react';
import { User } from 'lucide-react';
import { useAuthenticatedImage } from '../../hooks/useAuthenticatedImage';

interface UserAvatarProps {
  photoUrl?: string | null;
  name?: string;
  size?: 'sm' | 'md' | 'lg' | 'xl';
  className?: string;
}

export const UserAvatar: React.FC<UserAvatarProps> = ({
  photoUrl,
  name = 'Officer',
  size = 'md',
  className = '',
}) => {
  const { src, hasError } = useAuthenticatedImage(photoUrl);

  const sizeClasses = {
    sm: 'w-8 h-8',
    md: 'w-12 h-12',
    lg: 'w-16 h-16',
    xl: 'w-24 h-24',
  }[size];

  const iconSizes = {
    sm: 16,
    md: 20,
    lg: 32,
    xl: 48,
  }[size];

  if (src && !hasError) {
    return (
      <img
        src={src}
        alt={name}
        className={`${sizeClasses} rounded-full object-cover border border-zinc-200 dark:border-zinc-800 ${className}`}
      />
    );
  }

  return (
    <div
      className={`${sizeClasses} rounded-full bg-zinc-100 dark:bg-zinc-800 text-zinc-400 dark:text-zinc-500 flex items-center justify-center border border-zinc-200 dark:border-zinc-700 select-none ${className}`}
    >
      <User size={iconSizes} />
    </div>
  );
};

export default UserAvatar;
