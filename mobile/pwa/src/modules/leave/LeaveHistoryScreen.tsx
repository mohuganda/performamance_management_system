import React, { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { Calendar, Loader2 } from 'lucide-react';
import { MainTemplate } from '../../components/templates';
import { Card } from '../../components/atoms/Card';
import { Badge } from '../../components/atoms/Badge';
import { useTheme } from '../../hooks/useTheme';
import { leaveService } from '../../api/leave/service';
import { LeaveRequest, LeaveType } from '../../api/leave/types';
import { formatDate } from '../../utils/date';
import { parseISODate } from '../../utils/leavePolicy';

export const LeaveHistoryScreen: React.FC = () => {
  const { t } = useTranslation();
  const { colors } = useTheme();

  const [requests, setRequests] = useState<LeaveRequest[]>([]);
  const [leaveTypes, setLeaveTypes] = useState<LeaveType[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    setIsLoading(true);
    // Instant offline cache load
    const cachedReqs = localStorage.getItem('moh-pms-leave-requests');
    const cachedTypes = localStorage.getItem('moh-pms-leave-types');
    if (cachedReqs) {
      try {
        setRequests(JSON.parse(cachedReqs));
      } catch {}
    }
    if (cachedTypes) {
      try {
        setLeaveTypes(JSON.parse(cachedTypes));
      } catch {}
    }

    // Remote API fetch using normalized leaveService
    Promise.all([
      leaveService.listRequests(),
      leaveService.listTypes(),
    ])
      .then(([reqRes, typeRes]) => {
        setRequests(reqRes);
        localStorage.setItem('moh-pms-leave-requests', JSON.stringify(reqRes));
        if (typeRes && typeRes.length > 0) {
          setLeaveTypes(typeRes);
          localStorage.setItem('moh-pms-leave-types', JSON.stringify(typeRes));
        }
      })
      .catch((err) => {
        console.warn('Failed to load leave history:', err);
      })
      .finally(() => setIsLoading(false));
  }, []);

  const typeMap = React.useMemo(() => {
    const map = new Map<number, string>();
    leaveTypes.forEach((tp) => {
      map.set(tp.id, tp.name);
    });
    return map;
  }, [leaveTypes]);

  const renderStatusBadge = (status: string) => {
    switch (status) {
      case 'draft':
        return <Badge label={t('leave_status_draft', 'Draft')} variant="gray" />;
      case 'pending_sync':
        return <Badge label={t('leave_status_pending_sync', 'Pending Sync')} variant="info" />;
      case 'sync_failed':
        return <Badge label={t('leave_status_sync_failed', 'Sync Failed')} variant="error" />;
      case 'pending':
        return <Badge label={t('leave_status_pending', 'Pending Approval')} variant="warning" />;
      case 'approved':
        return <Badge label={t('leave_status_approved', 'Approved')} variant="success" />;
      case 'rejected':
        return <Badge label={t('leave_status_rejected', 'Rejected')} variant="error" />;
      default:
        return <Badge label={status} variant="gray" />;
    }
  };

  return (
    <MainTemplate title={t('leave_history_title', 'Leave History')} showBack>
      <div className="p-4 space-y-3">
        {isLoading && requests.length === 0 ? (
          <div className="flex justify-center py-12">
            <Loader2 className="animate-spin" size={24} style={{ color: colors.primary }} />
          </div>
        ) : requests.length === 0 ? (
          <div className="text-center py-16">
            <Calendar size={48} className="mx-auto mb-3" style={{ color: colors.muted }} />
            <h4 className="text-base font-bold" style={{ color: colors.text }}>
              {t('leave_history_empty_title', 'No Leave History')}
            </h4>
            <p className="text-xs mt-1" style={{ color: colors.muted }}>
              {t('leave_history_empty', 'You have not submitted any leave applications yet.')}
            </p>
          </div>
        ) : (
          requests.map((item) => {
            const typeName = typeMap.get(item.leave_type_id) || 'Leave Request';
            const displayStart = item.start_date ? formatDate(item.start_date) : '';
            const displayEnd = item.end_date ? formatDate(item.end_date) : '';

            let duration = item.days_requested;
            if (!duration && item.start_date && item.end_date) {
              const start = parseISODate(item.start_date);
              const end = parseISODate(item.end_date);
              if (end >= start) {
                const diffTime = Math.abs(end.getTime() - start.getTime());
                duration = Math.ceil(diffTime / (1000 * 60 * 60 * 24)) + 1;
              }
            }

            return (
              <Card key={item.id} className="p-4 space-y-3">
                <div className="flex justify-between items-start">
                  <div className="flex-1 mr-2">
                    <h4 className="text-base font-bold mb-1" style={{ color: colors.text }}>
                      {typeName}
                    </h4>
                    <p className="text-sm" style={{ color: colors.muted }}>
                      {displayStart} - {displayEnd}
                    </p>
                  </div>
                  <div className="flex flex-col items-end">
                    {renderStatusBadge(item.status)}
                    {duration !== undefined && (
                      <span className="text-xs mt-1 font-medium" style={{ color: colors.muted }}>
                        {duration} {duration === 1 ? t('common_day', 'Day') : t('common_days', 'Days')}
                      </span>
                    )}
                  </div>
                </div>

                {item.reason && (
                  <p className="text-xs italic text-gray-500 pt-2 border-t border-gray-100 dark:border-zinc-800">
                    "{item.reason}"
                  </p>
                )}
              </Card>
            );
          })
        )}
      </div>
    </MainTemplate>
  );
};
export default LeaveHistoryScreen;
