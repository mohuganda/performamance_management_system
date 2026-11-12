import React from 'react';
import { useNavigate } from 'react-router-dom';
import { Bell } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { useAuthStore } from '../../stores/authStore';
import { useTheme } from '../../hooks/useTheme';
import { useUnreadCountQuery } from '../../hooks/useNotifications';
import { UserAvatar } from '../atoms/UserAvatar';
import { LOGO_SVG } from '../../assets/logoSvg';

export const HomeHeader: React.FC = () => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { user } = useAuthStore();
  const { colors } = useTheme();
  const { data: unreadCount = 0 } = useUnreadCountQuery();

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
          {unreadCount > 0 && (
            <span className="absolute top-0.5 right-0.5 w-4 h-4 bg-red-500 text-white rounded-full text-[9px] font-bold flex items-center justify-center">
              {unreadCount > 9 ? '9+' : unreadCount}
            </span>
          )}
        </button>

        <button
          onClick={() => navigate('/profile')}
          className="rounded-full overflow-hidden flex-shrink-0 transition-opacity hover:opacity-90"
          aria-label="User Profile"
        >
          <UserAvatar
            photoUrl={user?.ProfilePhoto}
            name={user?.Name}
            size="sm"
            className="w-9 h-9"
          />
        </button>
      </div>
    </header>
  );
};

