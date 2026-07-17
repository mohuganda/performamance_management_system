import React from 'react';
import { View, Text, TouchableOpacity, ScrollView } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { SvgXml } from 'react-native-svg';
import { useTranslation } from 'react-i18next';
import { useAuthStore } from '../../stores/authStore';
import { useTheme } from '../../app/hooks/useTheme';
import { LayoutTemplate } from '../../components/templates/LayoutTemplate';
import { Clock, Calendar, MapPin, CheckSquare, Activity } from 'lucide-react-native';
import { HomeHeader } from '../../components/organisms/home/HomeHeader';
import { ActionCard } from '../../components/organisms/home/ActionCard';
import { StatCard } from '../../components/organisms/common/StatCard';
import { AnnouncementBanner } from '../../components/organisms/home/AnnouncementBanner';
import { useApprovalsInboxSync } from '../../app/hooks/useApprovals';

export function HomeScreen() {
  const { t } = useTranslation();
  const navigation = useNavigation<any>();
  const { user, hasPermission } = useAuthStore();
  const { colors } = useTheme();

  const showApprovals = hasPermission([
    'leave.requests.approve',
    'oos.requests.approve',
    'dashboard.supervisor',
    'dashboard.department_head',
    'dashboard.hr',
  ]);

  const { data: inboxData } = useApprovalsInboxSync();
  const stats = inboxData?.stats;

  return (
    <LayoutTemplate>
      <HomeHeader />

      {/* Main Content Container */}
      <ScrollView
        className="flex-1"
        contentContainerStyle={{ padding: 16, paddingBottom: 40 }}
      >

        {/* Quick actions grid */}
        <Text className="text-base font-bold mb-3" style={{ color: colors.text }}>
          {t('home_quick_actions')}
        </Text>
        <View className="flex-row flex-wrap justify-between mb-6">
          <ActionCard
            title={t('home_action_check_in')}
            subtitle={t('home_action_check_in_sub')}
            icon={<Clock size={20} color="#10B981" />}
            iconBgClass="bg-emerald-50 dark:bg-emerald-950/30"
            onPress={() => navigation.navigate('Attendance')}
          />
          <ActionCard
            title={t('home_action_leave')}
            subtitle={t('home_action_leave_sub')}
            icon={<Calendar size={20} color="#F59E0B" />}
            iconBgClass="bg-amber-50 dark:bg-amber-950/30"
            onPress={() => navigation.navigate('LeaveRequest')}
          />
          <ActionCard
            title={t('home_action_oos')}
            subtitle={t('home_action_oos_sub')}
            icon={<MapPin size={20} color="#3B82F6" />}
            iconBgClass="bg-blue-50 dark:bg-blue-950/30"
            onPress={() => navigation.navigate('OutOfStation', { initialTab: 'apply' })}
          />
        </View>

        {/* Announcement Banner */}
        <AnnouncementBanner />

        {/* Approvals Summary */}
        {showApprovals && stats ? (
          <View className="mt-6 mb-4">
            <Text className="text-base font-bold mb-3" style={{ color: colors.text }}>
              {t('approvals_pending')}
            </Text>

            <View className="flex-row flex-wrap justify-between">
              <StatCard
                title={t('approvals_all')}
                value={stats.pending_total}
                subtitle={t('approvals_waiting')}
                icon={<CheckSquare size={16} color="#F59E0B" />}
                color="#F59E0B"
                onPress={() => navigation.navigate('Approvals')}
              />
              <StatCard
                title={t('approvals_leave')}
                value={stats.leave_pending}
                subtitle={t('approvals_waiting')}
                icon={<Calendar size={16} color="#3B82F6" />}
                color="#3B82F6"
                onPress={() => navigation.navigate('Approvals')}
              />
              <StatCard
                title={t('approvals_oos')}
                value={stats.oos_pending}
                subtitle={t('approvals_waiting')}
                icon={<MapPin size={16} color="#10B981" />}
                color="#10B981"
                onPress={() => navigation.navigate('Approvals')}
              />
              <StatCard
                title={t('approvals_performance')}
                value={stats.performance_pending + stats.ppa_pending}
                subtitle={t('approvals_waiting')}
                icon={<Activity size={16} color="#8B5CF6" />}
                color="#8B5CF6"
                onPress={() => navigation.navigate('Approvals')}
              />
            </View>
          </View>
        ) : null}
      </ScrollView>
    </LayoutTemplate>
  );
}
