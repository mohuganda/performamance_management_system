import React from 'react';
import { Image, Text, View } from 'react-native';

interface UserAvatarProps {
  photoUrl?: string | null;
  name: string;
  size?: 'sm' | 'md' | 'lg';
  className?: string;
}

export const UserAvatar: React.FC<UserAvatarProps> = ({
  photoUrl,
  name,
  size = 'md',
  className = '',
}) => {
  let sizeClass = 'w-10 h-10';
  let textClass = 'text-sm font-semibold';

  if (size === 'sm') {
    sizeClass = 'w-8 h-8';
    textClass = 'text-xs font-semibold';
  } else if (size === 'lg') {
    sizeClass = 'w-16 h-16';
    textClass = 'text-xl font-bold';
  }

  const getInitials = (userName: string) => {
    if (!userName) return 'MoH';
    const parts = userName.split(' ');
    if (parts.length >= 2) {
      return `${parts[0][0]}${parts[1][0]}`.toUpperCase();
    }
    return userName.substring(0, 2).toUpperCase();
  };

  return (
    <View className={`rounded-full overflow-hidden items-center justify-center bg-gray-100 border border-gray-200 ${sizeClass} ${className}`}>
      {photoUrl ? (
        <Image
          source={{ uri: photoUrl }}
          className="w-full h-full"
          resizeMode="cover"
        />
      ) : (
        <Text className={`text-gray-800 ${textClass}`}>{getInitials(name)}</Text>
      )}
    </View>
  );
};
