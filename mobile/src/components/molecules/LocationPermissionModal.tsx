import React from 'react';
import { View, Text, Modal, TouchableOpacity } from 'react-native';
import { useTranslation } from 'react-i18next';
import { MapPin, ShieldAlert } from 'lucide-react-native';
import { useTheme } from '../../app/hooks/useTheme';

interface LocationPermissionModalProps {
  isVisible: boolean;
  isBlocked: boolean;
  onCancel: () => void;
  onConfirm: () => void;
}

export function LocationPermissionModal({
  isVisible,
  isBlocked,
  onCancel,
  onConfirm,
}: LocationPermissionModalProps) {
  const { t } = useTranslation();
  const { colors, isDark } = useTheme();

  return (
    <Modal
      visible={isVisible}
      transparent
      animationType="fade"
      statusBarTranslucent
    >
      <View className="flex-1 justify-center items-center bg-black/60 px-6">
        <View 
          className="w-full max-w-sm rounded-2xl p-6 shadow-xl"
          style={{ backgroundColor: colors.surface }}
        >
          {/* Header Icon */}
          <View className="items-center mb-4">
            <View 
              className="w-16 h-16 rounded-full items-center justify-center mb-2"
              style={{ backgroundColor: isBlocked ? `${colors.error}15` : `${colors.primary}15` }}
            >
              {isBlocked ? (
                <ShieldAlert size={32} color={colors.error} />
              ) : (
                <MapPin size={32} color={colors.primary} />
              )}
            </View>
          </View>

          {/* Dialog Title */}
          <Text 
            className="text-xl font-bold text-center mb-3"
            style={{ color: colors.text }}
          >
            {isBlocked
              ? t('permission_location_blocked_title')
              : t('permission_location_title')}
          </Text>

          {/* Dialog Body Text */}
          <Text 
            className="text-center text-sm leading-relaxed mb-6"
            style={{ color: isDark ? '#A1A1AA' : '#4B5563' }}
          >
            {isBlocked
              ? t('permission_location_blocked_desc')
              : t('permission_location_desc')}
          </Text>

          {/* Action Button layout */}
          <View className="flex-col gap-2">
            <TouchableOpacity
              onPress={onConfirm}
              className="py-3.5 rounded-xl justify-center items-center font-bold"
              style={{ backgroundColor: isBlocked ? colors.error : colors.primary }}
            >
              <Text className="text-white font-bold text-base">
                {isBlocked
                  ? t('permission_btn_settings')
                  : t('permission_btn_grant')}
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              onPress={onCancel}
              className="py-3 rounded-xl justify-center items-center"
            >
              <Text 
                className="font-semibold text-sm"
                style={{ color: isDark ? '#A1A1AA' : '#6B7280' }}
              >
                {t('permission_btn_cancel')}
              </Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
}
