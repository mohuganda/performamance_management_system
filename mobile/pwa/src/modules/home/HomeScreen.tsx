import React, { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { Clock, Calendar, MapPin, CheckSquare, Activity, FileText } from 'lucide-react';
import { useAuthStore } from '../../stores/authStore';
import { useTheme } from '../../hooks/useTheme';
import { LayoutTemplate } from '../../components/templates/LayoutTemplate';
import { HomeHeader } from '../../components/organisms/HomeHeader';
import { ActionCard } from '../../components/organisms/ActionCard';
import { StatCard } from '../../components/organisms/StatCard';
import { AnnouncementBanner } from '../../components/organisms/AnnouncementBanner';
import { AttendanceHistory } from '../../components/organisms/AttendanceHistory';
import { useApprovalsInboxQuery } from '../../hooks/useApprovals';
import { useAttendanceListQuery } from '../../hooks/useAttendance';

export const HomeScreen: React.FC = () => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { user, roles, hasPermission } = useAuthStore();
  const { colors } = useTheme();

  const isStaff = roles.includes('staff') || user?.Role === 'staff';
  const { data: clocks, isLoading: isLoadingClocks } = useAttendanceListQuery();

  const sortedClocks = useMemo(() => {
    if (!clocks) return [];
    return [...clocks]
      .filter((c) => !c.out_of_station_request_id)
      .sort((a, b) => {
        const timeA = new Date(a.clocked_at || (a as any).created_at || 0).getTime();
        const timeB = new Date(b.clocked_at || (b as any).created_at || 0).getTime();
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

  // Offload approvals inbox & stats querying to TanStack Query custom hook
  const { data: inboxData } = useApprovalsInboxQuery(showApprovals);
  const stats = inboxData?.stats || null;

  return (
    <LayoutTemplate>
      <HomeHeader />

      {/* Main Content Container */}
      <div className="p-4 pb-12">
        {/* Quick actions grid */}
        <h2 className="text-base font-bold mb-3" style={{ color: colors.text }}>
          {t('home_quick_actions', 'Quick Actions')}
        </h2>
        <div className="flex flex-wrap justify-between mb-6">
          <ActionCard
            title={t('home_action_check_in', 'Check In / Out')}
            subtitle={t('home_action_check_in_sub', 'Clock attendance with GPS')}
            icon={<Clock size={20} color="#10B981" />}
            iconBgClass="bg-emerald-50 dark:bg-emerald-950/30"
            onClick={() => navigate('/attendance')}
          />
          <ActionCard
            title={t('home_action_leave', 'Leave')}
            subtitle={t('home_action_leave_sub', 'Apply for time off')}
            icon={<Calendar size={20} color="#F59E0B" />}
            iconBgClass="bg-amber-50 dark:bg-amber-950/30"
            onClick={() => navigate('/leave/apply')}
          />
          <ActionCard
            title={t('home_action_oos', 'Out of Station')}
            subtitle={t('home_action_oos_sub', 'Official travel & duties')}
            icon={<MapPin size={20} color="#3B82F6" />}
            iconBgClass="bg-blue-50 dark:bg-blue-950/30"
            onClick={() => navigate('/oos')}
          />
          <ActionCard
            title={t('home_action_leave_history', 'Leave History')}
            subtitle={t('home_action_leave_history_sub', 'View past requests')}
            icon={<FileText size={20} color="#8B5CF6" />}
            iconBgClass="bg-purple-50 dark:bg-purple-950/30"
            onClick={() => navigate('/leave/history')}
          />
        </div>

        {/* Announcement Banner */}
        <AnnouncementBanner />

        {/* Recent Attendance for Staff */}
        {isStaff && (
          <div className="mt-6">
            <AttendanceHistory
              title={t('attendance_recent_title', 'Recent Attendance')}
              isLoading={isLoadingClocks && sortedClocks.length === 0}
              sortedClocks={sortedClocks}
              limit={5}
              onPressItem={(log) =>
                navigate(`/attendance/${log.id || (log as any).entry_id}`, {
                  state: { log },
                })
              }
              onViewAll={() => navigate('/attendance')}
            />
          </div>
        )}

        {/* Approvals Summary */}
        {showApprovals && stats ? (
          <div className="mt-6 mb-4">
            <h2 className="text-base font-bold mb-3" style={{ color: colors.text }}>
              {t('approvals_pending', 'Pending Approvals')}
            </h2>

            <div className="flex flex-wrap justify-between">
              <StatCard
                title={t('approvals_all', 'All Pending')}
                value={stats.pending_total}
                subtitle={t('approvals_waiting', 'waiting review')}
                icon={<CheckSquare size={16} color="#F59E0B" />}
                color="#F59E0B"
                onClick={() => navigate('/approvals')}
              />
              <StatCard
                title={t('approvals_leave', 'Leave Requests')}
                value={stats.leave_pending}
                subtitle={t('approvals_waiting', 'waiting review')}
                icon={<Calendar size={16} color="#3B82F6" />}
                color="#3B82F6"
                onClick={() => navigate('/approvals')}
              />
              <StatCard
                title={t('approvals_oos', 'Out of Station')}
                value={stats.oos_pending}
                subtitle={t('approvals_waiting', 'waiting review')}
                icon={<MapPin size={16} color="#10B981" />}
                color="#10B981"
                onClick={() => navigate('/approvals')}
              />
              <StatCard
                title={t('approvals_performance', 'Performance')}
                value={(stats.performance_pending || 0) + (stats.ppa_pending || 0)}
                subtitle={t('approvals_waiting', 'waiting review')}
                icon={<Activity size={16} color="#8B5CF6" />}
                color="#8B5CF6"
                onClick={() => navigate('/approvals')}
              />
            </div>
          </div>
        ) : null}
      </div>
    </LayoutTemplate>
  );
};
