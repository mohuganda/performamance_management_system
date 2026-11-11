import React from 'react';
import { NavLink } from 'react-router-dom';
import { Home, Clock, Calendar, CheckSquare, User } from 'lucide-react';
import { useAuthStore } from '../../stores/authStore';
import { useTheme } from '../../hooks/useTheme';

export const BottomNavBar: React.FC = () => {
  const { hasPermission } = useAuthStore();
  const { colors } = useTheme();

  const showApprovals = hasPermission([
    'leave.requests.approve',
    'oos.requests.approve',
    'dashboard.supervisor',
    'dashboard.department_head',
    'dashboard.hr',
  ]);

  const navItems = [
    { to: '/', label: 'Home', Icon: Home },
    { to: '/attendance', label: 'Attendance', Icon: Clock },
    { to: '/leave', label: 'Leave', Icon: Calendar },
    ...(showApprovals ? [{ to: '/approvals', label: 'Approvals', Icon: CheckSquare }] : []),
    { to: '/account', label: 'Account', Icon: User },
  ];

  return (
    <nav
      className="fixed bottom-0 left-0 right-0 z-40 border-t transition-colors"
      style={{
        backgroundColor: colors.surface,
        borderTopColor: colors.border,
      }}
    >
      <div className="max-w-md mx-auto flex items-center justify-around h-16 px-1">
        {navItems.map(({ to, label, Icon }) => (
          <NavLink
            key={to}
            to={to}
            end={to === '/'}
            className="flex flex-col items-center justify-center flex-1 py-1.5 transition-colors"
          >
            {({ isActive }) => {
              const activeColor = colors.primary;
              const inactiveColor = '#6B7280';
              const currentColor = isActive ? activeColor : inactiveColor;

              return (
                <>
                  <Icon
                    size={22}
                    color={currentColor}
                    strokeWidth={isActive ? 2.5 : 2}
                  />
                  <span
                    className="text-[10px] mt-1 font-medium tracking-tight"
                    style={{ color: currentColor, fontWeight: isActive ? 700 : 500 }}
                  >
                    {label}
                  </span>
                </>
              );
            }}
          </NavLink>
        ))}
      </div>
    </nav>
  );
};
export default BottomNavBar;
