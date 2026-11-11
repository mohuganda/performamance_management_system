import React from 'react';
import { useNavigate } from 'react-router-dom';
import { AlertCircle } from 'lucide-react';
import { AppBar } from '../organisms/AppBar';
import { useSyncStore } from '../../stores/syncStore';
import { useTheme } from '../../hooks/useTheme';

interface MainTemplateProps {
  title: string;
  children: React.ReactNode;
  showBack?: boolean;
  rightElement?: React.ReactNode;
  className?: string;
}

export const MainTemplate: React.FC<MainTemplateProps> = ({
  title,
  children,
  showBack = false,
  rightElement,
  className = '',
}) => {
  const navigate = useNavigate();
  const { colors } = useTheme();
  const failedQueue = useSyncStore((state) => state.failedQueue);
  const failedCount = failedQueue.length;

  return (
    <div
      className={`min-h-screen pb-24 transition-colors ${className}`}
      style={{ backgroundColor: colors.background }}
    >
      <div className="max-w-md mx-auto">
        <AppBar title={title} showBack={showBack} rightElement={rightElement} />

        {failedCount > 0 && (
          <button
            onClick={() => navigate('/sync-issues')}
            className="w-full bg-[#D90000] px-4 py-3 flex items-center justify-between text-left text-white font-bold text-sm"
          >
            <div className="flex items-center gap-2 flex-1 pr-2">
              <AlertCircle size={20} className="flex-shrink-0" />
              <span>
                ⚠️ {failedCount} request{failedCount > 1 ? 's' : ''} failed to sync. Tap to review.
              </span>
            </div>
          </button>
        )}

        {children}
      </div>
    </div>
  );
};

