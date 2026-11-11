import React, { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { Check, X, Clock, Calendar, MapPin, Activity, RefreshCw } from 'lucide-react';
import { MainTemplate } from '../../components/templates';
import { Card } from '../../components/atoms/Card';
import { Badge } from '../../components/atoms/Badge';
import { Button } from '../../components/atoms/Button';
import { Input } from '../../components/atoms/Input';
import { useTheme } from '../../hooks/useTheme';
import { Toaster } from '../../utils/toast';
import apiClient, { getApiErrorMessage } from '../../api/client';
import { ApprovalInboxItem, ApproveLeavePayload } from '../../api/approvals/types';
import { formatDate } from '../../utils/date';

type FilterTab = 'all' | 'leave' | 'oos' | 'performance';

function getModuleStyles(module: string) {
  switch (module?.toLowerCase()) {
    case 'leave':
      return { bg: 'bg-sky-50 dark:bg-sky-950/30', text: 'text-sky-700 dark:text-sky-400', label: 'Leave' };
    case 'oos':
    case 'travel':
      return { bg: 'bg-purple-50 dark:bg-purple-950/30', text: 'text-purple-700 dark:text-purple-400', label: 'Travel / OOS' };
    case 'performance':
    case 'ppa':
      return { bg: 'bg-amber-50 dark:bg-amber-950/30', text: 'text-amber-700 dark:text-amber-400', label: 'Appraisal' };
    default:
      return { bg: 'bg-gray-100 dark:bg-zinc-800', text: 'text-gray-700 dark:text-zinc-300', label: module };
  }
}

export const ApprovalsScreen: React.FC = () => {
  const { t } = useTranslation();
  const { colors } = useTheme();

  const [tasks, setTasks] = useState<ApprovalInboxItem[]>([]);
  const [filter, setFilter] = useState<FilterTab>('all');
  const [isLoading, setIsLoading] = useState(false);

  // Action Modal State
  const [selectedTask, setSelectedTask] = useState<ApprovalInboxItem | null>(null);
  const [actionType, setActionType] = useState<'approved' | 'rejected' | null>(null);
  const [remarks, setRemarks] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const fetchTasks = async () => {
    setIsLoading(true);
    try {
      const res = await apiClient.get<ApprovalInboxItem[]>('/approvals/tasks');
      setTasks(res.data);
    } catch (err) {
      console.warn('Failed to fetch approval tasks:', err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchTasks();
  }, []);

  const filteredTasks = tasks.filter((item) => {
    if (filter === 'all') return true;
    if (filter === 'leave') return item.module?.toLowerCase().includes('leave');
    if (filter === 'oos') return item.module?.toLowerCase().includes('oos') || item.module?.toLowerCase().includes('station');
    return item.module?.toLowerCase().includes('performance') || item.module?.toLowerCase().includes('ppa');
  });

  const handleOpenAction = (task: ApprovalInboxItem, type: 'approved' | 'rejected') => {
    setSelectedTask(task);
    setActionType(type);
    setRemarks('');
  };

  const handleExecuteAction = async () => {
    if (!selectedTask || !actionType) return;
    setIsSubmitting(true);

    const payload: ApproveLeavePayload = {
      approve: actionType === 'approved',
      comments: remarks.trim() || undefined,
    };

    try {
      await apiClient.post(`/approvals/tasks/${selectedTask.id}/action`, payload);
      Toaster.success(t('approvals_action_success', `Request ${actionType === 'approved' ? 'Approved' : 'Rejected'} successfully!`));
      setSelectedTask(null);
      setActionType(null);
      fetchTasks();
    } catch (err) {
      Toaster.error(getApiErrorMessage(err, 'Failed to process approval action.'));
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <MainTemplate title={t('approvals_title', 'Approvals Inbox')}>
      {/* Filter Tabs Bar */}
      <div
        className="flex border-b justify-around items-center sticky top-14 z-30 transition-colors"
        style={{
          backgroundColor: colors.surface,
          borderBottomColor: colors.border,
        }}
      >
        {(['all', 'leave', 'oos', 'performance'] as const).map((tab) => {
          const isActive = filter === tab;
          const label =
            tab === 'all'
              ? 'All'
              : tab === 'leave'
              ? 'Leave'
              : tab === 'oos'
              ? 'Out of Station'
              : 'Appraisals';

          return (
            <button
              key={tab}
              onClick={() => setFilter(tab)}
              className="flex-1 py-4 text-center border-b-2 text-xs font-bold transition-colors"
              style={{
                borderBottomColor: isActive ? colors.primary : 'transparent',
                color: isActive ? colors.primary : colors.muted,
              }}
            >
              {label}
            </button>
          );
        })}
      </div>

      <div className="p-4 space-y-3">
        <div className="flex items-center justify-between">
          <span
            className="text-xs font-bold uppercase tracking-wider"
            style={{ color: colors.muted }}
          >
            Pending Requests ({filteredTasks.length})
          </span>
          <button
            onClick={fetchTasks}
            disabled={isLoading}
            className="text-xs flex items-center gap-1 hover:opacity-80 transition-opacity"
            style={{ color: colors.muted }}
          >
            <RefreshCw size={12} className={isLoading ? 'animate-spin' : ''} />
            Refresh
          </button>
        </div>

        {filteredTasks.length === 0 ? (
          <Card className="p-8 text-center text-xs" style={{ color: colors.muted }}>
            No pending approval requests in this category.
          </Card>
        ) : (
          filteredTasks.map((task) => {
            const badgeStyle = getModuleStyles(task.module);
            return (
              <Card key={task.id} className="p-4 space-y-3">
                <div className="flex items-center justify-between">
                  <span
                    className={`px-2 py-0.5 rounded-none text-[10px] font-bold uppercase tracking-wider ${badgeStyle.bg} ${badgeStyle.text}`}
                  >
                    {badgeStyle.label}
                  </span>
                  {task.waiting_days != null && (
                    <div
                      className="flex items-center gap-1 text-[11px]"
                      style={{ color: colors.muted }}
                    >
                      <Clock size={12} />
                      <span>{task.waiting_days <= 0 ? 'Today' : `${task.waiting_days}d ago`}</span>
                    </div>
                  )}
                </div>

                <div>
                  <h4 className="text-sm font-bold leading-tight" style={{ color: colors.text }}>
                    {task.staff_name || 'Staff Member'}
                  </h4>
                  <p className="text-xs mt-0.5 leading-snug" style={{ color: colors.text }}>
                    {task.title}
                  </p>
                  {task.subtitle && (
                    <p className="text-[11px] mt-1" style={{ color: colors.muted }}>
                      {task.subtitle}
                    </p>
                  )}
                </div>

                <div className="flex items-center gap-2 pt-2 border-t border-gray-100 dark:border-zinc-800">
                  <button
                    onClick={() => handleOpenAction(task, 'rejected')}
                    className="flex-1 py-2 px-3 border rounded-none text-xs font-bold text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-950/20 flex items-center justify-center gap-1.5 transition-colors"
                    style={{ borderColor: colors.border }}
                  >
                    <X size={14} />
                    <span>Reject</span>
                  </button>
                  <button
                    onClick={() => handleOpenAction(task, 'approved')}
                    className="flex-1 py-2 px-3 rounded-none text-xs font-bold text-white bg-[#15803D] hover:bg-emerald-700 flex items-center justify-center gap-1.5 transition-colors"
                  >
                    <Check size={14} />
                    <span>Approve</span>
                  </button>
                </div>
              </Card>
            );
          })
        )}
      </div>

      {/* Action Dialog */}
      {selectedTask && actionType && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-fade-in">
          <div
            className="w-full max-w-sm rounded-none border shadow-2xl p-6 space-y-4"
            style={{
              backgroundColor: colors.surface,
              borderColor: colors.border,
            }}
          >
            <div>
              <h3 className="text-base font-bold" style={{ color: colors.text }}>
                {actionType === 'approved' ? 'Approve Request' : 'Reject Request'}
              </h3>
              <p className="text-xs mt-1" style={{ color: colors.muted }}>
                {selectedTask.staff_name}: {selectedTask.title}
              </p>
            </div>

            <div>
              <Input
                label="Supervisor Remarks (Optional)"
                multiline
                rows={3}
                placeholder="Add comments or review conditions..."
                value={remarks}
                onChange={(e) => setRemarks(e.target.value)}
              />
            </div>

            <div className="flex items-center gap-2 pt-2">
              <button
                type="button"
                onClick={() => {
                  setSelectedTask(null);
                  setActionType(null);
                }}
                className="flex-1 py-3 border text-xs font-bold rounded-none"
                style={{
                  borderColor: colors.border,
                  color: colors.text,
                }}
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={isSubmitting}
                onClick={handleExecuteAction}
                className="flex-1 py-3 text-xs font-bold rounded-none text-white transition-opacity"
                style={{
                  backgroundColor: actionType === 'approved' ? colors.success : colors.error,
                  opacity: isSubmitting ? 0.6 : 1,
                }}
              >
                {isSubmitting ? 'Processing...' : actionType === 'approved' ? 'Confirm Approval' : 'Confirm Rejection'}
              </button>
            </div>
          </div>
        </div>
      )}
    </MainTemplate>
  );
};
export default ApprovalsScreen;
