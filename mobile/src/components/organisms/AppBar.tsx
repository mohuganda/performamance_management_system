import React from 'react';

import { useNavigation } from '@react-navigation/native';
import { ArrowLeft } from 'lucide-react-native';
import { View, TouchableOpacity, Text } from 'react-native';

import { useTheme } from '../../app/hooks/useTheme';

interface AppBarProps {
    title: string;
    showBack?: boolean;
    rightElement?: React.ReactNode;
}

export const AppBar = ({ title, showBack = false, rightElement }: AppBarProps) => {
    const navigation = useNavigation();
    const { colors } = useTheme();

    return (
        <View
            className="flex-row items-center justify-between px-4 py-3 border-b border-border bg-background"
            style={{ backgroundColor: colors.surface, borderBottomColor: colors.border }}>
            <View className="flex-row items-center flex-1">
                {showBack && (
                    <TouchableOpacity onPress={() => navigation.goBack()} className="mr-3 p-1">
                        <ArrowLeft size={22} color={colors.text} />
                    </TouchableOpacity>
                )}
                <Text className="font-bold text-xl" style={{ color: colors.text }}>{title}</Text>
            </View>
            {rightElement && <View>{rightElement}</View>}
        </View>
    );
};
