import React from 'react';
import { useTranslation } from 'react-i18next';
import { useTheme } from '../../hooks/useTheme';

interface AnnouncementBannerProps {
  title?: string;
  description?: string;
}

export const AnnouncementBanner: React.FC<AnnouncementBannerProps> = ({ title, description }) => {
  const { t } = useTranslation();
  const { colors } = useTheme();

  return (
    <div
      className="p-4 rounded-none border mb-6"
      style={{
        backgroundColor: colors.surface,
        borderColor: colors.border,
      }}
    >
      <div className="flex items-center">
        <div
          className="w-2.5 h-2.5 rounded-full mr-2 flex-shrink-0"
          style={{ backgroundColor: colors.primary }}
        />
        <span
          className="text-xs font-bold uppercase tracking-wide"
          style={{ color: colors.text }}
        >
          {t('announcement', 'ANNOUNCEMENT')}
        </span>
      </div>
      <h4
        className="text-sm font-semibold mt-2 leading-snug"
        style={{ color: colors.text }}
      >
        {title || t('home_announcement_title', 'System Maintenance & Updates')}
      </h4>
      <p
        className="text-xs mt-1 leading-relaxed"
        style={{ color: colors.muted }}
      >
        {description || t('home_announcement_description', 'Please ensure all pending offline attendance logs are synced before Friday 5:00 PM.')}
      </p>
    </div>
  );
};

