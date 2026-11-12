import { useState } from 'react'
import { FileText, MapPin, CheckSquare } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { useAuthStore } from '@/stores/appStore'
import { PageHeader } from '@/components/organisms/PageHeader'
import { OosHistoryTab } from '@/components/organisms/oos/OosHistoryTab'
import { OosRequestTab } from '@/components/organisms/oos/OosRequestTab'
import { OosApprovalsTab } from '@/components/organisms/oos/OosApprovalsTab'
import { cn } from '@/utils/cn'

export function OutOfStationPage() {
  const { t } = useTranslation()
  const { hasPermission, staffId } = useAuthStore()

  const canApprove = hasPermission('oos.requests.approve')
  const [activeTab, setActiveTab] = useState<'history' | 'apply' | 'approvals'>('history')

  return (
    <div className="flex-1 w-full max-w-4xl mx-auto">
      <PageHeader
        title={t('oos_title', 'Out of Station')}
        subtitle="Apply for official travel and track duty attendance away from your facility"
      />

      {!staffId && (
        <div className="mx-4 mb-4 p-4 border border-amber-300 bg-amber-50 dark:bg-amber-950/20 text-amber-900 dark:text-amber-200 text-sm">
          Link your account to an iHRIS staff record to submit out-of-station requests.
        </div>
      )}

      {/* Tab Selection Bar matching Mobile OosScreen */}
      <div className="flex border-b border-ui-border justify-around items-center bg-ui-surface mb-4">
        {/* History Tab */}
        <button
          type="button"
          onClick={() => setActiveTab('history')}
          className={cn(
            'flex-1 py-3.5 items-center justify-center border-b-2 flex flex-row gap-1.5 text-xs font-bold transition-all cursor-pointer',
            activeTab === 'history'
              ? 'border-[#15803D] text-[#15803D]'
              : 'border-transparent text-ui-muted hover:text-ui-text',
          )}
        >
          <FileText size={16} className={activeTab === 'history' ? 'text-[#15803D]' : 'text-ui-muted'} />
          <span>{t('oos_tab_history', 'History')}</span>
        </button>

        {/* New Application Tab */}
        <button
          type="button"
          onClick={() => setActiveTab('apply')}
          className={cn(
            'flex-1 py-3.5 items-center justify-center border-b-2 flex flex-row gap-1.5 text-xs font-bold transition-all cursor-pointer',
            activeTab === 'apply'
              ? 'border-[#15803D] text-[#15803D]'
              : 'border-transparent text-ui-muted hover:text-ui-text',
          )}
        >
          <MapPin size={16} className={activeTab === 'apply' ? 'text-[#15803D]' : 'text-ui-muted'} />
          <span>{t('oos_tab_apply', 'New Application')}</span>
        </button>

        {/* Approvals Tab (Only if supervisor has approvals permission) */}
        {canApprove && (
          <button
            type="button"
            onClick={() => setActiveTab('approvals')}
            className={cn(
              'flex-1 py-3.5 items-center justify-center border-b-2 flex flex-row gap-1.5 text-xs font-bold transition-all cursor-pointer',
              activeTab === 'approvals'
                ? 'border-[#15803D] text-[#15803D]'
                : 'border-transparent text-ui-muted hover:text-ui-text',
            )}
          >
            <CheckSquare size={16} className={activeTab === 'approvals' ? 'text-[#15803D]' : 'text-ui-muted'} />
            <span>{t('oos_tab_approvals', 'Approvals')}</span>
          </button>
        )}
      </div>

      {/* Tab Contents View */}
      <div className="flex-1">
        {activeTab === 'history' && <OosHistoryTab />}
        {activeTab === 'apply' && <OosRequestTab onComplete={() => setActiveTab('history')} />}
        {activeTab === 'approvals' && canApprove && <OosApprovalsTab />}
      </div>
    </div>
  )
}

export default OutOfStationPage
