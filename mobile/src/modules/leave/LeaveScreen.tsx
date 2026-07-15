import React, { useState } from 'react';
import { View, Text, TouchableOpacity, ScrollView, Modal, Pressable } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { Calendar, MapPin, ChevronRight, FileText, HelpCircle, AlertCircle } from 'lucide-react-native';
import { useTranslation } from 'react-i18next';
import { useTheme } from '../../app/hooks/useTheme';
import { MainTemplate } from '../../components/templates';
import { LeaveBalances } from './LeaveBalances';

const LEAVE_STEPS = [
  {
    title: 'Check your balance',
    description: 'Confirm you have enough days for the leave type you need (annual, sick, etc.) directly on your dashboard.',
    actor: 'Employee',
  },
  {
    title: 'Submit application',
    description:
      'Fill in leave type, dates, and reason. Standard leave types require at least 14 days advance notice. Past dates are blocked.',
    actor: 'Employee',
  },
  {
    title: 'Approval chain',
    description:
      'Your request routes through the configured workflow: typically your first supervisor, then facility HR (or district/ministry approvers).',
    actor: 'Approvers',
  },
  {
    title: 'HR records update',
    description: 'After all approval stages complete, HR finalises the leave on your record and updates balances.',
    actor: 'HR Officer',
  },
];

export function LeaveScreen() {
  const { t } = useTranslation();
  const navigation = useNavigation<any>();
  const { colors } = useTheme();

  // Guide Bottom Sheet State
  const [isGuideVisible, setIsGuideVisible] = useState(false);

  return (
    <MainTemplate title={t('leave_management_title')}>
      <ScrollView className="flex-1" contentContainerStyle={{ paddingBottom: 32 }}>
        <View className="p-6 space-y-6">

          {/* Leave Balances Swipe Section - Full Width */}
          <View className="space-y-3">
            <Text className="text-xs font-bold uppercase tracking-wider" style={{ color: colors.muted }}>
              {t('leave_balances_title')}
            </Text>
            <LeaveBalances />
          </View>

          {/* Sleek Banner to show How Leave Works */}
          <TouchableOpacity
            activeOpacity={0.7}
            onPress={() => setIsGuideVisible(true)}
            className="flex-row items-center justify-between p-4 rounded-2xl border border-dashed"
            style={{
              backgroundColor: colors.surface,
              borderColor: colors.border,
            }}
          >
            <View className="flex-row items-center space-x-3 flex-1">
              <View className="w-9 h-9 rounded-full items-center justify-center bg-gray-50 dark:bg-zinc-800 mr-3">
                <HelpCircle size={18} color={colors.primary} />
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

          <Text className="text-xs font-bold uppercase tracking-wider" style={{ color: colors.muted }}>
            {t('leave_deployment_requests')}
          </Text>

          {/* Quick Action Buttons */}
          <View className="space-y-4">
            {/* Standard Leave Request form */}
            <TouchableOpacity
              activeOpacity={0.7}
              onPress={() => navigation.navigate('LeaveRequest')}
              className="flex-row items-center justify-between p-5 rounded-2xl border"
              style={{
                backgroundColor: colors.surface,
                borderColor: colors.border,
              }}
            >
              <View className="flex-row items-center space-x-4 flex-1">
                <View className="w-12 h-12 rounded-full items-center justify-center bg-green-50 dark:bg-green-950/20 mr-4">
                  <Calendar size={22} color={colors.success} />
                </View>
                <View className="flex-1">
                  <Text className="text-base font-bold" style={{ color: colors.text }}>
                    {t('leave_apply_title')}
                  </Text>
                  <Text className="text-xs opacity-75 mt-0.5" style={{ color: colors.muted }}>
                    {t('leave_standard_request_sub')}
                  </Text>
                </View>
              </View>
              <ChevronRight size={18} color={colors.muted} />
            </TouchableOpacity>

            {/* Leave History Screen */}
            <TouchableOpacity
              activeOpacity={0.7}
              onPress={() => navigation.navigate('LeaveHistory')}
              className="flex-row items-center justify-between p-5 rounded-2xl border"
              style={{
                backgroundColor: colors.surface,
                borderColor: colors.border,
              }}
            >
              <View className="flex-row items-center space-x-4 flex-1">
                <View className="w-12 h-12 rounded-full items-center justify-center bg-purple-50 dark:bg-purple-950/20 mr-4">
                  <FileText size={22} color="#8B5CF6" />
                </View>
                <View className="flex-1">
                  <Text className="text-base font-bold" style={{ color: colors.text }}>
                    {t('leave_history_title')}
                  </Text>
                  <Text className="text-xs opacity-75 mt-0.5" style={{ color: colors.muted }}>
                    Track status and approvals
                  </Text>
                </View>
              </View>
              <ChevronRight size={18} color={colors.muted} />
            </TouchableOpacity>

            {/* Out Of Station Card */}
            <TouchableOpacity
              activeOpacity={0.7}
              onPress={() => navigation.navigate('OutOfStation')}
              className="flex-row items-center justify-between p-5 rounded-2xl border"
              style={{
                backgroundColor: colors.surface,
                borderColor: colors.border,
              }}
            >
              <View className="flex-row items-center space-x-4 flex-1">
                <View className="w-12 h-12 rounded-full items-center justify-center bg-amber-50 dark:bg-amber-950/20 mr-4">
                  <MapPin size={22} color="#F59E0B" />
                </View>
                <View className="flex-1">
                  <Text className="text-base font-bold" style={{ color: colors.text }}>
                    {t('leave_oos_request')}
                  </Text>
                  <Text className="text-xs opacity-75 mt-0.5" style={{ color: colors.muted }}>
                    {t('leave_oos_request_sub')}
                  </Text>
                </View>
              </View>
              <ChevronRight size={18} color={colors.muted} />
            </TouchableOpacity>
          </View>
        </View>
      </ScrollView>

      {/* Slide-Up Bottom Sheet Modal for How Leave Works */}
      <Modal
        visible={isGuideVisible}
        animationType="slide"
        transparent={true}
        statusBarTranslucent={true}
        onRequestClose={() => setIsGuideVisible(false)}
      >
        <View className="flex-1 justify-end bg-black/50">
          <Pressable className="flex-1" onPress={() => setIsGuideVisible(false)} />
          <View
            className="rounded-t-3xl p-6 pb-12 max-h-[85%] border-t"
            style={{
              backgroundColor: colors.surface,
              borderColor: colors.border,
            }}
          >
            {/* Modal Header */}
            <View className="flex-row justify-between items-center border-b pb-4 mb-6" style={{ borderColor: colors.border }}>
              <Text className="text-lg font-bold" style={{ color: colors.text }}>
                How Leave Applications Work
              </Text>
              <TouchableOpacity onPress={() => setIsGuideVisible(false)} className="px-3 py-1 bg-gray-100 dark:bg-zinc-800 rounded-lg">
                <Text className="text-sm font-bold" style={{ color: colors.muted }}>
                  Close
                </Text>
              </TouchableOpacity>
            </View>

            {/* Steps Scroll container */}
            <ScrollView className="space-y-6" showsVerticalScrollIndicator={false}>
              {LEAVE_STEPS.map((step, idx) => (
                <View key={idx} className="flex-row items-start mb-6">
                  <View
                    className="w-8 h-8 rounded-full items-center justify-center mr-4 mt-0.5"
                    style={{ backgroundColor: colors.primary }}
                  >
                    <Text className="text-sm font-black text-white dark:text-zinc-950">
                      {idx + 1}
                    </Text>
                  </View>
                  <View className="flex-1 space-y-1">
                    <View className="flex-row justify-between items-center">
                      <Text className="text-base font-bold" style={{ color: colors.text }}>
                        {step.title}
                      </Text>
                      <View className="px-2 py-0.5 rounded bg-gray-100 dark:bg-zinc-800">
                        <Text className="text-[10px] font-bold uppercase tracking-wider" style={{ color: colors.muted }}>
                          {step.actor}
                        </Text>
                      </View>
                    </View>
                    <Text className="text-sm leading-relaxed" style={{ color: colors.muted }}>
                      {step.description}
                    </Text>
                  </View>
                </View>
              ))}

              <View className="p-4 rounded-2xl flex-row bg-amber-50 dark:bg-amber-950/20 border border-amber-100 dark:border-amber-900/50 mt-4">
                <AlertCircle size={18} color="#D97706" className="mr-3 mt-0.5" />
                <View className="flex-1">
                  <Text className="text-xs font-bold text-amber-800 dark:text-amber-400">
                    Important Notice:
                  </Text>
                  <Text className="text-xs text-amber-700 dark:text-amber-400/80 mt-1 leading-relaxed">
                    Standard leaves (except sick/emergency) require at least 14 days advance submission to allow adequate department scheduling.
                  </Text>
                </View>
              </View>
            </ScrollView>
          </View>
        </View>
      </Modal>
    </MainTemplate>
  );
}
export default LeaveScreen;
