import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Bell, Database, RefreshCw, Info, ShieldCheck } from 'lucide-react';
import { MainTemplate } from '../../components/templates';
import { Card } from '../../components/atoms/Card';
import { useSyncStore } from '../../stores/syncStore';
import { useTheme } from '../../hooks/useTheme';
import { Toaster } from '../../utils/toast';

export const SettingsScreen: React.FC = () => {
  const { t } = useTranslation();
  const { colors } = useTheme();

  const [pushEnabled, setPushEnabled] = useState(false);
  const [backgroundSync, setBackgroundSync] = useState(true);
  const [isSyncing, setIsSyncing] = useState(false);

  const processQueue = useSyncStore((state) => state.processQueue);

  const handleTogglePush = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const checked = e.target.checked;
    if (checked) {
      if ('Notification' in window) {
        const perm = await Notification.requestPermission();
        if (perm === 'granted') {
          setPushEnabled(true);
          Toaster.success('Push notification alerts enabled on this browser.');
        } else {
          setPushEnabled(false);
          Toaster.warning('Notification permission was blocked in browser settings.');
        }
      } else {
        Toaster.info('Web Push notifications not supported by this browser.');
      }
    } else {
      setPushEnabled(false);
    }
  };

  const handleManualSync = async () => {
    setIsSyncing(true);
    await processQueue();
    setTimeout(() => {
      setIsSyncing(false);
      Toaster.success('Local database and offline mutations synchronized.');
    }, 1200);
  };

  return (
    <MainTemplate title={t('settings_title', 'Application Settings')} showBack>
      <div className="p-4 space-y-4">
        {/* Notifications Group */}
        <div>
          <h3
            className="text-xs font-bold uppercase tracking-wider mb-2"
            style={{ color: colors.muted }}
          >
            Notification Alerts
          </h3>
          <Card className="p-4 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-gray-100 dark:bg-zinc-800 rounded-none text-zinc-700 dark:text-zinc-300">
                <Bell size={18} />
              </div>
              <div>
                <p className="text-xs font-bold" style={{ color: colors.text }}>
                  Browser Push Notifications
                </p>
                <p className="text-[11px]" style={{ color: colors.muted }}>
                  Duty reminders and supervisor approval alerts
                </p>
              </div>
            </div>
            <input
              type="checkbox"
              checked={pushEnabled}
              onChange={handleTogglePush}
              className="w-4 h-4 accent-primary cursor-pointer"
            />
          </Card>
        </div>

        {/* Offline & Sync Group */}
        <div>
          <h3
            className="text-xs font-bold uppercase tracking-wider mb-2"
            style={{ color: colors.muted }}
          >
            Offline Synchronization
          </h3>
          <div className="space-y-2">
            <Card className="p-4 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-gray-100 dark:bg-zinc-800 rounded-none text-zinc-700 dark:text-zinc-300">
                  <Database size={18} />
                </div>
                <div>
                  <p className="text-xs font-bold" style={{ color: colors.text }}>
                    Automatic Background Sync
                  </p>
                  <p className="text-[11px]" style={{ color: colors.muted }}>
                    Auto-drain queued requests when connection is detected
                  </p>
                </div>
              </div>
              <input
                type="checkbox"
                checked={backgroundSync}
                onChange={(e) => setBackgroundSync(e.target.checked)}
                className="w-4 h-4 accent-primary cursor-pointer"
              />
            </Card>

            <Card
              onClick={handleManualSync}
              className="p-4 flex items-center justify-between cursor-pointer hover:opacity-90 transition-opacity"
            >
              <div className="flex items-center gap-3">
                <div className="p-2 bg-gray-100 dark:bg-zinc-800 rounded-none text-zinc-700 dark:text-zinc-300">
                  <RefreshCw size={18} className={isSyncing ? 'animate-spin' : ''} />
                </div>
                <div>
                  <p className="text-xs font-bold" style={{ color: colors.text }}>
                    Force Sync Now
                  </p>
                  <p className="text-[11px]" style={{ color: colors.muted }}>
                    Flush pending mutations and refresh caches
                  </p>
                </div>
              </div>
              <span className="text-xs font-bold text-blue-600 dark:text-blue-400">Sync</span>
            </Card>
          </div>
        </div>

        {/* System Information */}
        <div>
          <h3
            className="text-xs font-bold uppercase tracking-wider mb-2"
            style={{ color: colors.muted }}
          >
            System Information
          </h3>
          <Card className="p-4 space-y-2 text-xs">
            <div className="flex justify-between py-1 border-b border-gray-100 dark:border-zinc-800">
              <span style={{ color: colors.muted }}>App Version</span>
              <span className="font-bold" style={{ color: colors.text }}>v1.0.0-PWA (Progressive Web App)</span>
            </div>
            <div className="flex justify-between py-1 border-b border-gray-100 dark:border-zinc-800">
              <span style={{ color: colors.muted }}>Architecture</span>
              <span className="font-bold" style={{ color: colors.text }}>Service Worker + IndexedDB + React 19</span>
            </div>
            <div className="flex justify-between py-1 border-b border-gray-100 dark:border-zinc-800">
              <span style={{ color: colors.muted }}>Security</span>
              <span className="font-bold text-emerald-600 dark:text-emerald-400 flex items-center gap-1">
                <ShieldCheck size={14} /> HTTPS & Secure Storage
              </span>
            </div>
            <div className="flex justify-between py-1">
              <span style={{ color: colors.muted }}>Ministry Authority</span>
              <span className="font-bold" style={{ color: colors.text }}>Ministry of Health, Uganda</span>
            </div>
          </Card>
        </div>
      </div>
    </MainTemplate>
  );
};
export default SettingsScreen;
