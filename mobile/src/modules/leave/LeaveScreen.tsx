import React from 'react';
import { View, Text, TouchableOpacity } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { Calendar, MapPin, ChevronRight } from 'lucide-react-native';
import { useTranslation } from 'react-i18next';
import { useTheme } from '../../app/hooks/useTheme';
import { MainTemplate } from '../../components/templates';

export function LeaveScreen() {
  const { t } = useTranslation();
  const navigation = useNavigation<any>();
  const { colors } = useTheme();

  return (
    <MainTemplate title={t('leave_management_title')}>
      <View className="flex-1 p-6">
        <Text className="text-xs font-bold uppercase tracking-wider mb-4" style={{ color: colors.muted }}>
          {t('leave_deployment_requests')}
        </Text>

        {/* Leave Request Card */}
        <TouchableOpacity
          activeOpacity={0.7}
          className="flex-row items-center justify-between p-5 rounded-2xl border mb-4"
          style={{
            backgroundColor: colors.surface,
            borderColor: colors.border,
          }}
        >
          <View className="flex-row items-center gap-4">
            <View className="w-12 h-12 rounded-full items-center justify-center bg-blue-50 dark:bg-blue-950/20">
              <Calendar size={22} color={colors.primary} />
            </View>
            <View className="flex-1 ml-1">
              <Text className="text-base font-bold" style={{ color: colors.text }}>
                {t('leave_standard_request')}
              </Text>
              <Text className="text-xs opacity-75 mt-0.5" style={{ color: colors.muted }}>
                {t('leave_standard_request_sub')}
              </Text>
            </View>
          </View>
          <ChevronRight size={18} color={colors.muted} />
        </TouchableOpacity>

        {/* Out Of Station Card */}
        <TouchableOpacity
          activeOpacity={0.7}
          onPress={() => navigation.navigate('OutOfStation')}
          className="flex-row items-center justify-between p-5 rounded-2xl border mb-4"
          style={{
            backgroundColor: colors.surface,
            borderColor: colors.border,
          }}
        >
          <View className="flex-row items-center gap-4">
            <View className="w-12 h-12 rounded-full items-center justify-center bg-amber-50 dark:bg-amber-950/20">
              <MapPin size={22} color="#F59E0B" />
            </View>
            <View className="flex-1 ml-1">
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
    </MainTemplate>
  );
}
