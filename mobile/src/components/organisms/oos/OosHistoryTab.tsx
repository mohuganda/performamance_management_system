import React, { useMemo } from 'react';
import { View, Text, ScrollView, ActivityIndicator, TouchableOpacity } from 'react-native';
import { useTranslation } from 'react-i18next';
import { useOosRequestsQuery, useOosReasonsQuery } from '../../../app/hooks/useOos';
import { useTheme } from '../../../app/hooks/useTheme';
import { FileText, MapPin, Calendar, CheckCircle2, AlertTriangle, Clock, RefreshCw } from 'lucide-react-native';

export function OosHistoryTab() {
  const { t } = useTranslation();
  const { colors } = useTheme();

  const requestsQuery = useOosRequestsQuery();
  const reasonsQuery = useOosReasonsQuery();

  const sortedRequests = useMemo(() => {
    const list = Array.isArray(requestsQuery.data) ? requestsQuery.data : [];
    return [...list].sort((a, b) => {
      const dateA = new Date(a.start_date).getTime();
      const dateB = new Date(b.start_date).getTime();
      return dateB - dateA;
    });
  }, [requestsQuery.data]);

  const reasonsMap = useMemo(() => {
    const map = new Map<number, string>();
    if (Array.isArray(reasonsQuery.data)) {
      reasonsQuery.data.forEach((r) => {
        map.set(r.id, r.reason);
      });
    }
    return map;
  }, [reasonsQuery.data]);

  if (requestsQuery.isLoading || reasonsQuery.isLoading) {
    return (
      <View className="flex-1 justify-center items-center py-12">
        <ActivityIndicator size="small" color={colors.primary} />
      </View>
    );
  }

  if (sortedRequests.length === 0) {
    return (
      <View className="flex-1 justify-center items-center py-12 px-6">
        <FileText size={40} color={colors.muted} style={{ opacity: 0.5, marginBottom: 12 }} />
        <Text className="text-sm font-semibold text-center" style={{ color: colors.muted }}>
          {t('oos_history_empty')}
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
          const reasonLabel = reasonsMap.get(req.reason_id) || 'Travel Assignment';

          return (
            <View
              key={req.id}
              className="p-4 border shadow-sm rounded-none"
              style={{
                backgroundColor: colors.surface,
                borderColor: colors.border,
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
                    {req.status === 'pending_sync' ? t('oos_pending_sync_status') : t(`oos_${req.status}_status`, { defaultValue: req.status })}
                  </Text>
                </View>
              </View>

              {/* Travel Period */}
              <View className="flex-row items-center gap-2 mb-2">
                <Calendar size={14} color={colors.muted} />
                <Text className="text-xs font-medium" style={{ color: colors.text }}>
                  {req.start_date} to {req.end_date}
                </Text>
              </View>

              {/* Destination */}
              <View className="flex-row items-center gap-2 mb-3">
                <MapPin size={14} color={colors.muted} />
                <View className="flex-1">
                  <Text className="text-xs font-bold" style={{ color: colors.text }}>
                    {req.destination_name}
                  </Text>
                  {req.destination_address && (
                    <Text className="text-[11px] mt-0.5" style={{ color: colors.muted }}>
                      {req.destination_address}
                    </Text>
                  )}
                </View>
              </View>

              {/* Deliverables / Remarks details */}
              {(req.expected_deliverables || req.remarks) && (
                <View className="mt-3 pt-3 border-t space-y-2" style={{ borderColor: `${colors.border}60` }}>
                  {req.expected_deliverables && (
                    <View>
                      <Text className="text-[10px] font-bold uppercase tracking-wider" style={{ color: colors.muted }}>
                        {t('oos_form_deliverables')}
                      </Text>
                      <Text className="text-xs mt-0.5" style={{ color: colors.text }}>
                        {req.expected_deliverables}
                      </Text>
                    </View>
                  )}
                  {req.remarks && (
                    <View>
                      <Text className="text-[10px] font-bold uppercase tracking-wider" style={{ color: colors.muted }}>
                        {t('oos_form_remarks')}
                      </Text>
                      <Text className="text-xs mt-0.5" style={{ color: colors.muted }}>
                        {req.remarks}
                      </Text>
                    </View>
                  )}
                </View>
              )}
            </View>
          );
        })}
      </View>
    </ScrollView>
  );
}
export default OosHistoryTab;
