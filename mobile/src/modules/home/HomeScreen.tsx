import React from 'react';
import { View, Text, TouchableOpacity, ScrollView } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { SvgXml } from 'react-native-svg';
import { useTranslation } from 'react-i18next';
import { useAuthStore } from '../../stores/authStore';
import { useTheme } from '../../app/hooks/useTheme';
import { LayoutTemplate } from '../../components/templates/LayoutTemplate';
import { UserProfilePicture } from '../../components/molecules/UserAvatar';
import { NotificationIcon } from '../../components/molecules/NotificationIcon';
import { LOGO_SVG } from '../../assets/logoSvg';
import { Card } from '../../components/atoms/Card';
import { Badge } from '../../components/atoms/Badge';
import { Clock, Calendar } from 'lucide-react-native';

export function HomeScreen() {
  const { t } = useTranslation();
  const navigation = useNavigation<any>();
  const { user } = useAuthStore();
  const { colors } = useTheme();

  return (
    <LayoutTemplate>
      {/* Custom Top Header */}
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
            badgeCount={2}
          />
          <TouchableOpacity
            onPress={() => navigation.navigate('Profile')}
            activeOpacity={0.8}
          >
            <UserProfilePicture uri={user?.profile_photo} size={36} />
          </TouchableOpacity>
        </View>
      </View>

      {/* Main Content Container */}
      <ScrollView
        className="flex-1"
        contentContainerStyle={{ padding: 16, paddingBottom: 40 }}
      >
        {/* Welcome Section */}
        <View className="mb-6">
          <Text className="text-sm font-semibold uppercase tracking-wider" style={{ color: colors.muted }}>
            {t('home_dashboard_overview')}
          </Text>
          <Text className="text-2xl font-black mt-1" style={{ color: colors.text }}>
            {t('home_welcome_user', { name: user?.name || 'Officer' })}
          </Text>
          <Text className="text-sm mt-1" style={{ color: colors.muted }}>
            {t('home_moh_role', { role: user?.role || t('staff') })}
          </Text>
        </View>

        {/* PMS Intro Card */}
        <Card className="p-6 mb-6">
          <View className="flex-row justify-between items-center mb-3">
            <Badge label={t('system_active')} variant="success" />
            <Text className="text-xs font-medium" style={{ color: colors.muted }}>
              v1.0.0
            </Text>
          </View>
          <Text className="text-lg font-bold mb-1" style={{ color: colors.text }}>
            {t('home_pms_title')}
          </Text>
          <Text className="text-sm leading-relaxed" style={{ color: colors.muted }}>
            {t('home_pms_description')}
          </Text>
        </Card>

        {/* Quick Insights grid */}
        <Text className="text-base font-bold mb-3" style={{ color: colors.text }}>
          {t('home_quick_actions')}
        </Text>
        <View className="flex-row flex-wrap justify-between gap-3 mb-6">
          <TouchableOpacity
            className="w-[48%] p-4 rounded-xl items-center border border-border"
            style={{ backgroundColor: colors.surface, borderColor: colors.border }}
            onPress={() => navigation.navigate('Attendance')}
          >
            <View className="w-10 h-10 rounded-full bg-emerald-50 dark:bg-emerald-950/30 items-center justify-center mb-2">
              <Clock size={20} color="#10B981" />
            </View>
            <Text className="text-sm font-bold text-center" style={{ color: colors.text }}>
              {t('home_action_check_in')}
            </Text>
            <Text className="text-[10px] mt-0.5 text-center" style={{ color: colors.muted }}>
              {t('home_action_check_in_sub')}
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            className="w-[48%] p-4 rounded-xl items-center border border-border"
            style={{ backgroundColor: colors.surface, borderColor: colors.border }}
            onPress={() => navigation.navigate('Leave')}
          >
            <View className="w-10 h-10 rounded-full bg-amber-50 dark:bg-amber-950/30 items-center justify-center mb-2">
              <Calendar size={20} color="#F59E0B" />
            </View>
            <Text className="text-sm font-bold text-center" style={{ color: colors.text }}>
              {t('home_action_leave')}
            </Text>
            <Text className="text-[10px] mt-0.5 text-center" style={{ color: colors.muted }}>
              {t('home_action_leave_sub')}
            </Text>
          </TouchableOpacity>
        </View>

        {/* Announcement Banner */}
        <View
          className="p-4 rounded-2xl border"
          style={{
            backgroundColor: colors.surface,
            borderColor: colors.border,
          }}
        >
          <View className="flex-row items-center">
            <View
              className="w-2.5 h-2.5 rounded-full mr-2"
              style={{ backgroundColor: colors.primary }}
            />
            <Text className="text-xs font-bold uppercase tracking-wide" style={{ color: colors.text }}>
              {t('announcement')}
            </Text>
          </View>
          <Text className="text-sm font-semibold mt-2" style={{ color: colors.text }}>
            {t('home_announcement_title')}
          </Text>
          <Text className="text-xs mt-1" style={{ color: colors.muted }}>
            {t('home_announcement_description')}
          </Text>
        </View>
      </ScrollView>
    </LayoutTemplate>
  );
}
