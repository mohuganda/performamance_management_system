import React, { useState, useEffect } from 'react';
import { Image, View } from 'react-native';
import { User } from 'lucide-react-native';
import { useAuthStore } from '../../stores/authStore';
import { resolveFileUrl } from '../../utils/fileUrl';

interface UserAvatarProps {
  photoUrl?: string | null;
  name?: string;
  size?: 'sm' | 'md' | 'lg' | 'xl';
  className?: string;
}

export const UserAvatar: React.FC<UserAvatarProps> = ({
  photoUrl,
  name,
  size = 'md',
  className = '',
}) => {
  const token = useAuthStore((state) => state.token);
  const [hasError, setHasError] = useState(false);

  useEffect(() => {
    setHasError(false);
  }, [photoUrl]);

  let sizeClass = 'w-10 h-10';
  let iconSize = 20;

  if (size === 'sm') {
    sizeClass = 'w-8 h-8';
    iconSize = 16;
  } else if (size === 'lg') {
    sizeClass = 'w-16 h-16';
    iconSize = 32;
  } else if (size === 'xl') {
    sizeClass = 'w-24 h-24';
    iconSize = 48;
  }

  const resolvedUrl = resolveFileUrl(photoUrl);

  return (
    <View
      className={`rounded-full overflow-hidden items-center justify-center bg-gray-100 dark:bg-zinc-800 border border-gray-200 dark:border-zinc-700 ${sizeClass} ${className}`}
    >
      {resolvedUrl && !hasError ? (
        <Image
          source={{
            uri: resolvedUrl,
            headers: token ? { Authorization: `Bearer ${token}` } : undefined,
          }}
          className="w-full h-full"
          resizeMode="cover"
          onError={() => setHasError(true)}
        />
      ) : (
        <User size={iconSize} color="#9CA3AF" />
      )}
    </View>
  );
};
