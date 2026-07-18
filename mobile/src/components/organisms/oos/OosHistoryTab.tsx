import React, { useMemo } from 'react';
import { View, Text, ScrollView, ActivityIndicator, TouchableOpacity } from 'react-native';
import { useTranslation } from 'react-i18next';
import { useOosRequestsSync, useOosReasonsQuery } from '../../../app/hooks/useOos';
import { useTheme } from '../../../app/hooks/useTheme';
import { FileText, MapPin, Calendar, CheckCircle2, AlertTriangle, Clock, RefreshCw } from 'lucide-react-native';
import withObservables from '@nozbe/with-observables';
import { database } from '../../../db';
import OosRequestModel from '../../../db/models/OosRequest';

interface OosHistoryTabProps {
  requests: OosRequestModel[];
}

const BaseOosHistoryTab: React.FC<OosHistoryTabProps> = ({ requests }) => {
  const { t } = useTranslation();
  const { colors } = useTheme();

  const requestsSync = useOosRequestsSync();
  const reasonsQuery = useOosReasonsQuery();

  const sortedRequests = useMemo(() => {
    return [...requests].sort((a, b) => {
      const dateA = new Date(a.startDate).getTime();
      const dateB = new Date(b.startDate).getTime();
      return dateB - dateA;
    });
  }, [requests]);

  const reasonsMap = useMemo(() => {
    const map = new Map<number, string>();
    if (Array.isArray(reasonsQuery.data)) {
      reasonsQuery.data.forEach((r) => {
        map.set(r.id, r.reason);
      });
    }
    return map;
  }, [reasonsQuery.data]);

  if (requestsSync.isLoading && requests.length === 0) {
    return (
      <View className="flex-1 justify-center items-center py-10">
        <ActivityIndicator size="small" color={colors.primary} />
        <Text className="text-xs mt-3" style={{ color: colors.muted }}>
          {t('oos_history_loading')}
        </Text>
      </View>
    );
  }

  if (requests.length === 0) {
    return (
      <View className="flex-1 justify-center items-center py-10 px-6">
        <FileText size={32} color={colors.border} className="mb-4" />
        <Text className="text-sm font-medium text-center" style={{ color: colors.text }}>
          {t('oos_history_empty_title')}
        </Text>
        <Text className="text-xs text-center mt-1" style={{ color: colors.muted }}>
          {t('oos_history_empty_subtitle')}
        </Text>
      </View>
    );
  }

  const getStatusStyles = (status: string) => {
    switch (status) {
      case 'approved':
        return {
          bg: 'bg-green-500/10 dark:bg-green-500/20',
          border: 'border-green-500/30',
          text: 'text-green-700 dark:text-green-400',
          Icon: CheckCircle2,
          color: colors.success,
        };
      case 'rejected':
        return {
          bg: 'bg-red-500/10 dark:bg-red-500/20',
          border: 'border-red-500/30',
          text: 'text-red-700 dark:text-red-400',
          Icon: AlertTriangle,
          color: colors.error,
        };
      case 'pending_sync':
        return {
          bg: 'bg-blue-500/10 dark:bg-blue-500/20',
          border: 'border-blue-500/30',
          text: 'text-blue-700 dark:text-blue-400',
          Icon: RefreshCw,
          color: '#3B82F6',
        };
      case 'sync_failed':
        return {
          bg: 'bg-red-500/10 dark:bg-red-500/20',
          border: 'border-red-500/30',
          text: 'text-red-700 dark:text-red-400',
          Icon: AlertTriangle,
          color: colors.error,
        };
      case 'draft':
        return {
          bg: 'bg-gray-500/10 dark:bg-gray-500/20',
          border: 'border-gray-500/30',
          text: 'text-gray-700 dark:text-gray-400',
          Icon: Clock,
          color: colors.muted,
        };
      default:
        return {
          bg: 'bg-amber-500/10 dark:bg-amber-500/20',
          border: 'border-amber-500/30',
          text: 'text-amber-700 dark:text-amber-400',
          Icon: Clock,
          color: colors.warning,
        };
    }
  };

  return (
    <ScrollView className="flex-1 px-4 py-3" showsVerticalScrollIndicator={false}>
      <Text className="text-xs font-bold uppercase tracking-wider mb-4" style={{ color: colors.muted }}>
        {t('oos_history_title')}
      </Text>

      <View className="space-y-4 pb-6">
        {sortedRequests.map((req) => {
          const statusStyle = getStatusStyles(req.status);
          const StatusIcon = statusStyle.Icon;
          const reasonLabel = reasonsMap.get(req.reasonId) || 'Travel Assignment';
          const isSyncFailed = req.status === 'sync_failed';

          return (
            <View
              key={req.remoteId || req.id}
              className={`p-4 border shadow-sm rounded-none ${isSyncFailed ? 'border-l-4 border-l-red-500' : ''}`}
              style={{
                backgroundColor: colors.surface,
                borderColor: isSyncFailed ? '#ef4444' : colors.border,
              }}
            >
              {/* Header: Reason & Status */}
              <View className="flex-row justify-between items-start mb-3">
                <Text className="text-base font-bold flex-1 mr-2" style={{ color: colors.text }}>
                  {reasonLabel}
                </Text>
                <View className={`flex-row items-center gap-1 px-2.5 py-1 border ${statusStyle.bg} ${statusStyle.border}`}>
                  <StatusIcon size={12} color={statusStyle.color} />
                  <Text className={`text-[10px] font-bold capitalize ${statusStyle.text}`}>
                    {req.status === 'pending_sync' ? t('oos_pending_sync_status', 'Pending Sync') : 
                     req.status === 'sync_failed' ? t('oos_sync_failed_status', 'Sync Failed') :
                     t(`oos_${req.status}_status`, { defaultValue: req.status })}
                  </Text>
                </View>
              </View>

              {/* Travel Period */}
              <View className="flex-row items-center gap-2 mb-2">
                <Calendar size={14} color={colors.muted} />
                <Text className="text-xs font-medium" style={{ color: colors.text }}>
                  {req.startDate} to {req.endDate}
                </Text>
              </View>

              {/* Destination */}
              <View className="flex-row items-center gap-2 mb-3">
                <MapPin size={14} color={colors.muted} />
                <View className="flex-1">
                  <Text className="text-xs font-bold" style={{ color: colors.text }}>
                    {req.destinationName}
                  </Text>
                  {req.destinationAddress && (
                    <Text className="text-[11px] mt-0.5" style={{ color: colors.muted }}>
                      {req.destinationAddress}
                    </Text>
                  )}
                </View>
              </View>

              {/* Deliverables / Remarks details */}
              {(req.expectedDeliverables || req.remarks) && (
                <View className="mt-3 pt-3 border-t space-y-2" style={{ borderColor: `${colors.border}60` }}>
                  {req.expectedDeliverables && (
                    <View>
                      <Text className="text-[10px] font-bold uppercase tracking-wider" style={{ color: colors.muted }}>
                        {t('oos_form_deliverables')}
                      </Text>
                      <Text className="text-xs mt-0.5" style={{ color: colors.text }}>
                        {req.expectedDeliverables}
                      </Text>
                    </View>
                  )}
                  
                  {req.remarks && (
                    <View>
                      <Text className="text-[10px] font-bold uppercase tracking-wider" style={{ color: colors.muted }}>
                        {t('oos_form_remarks')}
                      </Text>
                      <Text className="text-xs mt-0.5" style={{ color: colors.text }}>
                        {req.remarks}
                      </Text>
                    </View>
                  )}
                </View>
              )}
              
              {isSyncFailed && req.syncError && (
                <View className="bg-red-50 dark:bg-red-900/20 p-2 rounded mt-3 flex-row items-start">
                  <AlertTriangle size={14} color="#ef4444" style={{ marginTop: 2, marginRight: 6 }} />
                  <Text className="text-xs text-red-600 dark:text-red-400 flex-1">
                    {req.syncError}
                  </Text>
                </View>
              )}
            </View>
          );
        })}
      </View>
    </ScrollView>
  );
};

export const OosHistoryTab = withObservables([], () => ({
  requests: database.collections.get<OosRequestModel>('oos_requests').query().observe(),
}))(BaseOosHistoryTab);
