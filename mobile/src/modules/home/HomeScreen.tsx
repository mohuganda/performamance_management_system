import React, { useMemo } from 'react';
import { View, Text, TouchableOpacity, ScrollView } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { SvgXml } from 'react-native-svg';
import { useTranslation } from 'react-i18next';
import { useAuthStore } from '../../stores/authStore';
import { useTheme } from '../../app/hooks/useTheme';
import { LayoutTemplate } from '../../components/templates/LayoutTemplate';
import { Clock, Calendar, MapPin, CheckSquare, Activity, FileText } from 'lucide-react-native';
import { HomeHeader } from '../../components/organisms/home/HomeHeader';
import { ActionCard } from '../../components/organisms/home/ActionCard';
import { StatCard } from '../../components/organisms/common/StatCard';
import { AnnouncementBanner } from '../../components/organisms/home/AnnouncementBanner';
import { AttendanceHistory } from '../../components/organisms/attendance/AttendanceHistory';
import { useApprovalsInboxSync } from '../../app/hooks/useApprovals';
import { useAttendanceListSync } from '../../app/hooks/useAttendance';

export function HomeScreen() {
  const { t } = useTranslation();
  const navigation = useNavigation<any>();
  const { user, roles, hasPermission } = useAuthStore();
  const { colors } = useTheme();

  const isStaff = roles.includes('staff') || user?.Role === 'staff';
  const { data: clocks, isLoading: isLoadingClocks } = useAttendanceListSync();

  const sortedClocks = useMemo(() => {
    if (!clocks) return [];
    return [...clocks]
      .filter((c) => !c.out_of_station_request_id)
      .sort((a, b) => {
        const timeA = new Date(a.clocked_at || a.created_at || 0).getTime();
        const timeB = new Date(b.clocked_at || b.created_at || 0).getTime();
        return timeB - timeA;
      });
  }, [clocks]);

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
          <ActionCard
            title={t('home_action_leave_history')}
            subtitle={t('home_action_leave_history_sub')}
            icon={<FileText size={20} color="#8B5CF6" />}
            iconBgClass="bg-purple-50 dark:bg-purple-950/30"
            onPress={() => navigation.navigate('LeaveHistory')}
          />
        </View>

        {/* Announcement Banner */}
        <AnnouncementBanner />

        {/* Recent Attendance for Staff */}
        {isStaff && (
          <View className="mt-6">
            <AttendanceHistory
              title={t('attendance_recent_title')}
              isLoading={isLoadingClocks && sortedClocks.length === 0}
              sortedClocks={sortedClocks}
              limit={5}
              onPressItem={(log) => navigation.navigate('AttendanceDetails', { log })}
              onViewAll={() => navigation.navigate('Attendance')}
            />
          </View>
        )}

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
