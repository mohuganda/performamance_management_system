import React from 'react';
import { useTranslation } from 'react-i18next';
import { AlertTriangle, Trash2, CheckCircle2 } from 'lucide-react';
import { MainTemplate } from '../../components/templates';
import { Card } from '../../components/atoms/Card';
import { useSyncStore } from '../../stores/syncStore';
import { useTheme } from '../../hooks/useTheme';
import { showAlert } from '../../stores/alertStore';
import { formatDate } from '../../utils/date';

export const SyncIssuesScreen: React.FC = () => {
  const { t } = useTranslation();
  const { colors } = useTheme();
  const failedQueue = useSyncStore((state) => state.failedQueue);
  const discardFailedMutation = useSyncStore((state) => state.discardFailedMutation);

  const handleDiscard = (id: string) => {
    showAlert({
      type: 'warning',
      title: 'Discard Request',
      message: 'Are you sure you want to permanently discard this failed request?',
      cancelText: 'Cancel',
      confirmText: 'Discard',
      onConfirm: () => {
        discardFailedMutation(id);
      },
    });
  };

  return (
    <MainTemplate title={t('sync_issues_title', 'Sync Issues')} showBack>
      <div className="p-4 space-y-4">
        <div>
          <h3
            className="text-xs font-bold uppercase tracking-wider mb-1"
            style={{ color: colors.muted }}
          >
            Failed Offline Requests ({failedQueue.length})
          </h3>
          <p className="text-xs" style={{ color: colors.muted }}>
            These mutations encountered non-retryable server validation errors while syncing.
          </p>
        </div>

        {failedQueue.length === 0 ? (
          <Card className="p-8 text-center flex flex-col items-center">
            <CheckCircle2 size={36} className="text-emerald-500 mb-2" />
            <h4 className="text-sm font-bold" style={{ color: colors.text }}>
              All Requests Synced!
            </h4>
            <p className="text-xs mt-1" style={{ color: colors.muted }}>
              There are no pending or rejected offline mutations. Everything is up to date.
            </p>
          </Card>
        ) : (
          <div className="space-y-3">
            {failedQueue.map((item) => (
              <Card
                key={item.id}
                className="p-4 space-y-3"
                style={{
                  borderLeftWidth: '4px',
                  borderLeftColor: colors.error,
                }}
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <AlertTriangle size={16} color={colors.error} />
                    <span
                      className="text-xs font-bold uppercase tracking-wide"
                      style={{ color: colors.text }}
                    >
                      {item.type.replace('_', ' ')}
                    </span>
                  </div>
                  <span className="text-[11px]" style={{ color: colors.muted }}>
                    {formatDate(item.failedAt)}
                  </span>
                </div>

                <div className="bg-red-50 dark:bg-red-950/40 p-2.5 border border-red-200 dark:border-red-900 text-xs text-red-600 dark:text-red-400">
                  {item.error || 'Server validation rejected this request.'}
                </div>

                <div className="flex justify-end pt-1">
                  <button
                    onClick={() => handleDiscard(item.id)}
                    className="px-3 py-1.5 border border-red-300 dark:border-red-800 text-red-600 dark:text-red-400 text-xs font-bold flex items-center gap-1.5 hover:bg-red-50 dark:hover:bg-red-950/30"
                  >
                    <Trash2 size={13} />
                    Discard Request
                  </button>
                </div>
              </Card>
            ))}
          </div>
        )}
      </div>
    </MainTemplate>
  );
};
export default SyncIssuesScreen;
