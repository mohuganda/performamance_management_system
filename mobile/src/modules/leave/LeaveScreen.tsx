import React, { useState } from 'react';
import { View, Text, TouchableOpacity, ScrollView } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { Calendar, MapPin, FileText, ChevronRight, HelpCircle } from 'lucide-react-native';
import { useTranslation } from 'react-i18next';
import { useTheme } from '../../app/hooks/useTheme';
import { MainTemplate } from '../../components/templates';
import { LeaveBalances } from '../../components/organisms/LeaveBalances';
import { LeaveGuideModal } from '../../components/organisms/modals/LeaveGuideModal';
import { QuickActionCard } from '../../components/organisms/QuickActionCard';

export function LeaveScreen() {
  const { t } = useTranslation();
  const navigation = useNavigation<any>();
  const { colors } = useTheme();

  // Guide Modal State
  const [isGuideVisible, setIsGuideVisible] = useState(false);

  return (
    <MainTemplate title={t('leave_management_title')}>
      <ScrollView className="flex-1" contentContainerStyle={{ paddingBottom: 32 }}>
        <View className="p-6 space-y-6">

          {/* Leave Balances Section (Full-Width Organism) */}
          <View className="space-y-3">
            <Text className="text-xs font-bold uppercase tracking-wider" style={{ color: colors.muted }}>
              {t('leave_balances_title')}
            </Text>
            <LeaveBalances />
          </View>

          {/* How Leave Works Trigger Banner */}
          <TouchableOpacity
            activeOpacity={0.7}
            onPress={() => setIsGuideVisible(true)}
            className="flex-row items-center justify-between p-4 rounded-none bg-blue-500/10 dark:bg-blue-500/20 border-blue-500/50"
          >
            <View className="flex-row items-center space-x-3 flex-1">
              <View className="w-9 h-9 rounded-full items-center justify-center bg-gray-50 dark:bg-zinc-800 mr-3">
                <HelpCircle size={18} className="text-blue-500" />
              </View>
              <View className="flex-1">
                <Text className="text-sm font-bold" style={{ color: colors.text }}>
                  How Leave Applications Work
                </Text>
                <Text className="text-xs mt-0.5" style={{ color: colors.muted }}>
                  Read the step-by-step process guidelines
                </Text>
              </View>
            </View>
            <ChevronRight size={16} color={colors.muted} />
          </TouchableOpacity>

          <Text className="text-xs font-bold uppercase tracking-wider mt-4" style={{ color: colors.muted }}>
            {t('leave_deployment_requests')}
          </Text>

          {/* Reused Quick Action Buttons Organisms */}
          <View className="space-y-4 mt-2">
            <QuickActionCard
              title={t('leave_apply_title')}
              subtitle={t('leave_standard_request_sub')}
              Icon={Calendar}
              iconColor={colors.success}
              iconBgClass="bg-green-50 dark:bg-green-950/20"
              onPress={() => navigation.navigate('LeaveRequest')}
              className="mb-2"
            />

            <QuickActionCard
              title={t('leave_history_title')}
              subtitle="Track status and approvals"
              Icon={FileText}
              iconColor="#8B5CF6"
              iconBgClass="bg-purple-50 dark:bg-purple-950/20"
              onPress={() => navigation.navigate('LeaveHistory')}
              className="mb-2"
            />

            <QuickActionCard
              title={t('leave_oos_request')}
              subtitle={t('leave_oos_request_sub')}
              Icon={MapPin}
              iconColor="#F59E0B"
              iconBgClass="bg-amber-50 dark:bg-amber-950/20"
              onPress={() => navigation.navigate('OutOfStation')}
              className="mb-2"
            />
          </View>
        </View>
      </ScrollView>

      {/* Guide Bottom Sheet Organism */}
      <LeaveGuideModal
        visible={isGuideVisible}
        onClose={() => setIsGuideVisible(false)}
      />
    </MainTemplate>
  );
}
export default LeaveScreen;
