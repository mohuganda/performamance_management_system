import React from 'react';
import { useNavigate } from 'react-router-dom';
import { Bell } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { useAuthStore } from '../../stores/authStore';
import { useTheme } from '../../hooks/useTheme';
import { LOGO_SVG } from '../../assets/logoSvg';

export const HomeHeader: React.FC = () => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { user } = useAuthStore();
  const { colors } = useTheme();

  return (
    <header
      className="sticky top-0 z-40 flex items-center justify-between px-4 py-3 border-b transition-colors"
      style={{
        backgroundColor: colors.surface,
        borderBottomColor: colors.border,
      }}
    >
      {/* Left: Logo and branding */}
      <div className="flex items-center">
        <div
          className="w-[38px] h-[38px] flex-shrink-0"
          dangerouslySetInnerHTML={{ __html: LOGO_SVG }}
        />
        <div className="ml-2">
          <h1
            className="text-xs font-bold tracking-wider leading-tight uppercase"
            style={{ color: colors.text }}
          >
            {t('moh_uganda', 'MINISTRY OF HEALTH UGANDA')}
          </h1>
          <p
            className="text-[10px] opacity-75 font-semibold leading-tight"
            style={{ color: colors.muted }}
          >
            {t('pms_ihris', 'Performance Management System')}
          </p>
        </div>
      </div>

      {/* Right: Notification bell & Profile Avatar */}
      <div className="flex items-center gap-3">
        <button
          onClick={() => navigate('/notifications')}
          className="relative p-1.5 rounded-full hover:bg-gray-100 dark:hover:bg-zinc-800 transition-colors"
          aria-label="Notifications"
        >
          <Bell size={20} style={{ color: colors.text }} />
        </button>

        <button
          onClick={() => navigate('/profile')}
          className="rounded-full overflow-hidden border border-zinc-200 dark:border-zinc-700 flex-shrink-0"
          aria-label="User Profile"
        >
          {user?.ProfilePhoto ? (
            <img
              src={user.ProfilePhoto}
              alt={user.Name || 'User'}
              className="w-9 h-9 object-cover rounded-full"
            />
          ) : (
            <div
              className="w-9 h-9 rounded-full flex items-center justify-center font-bold text-xs"
              style={{
                backgroundColor: colors.primary,
                color: colors.surface,
              }}
            >
              {user?.Name?.charAt(0) || 'U'}
            </div>
          )}
        </button>
      </div>
    </header>
  );
};

