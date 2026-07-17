import React from 'react';
import { View, Text, TouchableOpacity } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { SvgXml } from 'react-native-svg';
import { useTranslation } from 'react-i18next';
import { useAuthStore } from '../../stores/authStore';
import { useTheme } from '../../app/hooks/useTheme';
import { UserProfilePicture } from '../molecules/UserAvatar';
import { NotificationIcon } from '../molecules/NotificationIcon';
import { useUnreadCountQuery } from '../../app/hooks/useNotifications';
import { LOGO_SVG } from '../../assets/logoSvg';

export function HomeHeader() {
  const { t } = useTranslation();
  const navigation = useNavigation<any>();
  const { user } = useAuthStore();
  const { colors } = useTheme();
  
  const { data: unreadCount } = useUnreadCountQuery();

  return (
    <View
      className="flex-row items-center justify-between px-4 py-3 border-b border-border bg-background"
      style={{
        backgroundColor: colors.surface,
        borderBottomColor: colors.border,
      }}
    >
      {/* Left: Logo */}
      <View className="flex-row items-center">
        <SvgXml xml={LOGO_SVG} width={38} height={38} />
        <View className="ml-2">
          <Text className="text-xs font-bold tracking-wider" style={{ color: colors.text }}>
            {t('moh_uganda')}
          </Text>
          <Text className="text-[10px] opacity-75 font-semibold" style={{ color: colors.muted }}>
            {t('pms_ihris')}
          </Text>
        </View>
      </View>

      {/* Right: Notification bell & Profile Avatar */}
      <View className="flex-row items-center gap-3">
        <NotificationIcon
          onPress={() => navigation.navigate('Notifications')}
          badgeCount={unreadCount ?? 0}
        />
        <TouchableOpacity
          onPress={() => navigation.navigate('Profile')}
          activeOpacity={0.8}
        >
          <UserProfilePicture uri={user?.ProfilePhoto} size={36} />
        </TouchableOpacity>
      </View>
    </View>
  );
}
