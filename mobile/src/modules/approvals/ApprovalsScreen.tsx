import React, { useMemo, useState, useEffect } from 'react';
import { View, Text, ScrollView, TouchableOpacity, ActivityIndicator, TextInput, KeyboardAvoidingView, Platform } from 'react-native';
import { useTranslation } from 'react-i18next';
import { MainTemplate } from '../../components/templates';
import { useApprovalsInboxSync, useActApprovalMutation } from '../../app/hooks/useApprovals';
import { useTheme } from '../../app/hooks/useTheme';
import { Card } from '../../components/atoms/Card';
import { EmptyState } from '../../components/molecules/EmptyState';
import { ApprovalInboxItem, ApprovalInboxStats } from '../../api/approvals/types';
import { CalendarDays, MapPin, Activity, CheckCircle2, Clock, XCircle } from 'lucide-react-native';
import withObservables from '@nozbe/with-observables';
import { database } from '../../db';
import ApprovalTask from '../../db/models/ApprovalTask';
import { ApprovalsDbService } from '../../db/services/ApprovalsDbService';

type FilterTab = 'all' | 'leave' | 'oos' | 'performance';

function getModuleStyles(module: string) {
  switch (module) {
    case 'leave':
      return { bg: '#E0F2FE', text: '#0369A1', icon: CalendarDays };
    case 'oos':
      return { bg: '#EDE9FE', text: '#5B21B6', icon: MapPin };
    case 'performance':
    case 'ppa':
      return { bg: '#FEF3C7', text: '#92400E', icon: Activity };
    default:
      return { bg: '#F3F4F6', text: '#374151', icon: Activity };
  }
}

function matchesFilter(item: ApprovalTask, filter: FilterTab) {
  if (filter === 'all') return true;
  if (filter === 'leave') return item.module === 'leave';
  if (filter === 'oos') return item.module === 'oos';
  return item.module === 'performance' || item.module === 'ppa';
}

function waitingLabel(days: number) {
  if (days <= 0) return 'Today';
  if (days === 1) return '1 day';
  return `${days} days`;
}

interface ApprovalsScreenProps {
  tasks: ApprovalTask[];
}

const BaseApprovalsScreen: React.FC<ApprovalsScreenProps> = ({ tasks }) => {
  const { t } = useTranslation();
  const { colors, isDark } = useTheme();

  const [filter, setFilter] = useState<FilterTab>('all');
  const [comments, setComments] = useState<Record<string, string>>({});
  const [activeId, setActiveId] = useState<string | null>(null);
  const [stats, setStats] = useState<ApprovalInboxStats | null>(null);

  // Trigger background sync
  const inboxSync = useApprovalsInboxSync();
  const actMutation = useActApprovalMutation();

  // Load stats from local storage on mount and when sync finishes
  useEffect(() => {
    ApprovalsDbService.getStats().then((localStats) => {
      if (localStats) setStats(localStats);
    });
  }, [inboxSync.dataUpdatedAt]); // update stats when the background sync completes

  const filtered = useMemo(() => {
    return tasks.filter((row) => matchesFilter(row, filter));
  }, [filter, tasks]);

  const handleAct = (item: ApprovalTask, approve: boolean) => {
    if (!item.remoteId) return;

    // Convert local Model back to the expected payload for the hook
    const inboxItem: ApprovalInboxItem = {
      id: item.remoteId,
      module: item.module as any,
      type_label: item.typeLabel,
      staff_name: item.staffName,
      title: item.title,
      subtitle: item.subtitle,
      status: item.status,
      stage_name: item.stageName || undefined,
      submitted_at: item.submittedAt || undefined,
      waiting_days: item.waitingDays,
      can_act: item.canAct,
      approval_id: item.approvalId || undefined,
      request_id: item.requestId || undefined,
      report_id: item.reportId || undefined,
      ppa_id: item.ppaId || undefined,
      meta: item.metaString ? JSON.parse(item.metaString) : undefined,
    };

    setActiveId(item.remoteId);
    actMutation.mutate(
      { item: inboxItem, approve, comments: comments[item.remoteId] },
      {
        onSuccess: () => {
          setComments((prev) => {
            const next = { ...prev };
            delete next[item.remoteId!];
            return next;
          });
          setActiveId(null);
        },
        onError: () => {
          setActiveId(null);
        }
      }
    );
  };

  const renderTabs = () => (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      className="px-4 py-2"
      contentContainerStyle={{ paddingRight: 20 }}
    >
      {[
        { key: 'all', label: t('approvals_all'), count: stats?.pending_total ?? 0 },
        { key: 'leave', label: t('approvals_leave'), count: stats?.leave_pending ?? 0 },
        { key: 'oos', label: t('approvals_oos'), count: stats?.oos_pending ?? 0 },
        { key: 'performance', label: t('approvals_performance'), count: (stats?.performance_pending ?? 0) + (stats?.ppa_pending ?? 0) },
      ].map((tab) => {
        const isActive = filter === tab.key;
        return (
          <TouchableOpacity
            key={tab.key}
            onPress={() => setFilter(tab.key as FilterTab)}
            className="mr-3 flex-row items-center rounded-none px-4 py-2 border"
            style={{
              backgroundColor: isActive ? colors.primary : colors.surface,
              borderColor: isActive ? colors.primary : colors.border,
            }}
          >
            <Text
              className="font-medium text-sm"
              style={{ color: isActive ? colors.background : colors.text }}
            >
              {tab.label}
            </Text>
            {tab.count > 0 && (
              <View
                className="ml-2 rounded-full px-2 py-0.5"
                style={{ backgroundColor: isActive ? (isDark ? 'rgba(0,0,0,0.1)' : 'rgba(255,255,255,0.2)') : colors.border }}
              >
                <Text style={{ color: isActive ? colors.background : colors.text, fontSize: 12, fontWeight: 'bold' }}>
                  {tab.count}
                </Text>
              </View>
            )}
          </TouchableOpacity>
        );
      })}
    </ScrollView>
  );

  return (
    <>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={{ flex: 1 }}
      >
        <View className="bg-background pt-2 border-b" style={{ borderBottomColor: colors.border }}>
          {renderTabs()}
        </View>

        {inboxSync.isLoading && tasks.length === 0 ? (
          <View className="flex-1 items-center justify-center">
            <ActivityIndicator size="large" color={colors.primary} />
          </View>
        ) : (
          <ScrollView
            className="flex-1"
            contentContainerStyle={{ padding: 16, paddingBottom: 40 }}
          >
            {stats && (
              <Card className="p-4 mb-4 border border-emerald-500/20 shadow-sm">
                <View className="flex-row justify-between items-center">
                  <View className="flex-row items-center flex-1 pr-4">
                    <View className="w-10 h-10 rounded-full bg-emerald-100 items-center justify-center mr-3">
                      <Clock size={20} color="#10B981" />
                    </View>
                    <View>
                      <Text className="text-xs font-bold uppercase tracking-wide text-emerald-600 mb-1">
                        {t('approvals_your_performance')}
                      </Text>
                      <Text className="text-xs" style={{ color: colors.muted }}>
                        {t('approvals_avg_time_desc')}
                      </Text>
                    </View>
                  </View>
                  <View className="items-end">
                    <Text className="text-xl font-bold" style={{ color: colors.text }}>
                      {stats.avg_approval_label}
                    </Text>
                    <Text className="text-xs mt-1" style={{ color: colors.muted }}>
                      across {stats.completed_count} requests
                    </Text>
                  </View>
                </View>
              </Card>
            )}

            {filtered.length === 0 ? (
              <EmptyState
                title={t('approvals_empty_title')}
                description={t('approvals_empty_desc')}
                icon={<CheckCircle2 size={40} color={colors.primary} />}
              />
            ) : (
              <View className="gap-4">
                {filtered.map((item) => {
                  const remoteId = item.remoteId!;
                  const style = getModuleStyles(item.module);
                  const isMutating = actMutation.isPending && activeId === remoteId;
                  const meta = item.metaString ? JSON.parse(item.metaString) : null;

                  return (
                    <Card key={remoteId} className="p-4">
                      <View className="flex-row justify-between items-start mb-3">
                        <View className="flex-row flex-wrap gap-2 items-center flex-1 pr-2">
                          <View
                            className="px-2 py-1 rounded-full flex-row items-center"
                            style={{ backgroundColor: style.bg }}
                          >
                            <Text className="text-xs font-medium normal-case" style={{ color: style.text }}>
                              {item.typeLabel}
                            </Text>
                          </View>
                          {item.stageName && (
                            <Text className="text-[10px] font-bold uppercase tracking-widest text-emerald-600">
                              {item.stageName}
                            </Text>
                          )}
                        </View>
                        <View className="items-end">
                          <Text className="text-[10px] uppercase font-bold text-gray-500 mb-1">
                            {t('approvals_waiting')}
                          </Text>
                          <Text className="text-xs font-bold" style={{ color: colors.text }}>
                            {waitingLabel(item.waitingDays)}
                          </Text>
                        </View>
                      </View>

                      <Text className="text-base font-bold mb-1" style={{ color: colors.text }}>
                        {item.staffName}
                      </Text>
                      <Text className="text-sm font-medium mb-1" style={{ color: colors.text }}>
                        {item.title}
                      </Text>
                      <Text className="text-sm mb-2" style={{ color: colors.muted }}>
                        {item.subtitle}
                      </Text>

                      {typeof meta?.reason === 'string' && meta.reason && (
                        <View className="mt-2 p-3 bg-gray-50 rounded-md border border-gray-100">
                          <Text className="text-xs font-bold text-gray-700 mb-1">{t('approvals_reason')}</Text>
                          <Text className="text-sm text-gray-800">{meta.reason}</Text>
                        </View>
                      )}

                      {item.canAct && (
                        <View className="mt-4 pt-4 border-t" style={{ borderTopColor: colors.border }}>
                          <TextInput
                            className="border rounded-md px-3 py-2 text-sm mb-3 min-h-[60px]"
                            style={{
                              borderColor: colors.border,
                              color: colors.text,
                              backgroundColor: colors.surface,
                              textAlignVertical: 'top'
                            }}
                            placeholder={t('approvals_comments_optional')}
                            placeholderTextColor={colors.muted}
                            value={comments[remoteId] || ''}
                            onChangeText={(val) => setComments(p => ({ ...p, [remoteId]: val }))}
                            multiline
                            numberOfLines={2}
                            editable={!isMutating}
                          />

                          <View className="flex-row gap-3">
                            <TouchableOpacity
                              onPress={() => handleAct(item, true)}
                              disabled={isMutating}
                              className="flex-1 bg-emerald-600 rounded-md py-3 items-center justify-center flex-row"
                              style={{ opacity: isMutating ? 0.7 : 1 }}
                            >
                              {isMutating ? (
                                <ActivityIndicator size="small" color="#fff" />
                              ) : (
                                <Text className="text-white font-bold text-sm">
                                  {t('approvals_approve_btn')}
                                </Text>
                              )}
                            </TouchableOpacity>

                            <TouchableOpacity
                              onPress={() => handleAct(item, false)}
                              disabled={isMutating}
                              className="flex-1 rounded-md py-3 items-center justify-center flex-row border border-red-200"
                              style={{
                                backgroundColor: '#FEF2F2',
                                opacity: isMutating ? 0.7 : 1
                              }}
                            >
                              {isMutating ? (
                                <ActivityIndicator size="small" color="#EF4444" />
                              ) : (
                                <>
                                  <XCircle size={16} color="#DC2626" className="mr-2" />
                                  <Text className="text-red-700 font-bold text-sm">
                                    {item.module === 'performance' || item.module === 'ppa'
                                      ? t('approvals_return_btn')
                                      : t('approvals_reject_btn')}
                                  </Text>
                                </>
                              )}
                            </TouchableOpacity>
                          </View>
                        </View>
                      )}
                    </Card>
                  );
                })}
              </View>
            )}
          </ScrollView>
        )}
      </KeyboardAvoidingView>
    </>
  );
};

const ApprovalsDataObserver = withObservables([], () => ({
  tasks: database.collections.get<ApprovalTask>('approval_tasks').query().observe(),
}))(BaseApprovalsScreen);

export const ApprovalsScreen = () => {
  const { t } = useTranslation();
  return (
    <MainTemplate title={t('approvals')}>
      <ApprovalsDataObserver />
    </MainTemplate>
  );
};
