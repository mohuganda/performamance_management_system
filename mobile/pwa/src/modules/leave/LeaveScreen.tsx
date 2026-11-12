import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Calendar, MapPin, FileText, ChevronRight, HelpCircle } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { useTheme } from '../../hooks/useTheme';
import { MainTemplate } from '../../components/templates';
import { LeaveBalances } from '../../components/organisms/LeaveBalances';
import { LeaveGuideModal } from '../../components/organisms/LeaveGuideModal';
import { QuickActionCard } from '../../components/organisms/QuickActionCard';
import { leaveService } from '../../api/leave/service';
import { LeaveBalance, LeaveType } from '../../api/leave/types';

export const LeaveScreen: React.FC = () => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { colors } = useTheme();

  const [isGuideVisible, setIsGuideVisible] = useState(false);
  const [balances, setBalances] = useState<LeaveBalance[]>([]);
  const [leaveTypes, setLeaveTypes] = useState<LeaveType[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    setIsLoading(true);
    // Instant offline cache load
    const cachedBal = localStorage.getItem('moh-pms-leave-balances');
    const cachedTypes = localStorage.getItem('moh-pms-leave-types');
    if (cachedBal) {
      try {
        setBalances(JSON.parse(cachedBal));
      } catch {}
    }
    if (cachedTypes) {
      try {
        setLeaveTypes(JSON.parse(cachedTypes));
      } catch {}
    }

    // Fetch from remote API via normalized leaveService (/mobile/leave/balances & /mobile/leave/types)
    Promise.all([
      leaveService.listBalances(),
      leaveService.listTypes(),
    ])
      .then(([balRes, typeRes]) => {
        setBalances(balRes);
        localStorage.setItem('moh-pms-leave-balances', JSON.stringify(balRes));
        if (typeRes && typeRes.length > 0) {
          setLeaveTypes(typeRes);
          localStorage.setItem('moh-pms-leave-types', JSON.stringify(typeRes));
        }
      })
      .catch((err) => {
        console.warn('Failed to load leave data from API:', err);
      })
      .finally(() => setIsLoading(false));
  }, []);

  return (
    <MainTemplate title={t('leave_management_title', 'Leave Management')}>
      <div className="p-6 space-y-6">
        {/* Leave Balances Section */}
        <div className="space-y-3">
          <h3
            className="text-xs font-bold uppercase tracking-wider mb-2"
            style={{ color: colors.muted }}
          >
            {t('leave_balances_title', 'Leave Balances')}
          </h3>
          <LeaveBalances
            balances={balances}
            leaveTypes={leaveTypes}
            isLoading={isLoading}
          />
        </div>

        {/* How Leave Works Trigger Banner */}
        <button
          onClick={() => setIsGuideVisible(true)}
          className="w-full flex items-center justify-between p-4 rounded-none border border-blue-500/50 bg-blue-500/10 dark:bg-blue-500/20 text-left transition-colors hover:bg-blue-500/15"
        >
          <div className="flex items-center space-x-3 flex-1 mr-2">
            <div className="w-9 h-9 rounded-full flex items-center justify-center bg-gray-50 dark:bg-zinc-800 mr-3 flex-shrink-0">
              <HelpCircle size={18} style={{ color: colors.text }} />
            </div>
            <div className="flex-1 min-w-0">
              <h4 className="text-sm font-bold truncate leading-tight" style={{ color: colors.text }}>
                How Leave Applications Work
              </h4>
              <p className="text-xs mt-0.5 leading-snug" style={{ color: colors.muted }}>
                Read the step-by-step process guidelines
              </p>
            </div>
          </div>
          <ChevronRight size={16} style={{ color: colors.muted }} className="flex-shrink-0" />
        </button>

        <div>
          <h3
            className="text-xs font-bold uppercase tracking-wider mb-3"
            style={{ color: colors.muted }}
          >
            {t('leave_deployment_requests', 'Leave & Deployment Requests')}
          </h3>

          <div className="space-y-3">
            <QuickActionCard
              title={t('leave_apply_title', 'Apply for Leave')}
              subtitle={t('leave_standard_request_sub', 'Submit a planned absence request')}
              Icon={Calendar}
              iconColor={colors.success}
              iconBgClass="bg-green-50 dark:bg-green-950/20"
              onClick={() => navigate('/leave/apply')}
            />

            <QuickActionCard
              title={t('leave_history_title', 'Leave History')}
              subtitle="Track status and approvals"
              Icon={FileText}
              iconColor="#8B5CF6"
              iconBgClass="bg-purple-50 dark:bg-purple-950/20"
              onClick={() => navigate('/leave/history')}
            />

            <QuickActionCard
              title={t('leave_oos_request', 'Out of Station Duty')}
              subtitle={t('leave_oos_request_sub', 'Official travel or external assignment')}
              Icon={MapPin}
              iconColor="#F59E0B"
              iconBgClass="bg-amber-50 dark:bg-amber-950/20"
              onClick={() => navigate('/oos')}
            />
          </div>
        </div>
      </div>

      <LeaveGuideModal
        visible={isGuideVisible}
        onClose={() => setIsGuideVisible(false)}
      />
    </MainTemplate>
  );
};
export default LeaveScreen;
