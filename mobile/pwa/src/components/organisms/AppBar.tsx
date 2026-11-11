import React from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';
import { useTheme } from '../../hooks/useTheme';

interface AppBarProps {
  title: string;
  showBack?: boolean;
  rightElement?: React.ReactNode;
}

export const AppBar: React.FC<AppBarProps> = ({ title, showBack = false, rightElement }) => {
  const navigate = useNavigate();
  const { colors } = useTheme();

  return (
    <header
      className="sticky top-0 z-40 flex items-center justify-between px-4 py-3 border-b transition-colors"
      style={{
        backgroundColor: colors.surface,
        borderBottomColor: colors.border,
      }}
    >
      <div className="flex items-center flex-1 min-w-0">
        {showBack && (
          <button
            onClick={() => navigate(-1)}
            className="mr-3 p-1 -ml-1 text-inherit outline-none"
            aria-label="Go Back"
          >
            <ArrowLeft size={22} style={{ color: colors.text }} />
          </button>
        )}
        <h1
          className="font-bold text-xl truncate"
          style={{ color: colors.text }}
        >
          {title}
        </h1>
      </div>
      {rightElement && <div>{rightElement}</div>}
    </header>
  );
};
