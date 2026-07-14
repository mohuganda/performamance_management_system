import React from 'react';
import { View, Text, TouchableOpacity, ScrollView } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { SvgXml } from 'react-native-svg';
import { useAuthStore } from '../../stores/authStore';
import { useTheme } from '../../app/hooks/useTheme';
import { LayoutTemplate } from '../../components/templates/LayoutTemplate';
import { UserProfilePicture } from '../../components/molecules/UserAvatar';
import { NotificationIcon } from '../../components/molecules/NotificationIcon';
import { LOGO_SVG } from '../../assets/logoSvg';
import { Card } from '../../components/atoms/Card';
import { Badge } from '../../components/atoms/Badge';
import { Clock, Calendar, CheckSquare } from 'lucide-react-native';

export function HomeScreen() {
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
              MoH UGANDA
            </Text>
            <Text className="text-[10px] opacity-75 font-semibold" style={{ color: colors.muted }}>
              PMS - iHRIS
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
            Dashboard Overview
          </Text>
          <Text className="text-2xl font-black mt-1" style={{ color: colors.text }}>
            Hello, {user?.name || 'Officer'}
          </Text>
          <Text className="text-sm mt-1" style={{ color: colors.muted }}>
            Ministry of Health Uganda • {user?.role || 'Staff Member'}
          </Text>
        </View>

        {/* PMS Intro Card */}
        <Card className="p-6 mb-6">
          <View className="flex-row justify-between items-center mb-3">
            <Badge label="System Active" variant="success" />
            <Text className="text-xs font-medium" style={{ color: colors.muted }}>
              v1.0.0
            </Text>
          </View>
          <Text className="text-lg font-bold mb-1" style={{ color: colors.text }}>
            Performance Management System
          </Text>
          <Text className="text-sm leading-relaxed" style={{ color: colors.muted }}>
            Track attendance, manage leaves, request out of station duty deployments, and complete supervisors reviews seamlessly.
          </Text>
        </Card>

        {/* Quick Insights grid */}
        <Text className="text-base font-bold mb-3" style={{ color: colors.text }}>
          Quick Action Shortcuts
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
              Duty Check In
            </Text>
            <Text className="text-[10px] mt-0.5 text-center" style={{ color: colors.muted }}>
              Clock attendance
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
              Request Leave
            </Text>
            <Text className="text-[10px] mt-0.5 text-center" style={{ color: colors.muted }}>
              Leave planner
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
              Announcement
            </Text>
          </View>
          <Text className="text-sm font-semibold mt-2" style={{ color: colors.text }}>
            Mid-term appraisal cycle closing soon
          </Text>
          <Text className="text-xs mt-1" style={{ color: colors.muted }}>
            Please ensure all your monthly targets and updates are fully synced.
          </Text>
        </View>
      </ScrollView>
    </LayoutTemplate>
  );
}
