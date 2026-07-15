import React from 'react';
import { View, Text, Modal, Pressable, ScrollView, TouchableOpacity } from 'react-native';
import { AlertCircle } from 'lucide-react-native';
import { useTheme } from '../../../app/hooks/useTheme';

interface LeaveGuideModalProps {
  visible: boolean;
  onClose: () => void;
}

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

export const LeaveGuideModal: React.FC<LeaveGuideModalProps> = ({ visible, onClose }) => {
  const { colors } = useTheme();

  return (
    <Modal
      visible={visible}
      animationType="slide"
      transparent={true}
      statusBarTranslucent={true}
      onRequestClose={onClose}
    >
      <View className="flex-1 justify-end bg-black/50">
        <Pressable className="flex-1" onPress={onClose} />
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
            <TouchableOpacity onPress={onClose} className="px-3 py-1 bg-gray-100 dark:bg-zinc-800 rounded-lg">
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
  );
};
export default LeaveGuideModal;
