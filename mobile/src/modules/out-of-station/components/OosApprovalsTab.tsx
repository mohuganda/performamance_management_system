import React, { useState } from 'react';
import { View, Text, ScrollView, ActivityIndicator, TextInput, Alert, TouchableOpacity } from 'react-native';
import { useTranslation } from 'react-i18next';
import { useOosPendingApprovalsQuery, useApproveOosMutation } from '../../../app/hooks/useOos';
import { useTheme } from '../../../app/hooks/useTheme';
import { Check, X, User, MapPin, Calendar, ClipboardList } from 'lucide-react-native';

export function OosApprovalsTab() {
  const { t } = useTranslation();
  const { colors, isDark } = useTheme();

  const pendingQuery = useOosPendingApprovalsQuery();
  const approveMutation = useApproveOosMutation();

  const [comments, setComments] = useState<Record<number, string>>({});

  const handleAction = (approvalId: number, approve: boolean) => {
    const commentText = comments[approvalId]?.trim() || '';

    approveMutation.mutate(
      { id: approvalId, approve, comments: commentText },
      {
        onSuccess: () => {
          Alert.alert('Success', approve ? 'Travel request approved.' : 'Travel request rejected.');
          setComments((prev) => {
            const copy = { ...prev };
            delete copy[approvalId];
            return copy;
          });
        },
        onError: (err) => {
          Alert.alert('Error', err.message || 'Could not process travel approval.');
        },
      }
    );
  };

  if (pendingQuery.isLoading) {
    return (
      <View className="flex-1 justify-center items-center py-12">
        <ActivityIndicator size="small" color={colors.primary} />
      </View>
    );
  }

  const list = Array.isArray(pendingQuery.data) ? pendingQuery.data : [];

  if (list.length === 0) {
    return (
      <View className="flex-1 justify-center items-center py-12 px-6">
        <ClipboardList size={40} color={colors.muted} style={{ opacity: 0.5, marginBottom: 12 }} />
        <Text className="text-sm font-semibold text-center" style={{ color: colors.muted }}>
          {t('oos_approvals_empty')}
        </Text>
      </View>
    );
  }

  return (
    <ScrollView className="flex-1 px-4 py-3" showsVerticalScrollIndicator={false}>
      <Text className="text-xs font-bold uppercase tracking-wider mb-4" style={{ color: colors.muted }}>
        {t('oos_approvals_title')}
      </Text>

      <View className="space-y-4 pb-6">
        {list.map((row) => (
          <View
            key={row.approval_id}
            className="p-4 border shadow-sm rounded-none mb-4"
            style={{
              backgroundColor: colors.surface,
              borderColor: colors.border,
            }}
          >
            {/* Applicant Name */}
            <View className="flex-row items-center gap-2 mb-3">
              <View className="w-8 h-8 rounded-full bg-zinc-100 dark:bg-zinc-800 items-center justify-center">
                <User size={14} color={colors.text} />
              </View>
              <Text className="text-base font-bold flex-1" style={{ color: colors.text }}>
                {row.staff_name}
              </Text>
            </View>

            {/* Travel Details */}
            <View className="space-y-2 mb-3">
              <View className="flex-row items-center gap-2">
                <Calendar size={14} color={colors.muted} />
                <Text className="text-xs font-medium" style={{ color: colors.text }}>
                  {row.reason_name} · {row.start_date} to {row.end_date}
                </Text>
              </View>
              <View className="flex-row items-center gap-2">
                <MapPin size={14} color={colors.muted} />
                <Text className="text-xs font-medium" style={{ color: colors.text }}>
                  Destination: {row.destination}
                </Text>
              </View>
            </View>

            {row.expected_deliverables && (
              <View className="mb-3 p-3 bg-zinc-50 dark:bg-zinc-900 border" style={{ borderColor: colors.border }}>
                <Text className="text-[10px] font-bold uppercase tracking-wider mb-1" style={{ color: colors.muted }}>
                  {t('oos_form_deliverables')}
                </Text>
                <Text className="text-xs" style={{ color: colors.text }}>
                  {row.expected_deliverables}
                </Text>
              </View>
            )}

            {row.remarks && (
              <Text className="text-xs italic mb-4" style={{ color: colors.muted }}>
                Remarks: "{row.remarks}"
              </Text>
            )}

            {/* Supervisor Decision Comments */}
            <View className="mb-4">
              <TextInput
                value={comments[row.approval_id] || ''}
                onChangeText={(text) => setComments((prev) => ({ ...prev, [row.approval_id]: text }))}
                placeholder={t('oos_comment_placeholder')}
                className="w-full px-3 py-2 border text-sm"
                style={{
                  backgroundColor: isDark ? '#1C1C1E' : '#F9F9F9',
                  borderColor: colors.border,
                  color: colors.text,
                }}
                placeholderTextColor={isDark ? '#55555C' : '#9CA3AF'}
              />
            </View>

            {/* Approve / Reject Buttons */}
            <View className="flex-row gap-3">
              <TouchableOpacity
                onPress={() => handleAction(row.approval_id, true)}
                disabled={approveMutation.isPending}
                className="flex-1 py-2.5 rounded-none flex-row justify-center items-center gap-1.5"
                style={{ backgroundColor: colors.success }}
              >
                <Check size={14} color="#FFFFFF" />
                <Text className="text-white font-bold text-xs">
                  {t('oos_approve_action')}
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                onPress={() => handleAction(row.approval_id, false)}
                disabled={approveMutation.isPending}
                className="flex-1 py-2.5 rounded-none flex-row justify-center items-center gap-1.5 border"
                style={{ borderColor: colors.border, backgroundColor: colors.surface }}
              >
                <X size={14} color={colors.text} />
                <Text className="font-bold text-xs" style={{ color: colors.text }}>
                  {t('oos_reject_action')}
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        ))}
      </View>
    </ScrollView>
  );
}
export default OosApprovalsTab;
