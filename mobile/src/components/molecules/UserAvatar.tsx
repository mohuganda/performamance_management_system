import React from 'react';
import { View, Image, StyleSheet, StyleProp, ViewStyle } from 'react-native';
import { User } from 'lucide-react-native';
import { useTheme } from '../../app/hooks/useTheme';
import { useAuthenticatedImage } from '../../app/hooks/useAuthenticatedImage';

export interface UserProfilePictureProps {
  uri?: string | null;
  size?: number;
  style?: StyleProp<ViewStyle>;
  accessibilityLabel?: string;
}

export const UserProfilePicture: React.FC<UserProfilePictureProps> = ({
  uri,
  size = 32,
  style,
  accessibilityLabel,
}) => {
  const { colors } = useTheme();
  const { src, hasError } = useAuthenticatedImage(uri);
  const showImage = Boolean(src && !hasError);

  const dimension = { width: size, height: size, borderRadius: size / 2 };
  const iconSize = Math.round(size * 0.45);

  return (
    <View
      accessibilityRole="image"
      accessibilityLabel={accessibilityLabel}
      style={[
        styles.wrapper,
        dimension,
        {
          backgroundColor: colors.border + '55',
          borderWidth: 1.5,
          borderColor: colors.primary + '80', // Mild primary color border
        },
        style,
      ]}
    >
      {showImage ? (
        <Image
          source={{ uri: src! }}
          style={StyleSheet.absoluteFill}
          resizeMode="cover"
        />
      ) : (
        <View className="flex-1 items-center justify-center">
          <User size={iconSize} color={colors.text} />
        </View>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  wrapper: {
    overflow: 'hidden',
  },
});

export default UserProfilePicture;
