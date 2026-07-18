import React, { useState } from 'react';
import { View, Text, TouchableOpacity, Modal, Pressable, StyleSheet } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { Settings, Palette, LogOut, ChevronRight, Check } from 'lucide-react-native';
import { useTranslation } from 'react-i18next';
import { useAuthStore } from '../../stores/authStore';
import { showAlert } from '../../stores/alertStore';
import { useThemeStore } from '../../app/store/useThemeStore';
import { useTheme } from '../../app/hooks/useTheme';
import { LayoutTemplate } from '../../components/templates/LayoutTemplate';
import { UserProfilePicture } from '../../components/molecules/UserAvatar';
import { Badge } from '../../components/atoms/Badge';
import { QuickActionCard } from '../../components/organisms/home/QuickActionCard';

export function AccountScreen() {
  const { t } = useTranslation();
  const navigation = useNavigation<any>();
  const { logout, user } = useAuthStore();
  const { themeMode, setThemeMode } = useThemeStore();
  const { colors } = useTheme();

  const [themeModalVisible, setThemeModalVisible] = useState(false);

  const handleLogout = () => {
    showAlert({
      type: 'warning',
      title: t('account_sign_out', 'Sign Out'),
      message: t('account_sign_out_confirm', 'Are you sure you want to sign out of your account?'),
      cancelText: t('common_cancel', 'Cancel'),
      confirmText: t('account_sign_out', 'Sign Out'),
      onConfirm: async () => {
        await logout();
      }
    });
  };

  const getThemeModeLabel = (mode: string) => {
    switch (mode) {
      case 'light':
        return t('account_theme_light');
      case 'dark':
        return t('account_theme_dark');
      case 'system':
      default:
        return t('account_theme_system');
    }
  };

  return (
    <LayoutTemplate>
      <View className="flex-1">
        {/* Banner Section */}
        <TouchableOpacity
          activeOpacity={0.9}
          onPress={() => navigation.navigate('Profile')}
          className="p-6 pb-8 rounded-none border-b"
          style={{
            backgroundColor: colors.surface,
            borderBottomColor: colors.border,
          }}
        >
          <View className="flex-row items-center gap-4 mt-4">
            <UserProfilePicture uri={user?.ProfilePhoto} size={64} />
            <View className="ml-4 flex-1">
              <Text className="text-xl font-bold text-gray-900 mb-1" style={{ color: colors.text }}>
                {user?.Name || 'Officer'}
              </Text>
              <Text className="text-sm text-gray-500 mb-2" style={{ color: colors.muted }}>
                {user?.Email}
              </Text>
              <View className="self-start">
                <Badge label={user?.Role || t('staff')} variant="info" />
              </View>
            </View>
            <ChevronRight size={20} color={colors.muted} />
          </View>
        </TouchableOpacity>

        {/* Menu Cards */}
        <View className="p-6 flex-1">
          <Text className="text-xs font-bold uppercase tracking-wider mb-4" style={{ color: colors.muted }}>
            {t('account_settings_preference')}
          </Text>

          {/* Settings Card */}
          <View className="mb-4">
            <QuickActionCard
              title={t('account_settings')}
              subtitle={t('account_settings_sub')}
              Icon={Settings}
              iconColor={colors.text}
              iconBgClass="bg-gray-100 dark:bg-zinc-800"
              onPress={() => navigation.navigate('Settings')}
            />
          </View>

          {/* Theme Card */}
          <View className="mb-4">
            <QuickActionCard
              title={t('account_theme')}
              subtitle={getThemeModeLabel(themeMode)}
              Icon={Palette}
              iconColor={colors.text}
              iconBgClass="bg-gray-100 dark:bg-zinc-800"
              onPress={() => setThemeModalVisible(true)}
            />
          </View>

          {/* Logout Card */}
          <View className="mt-6">
            <QuickActionCard
              title={t('account_sign_out')}
              subtitle={t('account_sign_out_sub')}
              Icon={LogOut}
              iconColor={colors.error}
              iconBgClass="bg-red-50 dark:bg-red-950/20"
              onPress={handleLogout}
            />
          </View>
        </View>

        {/* Custom Bottom Sheet Theme Modal */}
        <Modal
          transparent
          visible={themeModalVisible}
          animationType="fade"
          onRequestClose={() => setThemeModalVisible(false)}
        >
          <View style={styles.modalOverlay}>
            <Pressable
              style={StyleSheet.absoluteFill}
              onPress={() => setThemeModalVisible(false)}
            />
            <View
              className="w-full rounded-t-[32px] p-6 border-t"
              style={{
                backgroundColor: colors.surface,
                borderColor: colors.border,
              }}
            >
              <View className="w-12 h-1 bg-gray-300 dark:bg-zinc-700 rounded-full self-center mx-auto mb-6" />
              <Text className="text-lg font-black mb-4 text-center" style={{ color: colors.text }}>
                {t('account_choose_theme')}
              </Text>

              {/* Theme choices */}
              <View className="mb-4">
                {['light', 'dark', 'system'].map((mode) => {
                  const active = themeMode === mode;
                  return (
                    <TouchableOpacity
                      key={mode}
                      activeOpacity={0.7}
                      onPress={() => {
                        setThemeMode(mode as any);
                        setThemeModalVisible(false);
                      }}
                      className="flex-row items-center justify-between p-4 rounded-xl border mb-3"
                      // eslint-disable-next-line react-native/no-inline-styles
                      style={{
                        backgroundColor: active ? colors.border + '22' : 'transparent',
                        borderColor: active ? colors.primary : colors.border,
                      }}
                    >
                      <Text className={`text-base ${active ? 'font-bold' : 'font-medium'}`} style={{ color: colors.text }}>
                        {getThemeModeLabel(mode)}
                      </Text>
                      {active && <Check size={20} color={colors.primary} />}
                    </TouchableOpacity>
                  );
                })}
              </View>
            </View>
          </View>
        </Modal>
      </View>
    </LayoutTemplate>
  );
}

const styles = StyleSheet.create({
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'flex-end',
    flexDirection: 'column',
  },
});
