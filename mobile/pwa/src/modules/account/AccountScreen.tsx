import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Settings, Palette, LogOut, ChevronRight, Check, X } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { useAuthStore } from '../../stores/authStore';
import { showAlert } from '../../stores/alertStore';
import { useThemeStore, ThemeMode } from '../../stores/themeStore';
import { useTheme } from '../../hooks/useTheme';
import { LayoutTemplate } from '../../components/templates/LayoutTemplate';
import { Badge } from '../../components/atoms/Badge';
import { UserAvatar } from '../../components/atoms/UserAvatar';
import { QuickActionCard } from '../../components/organisms/QuickActionCard';
import { useProfileQuery } from '../../hooks/useProfile';

export const AccountScreen: React.FC = () => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { logout, user } = useAuthStore();
  const { themeMode, setThemeMode } = useThemeStore();
  const { colors } = useTheme();
  const { data: profileData } = useProfileQuery();

  const staffName = profileData?.staff?.name || user?.Name || 'Officer';

  const [themeModalVisible, setThemeModalVisible] = useState(false);

  const handleLogout = () => {
    showAlert({
      type: 'warning',
      title: t('account_sign_out', 'Sign Out'),
      message: t('account_sign_out_confirm', 'Are you sure you want to sign out of your account on this device?'),
      cancelText: t('common_cancel', 'Cancel'),
      confirmText: t('account_sign_out', 'Sign Out'),
      onConfirm: async () => {
        await logout();
        navigate('/login');
      },
    });
  };

  const getThemeModeLabel = (mode: string) => {
    switch (mode) {
      case 'light':
        return t('account_theme_light', 'Light');
      case 'dark':
        return t('account_theme_dark', 'Dark');
      case 'system':
      default:
        return t('account_theme_system', 'System Default');
    }
  };

  const themeOptions: { mode: ThemeMode; label: string; desc: string }[] = [
    { mode: 'light', label: 'Light Theme', desc: 'Standard clean light layout' },
    { mode: 'dark', label: 'Dark Theme', desc: 'Easier on the eyes in low light' },
    { mode: 'system', label: 'System Default', desc: 'Follows operating system settings' },
  ];

  return (
    <LayoutTemplate>
      {/* Banner Section */}
      <button
        onClick={() => navigate('/profile')}
        className="w-full p-6 pb-8 rounded-none border-b text-left transition-colors hover:opacity-95"
        style={{
          backgroundColor: colors.surface,
          borderBottomColor: colors.border,
        }}
      >
        <div className="flex items-center gap-4 mt-2">
          <UserAvatar
            photoUrl={user?.ProfilePhoto}
            name={staffName}
            size="lg"
            className="flex-shrink-0"
          />

          <div className="flex-1 min-w-0">
            <h2 className="text-xl font-bold mb-0.5 truncate" style={{ color: colors.text }}>
              {staffName}
            </h2>
            <p className="text-sm mb-2 truncate" style={{ color: colors.muted }}>
              {user?.Email}
            </p>
            <div>
              <Badge label={user?.Role || t('staff', 'Staff')} variant="info" />
            </div>
          </div>

          <ChevronRight size={20} style={{ color: colors.muted }} className="flex-shrink-0" />
        </div>
      </button>

      {/* Menu Cards */}
      <div className="p-6">
        <h3
          className="text-xs font-bold uppercase tracking-wider mb-4"
          style={{ color: colors.muted }}
        >
          {t('account_settings_preference', 'Account Settings & Preferences')}
        </h3>

        {/* Settings Card */}
        <div className="mb-4">
          <QuickActionCard
            title={t('account_settings', 'Settings')}
            subtitle={t('account_settings_sub', 'Offline sync and system parameters')}
            Icon={Settings}
            iconColor={colors.text}
            iconBgClass="bg-gray-100 dark:bg-zinc-800"
            onClick={() => navigate('/settings')}
          />
        </div>

        {/* Theme Card */}
        <div className="mb-4">
          <QuickActionCard
            title={t('account_theme', 'Interface Theme')}
            subtitle={getThemeModeLabel(themeMode)}
            Icon={Palette}
            iconColor={colors.text}
            iconBgClass="bg-gray-100 dark:bg-zinc-800"
            onClick={() => setThemeModalVisible(true)}
          />
        </div>

        {/* Logout Card */}
        <div className="mb-4">
          <QuickActionCard
            title={t('account_sign_out', 'Sign Out')}
            subtitle={t('account_sign_out_sub', 'Disconnect session from this browser')}
            Icon={LogOut}
            iconColor={colors.error}
            iconBgClass="bg-red-50 dark:bg-red-950/30"
            onClick={handleLogout}
          />
        </div>
      </div>

      {/* Theme Selection Modal */}
      {themeModalVisible && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-fade-in">
          <div
            className="w-full max-w-sm rounded-none border shadow-2xl p-6"
            style={{
              backgroundColor: colors.surface,
              borderColor: colors.border,
            }}
          >
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-base font-bold" style={{ color: colors.text }}>
                Choose Interface Theme
              </h3>
              <button
                onClick={() => setThemeModalVisible(false)}
                className="p-1 hover:bg-gray-100 dark:hover:bg-zinc-800 rounded-full"
              >
                <X size={18} style={{ color: colors.muted }} />
              </button>
            </div>

            <div className="space-y-2">
              {themeOptions.map((opt) => {
                const isSelected = themeMode === opt.mode;
                return (
                  <button
                    key={opt.mode}
                    onClick={() => {
                      setThemeMode(opt.mode);
                      setThemeModalVisible(false);
                    }}
                    className="w-full p-3.5 border rounded-none text-left flex items-center justify-between transition-colors"
                    style={{
                      borderColor: isSelected ? colors.primary : colors.border,
                      backgroundColor: isSelected
                        ? `${colors.primary}10`
                        : colors.surface,
                    }}
                  >
                    <div>
                      <p className="text-sm font-bold" style={{ color: colors.text }}>
                        {opt.label}
                      </p>
                      <p className="text-xs" style={{ color: colors.muted }}>
                        {opt.desc}
                      </p>
                    </div>
                    {isSelected && (
                      <Check size={18} style={{ color: colors.primary }} />
                    )}
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      )}
    </LayoutTemplate>
  );
};
export default AccountScreen;
