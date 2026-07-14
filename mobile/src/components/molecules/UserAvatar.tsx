import React, { useEffect, useState } from 'react';

import { User } from 'lucide-react-native';
import { View, Image, StyleSheet, StyleProp, ViewStyle } from 'react-native';

import { useTheme } from '../../app/hooks/useTheme';

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
    const [failed, setFailed] = useState(false);
    const trimmed = uri?.trim() ?? '';
    const showImage = trimmed.length > 0 && !failed;

    useEffect(() => {
        setFailed(false);
    }, [trimmed]);

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
            ]}>
            {showImage ? (
                <Image
                    source={{ uri: trimmed }}
                    style={StyleSheet.absoluteFill}
                    resizeMode="cover"
                    onError={() => setFailed(true)}
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
