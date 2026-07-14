import React, { useState } from 'react';
import { View, Text, TouchableOpacity, Modal, Pressable, StyleSheet } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { Settings, Palette, LogOut, ChevronRight, Check } from 'lucide-react-native';
import { useAuthStore } from '../../stores/authStore';
import { useThemeStore } from '../../app/store/useThemeStore';
import { useTheme } from '../../app/hooks/useTheme';
import { LayoutTemplate } from '../../components/templates/LayoutTemplate';
import { UserProfilePicture } from '../../components/molecules/UserAvatar';
import { Badge } from '../../components/atoms/Badge';

export function AccountScreen() {
  const navigation = useNavigation<any>();
  const { logout, user } = useAuthStore();
  const { themeMode, setThemeMode } = useThemeStore();
  const { colors } = useTheme();

  const [themeModalVisible, setThemeModalVisible] = useState(false);

  const handleLogout = async () => {
    await logout();
  };

  const getThemeModeLabel = (mode: string) => {
    switch (mode) {
      case 'light':
        return 'Light Mode';
      case 'dark':
        return 'Dark Mode';
      case 'system':
      default:
        return 'System Default';
    }
  };

  return (
    <LayoutTemplate>
      <View className="flex-1">
        {/* Banner Section */}
        <TouchableOpacity
          activeOpacity={0.9}
          onPress={() => navigation.navigate('Profile')}
          className="p-6 pb-8 rounded-b-[32px] border-b"
          style={{
            backgroundColor: colors.surface,
            borderBottomColor: colors.border,
          }}
        >
          <View className="flex-row items-center gap-4 mt-4">
            <UserProfilePicture uri={user?.profile_photo} size={64} />
            <View className="flex-1 ml-1">
              <Text className="text-xl font-black" style={{ color: colors.text }}>
                {user?.name || 'Officer'}
              </Text>
              <Text className="text-sm font-medium opacity-75 mt-0.5" style={{ color: colors.muted }}>
                {user?.email}
              </Text>
              <View className="flex-row mt-2">
                <Badge label={user?.role || 'Staff'} variant="info" />
              </View>
            </View>
            <ChevronRight size={20} color={colors.muted} />
          </View>
        </TouchableOpacity>

        {/* Menu Cards */}
        <View className="p-6 flex-1">
          <Text className="text-xs font-bold uppercase tracking-wider mb-4" style={{ color: colors.muted }}>
            Settings & Preference
          </Text>

          {/* Settings Card */}
          <TouchableOpacity
            activeOpacity={0.7}
            onPress={() => navigation.navigate('Settings')}
            className="flex-row items-center justify-between p-4 rounded-2xl border mb-4"
            style={{
              backgroundColor: colors.surface,
              borderColor: colors.border,
            }}
          >
            <View className="flex-row items-center gap-3">
              <View className="w-10 h-10 rounded-full items-center justify-center" style={{ backgroundColor: colors.border + '33' }}>
                <Settings size={20} color={colors.text} />
              </View>
              <View className="ml-1">
                <Text className="text-base font-bold" style={{ color: colors.text }}>
                  Settings
                </Text>
                <Text className="text-xs opacity-75 mt-0.5" style={{ color: colors.muted }}>
                  Manage notifications and sync settings
                </Text>
              </View>
            </View>
            <ChevronRight size={18} color={colors.muted} />
          </TouchableOpacity>

          {/* Theme Card */}
          <TouchableOpacity
            activeOpacity={0.7}
            onPress={() => setThemeModalVisible(true)}
            className="flex-row items-center justify-between p-4 rounded-2xl border mb-4"
            style={{
              backgroundColor: colors.surface,
              borderColor: colors.border,
            }}
          >
            <View className="flex-row items-center gap-3">
              <View className="w-10 h-10 rounded-full items-center justify-center" style={{ backgroundColor: colors.border + '33' }}>
                <Palette size={20} color={colors.text} />
              </View>
              <View className="ml-1">
                <Text className="text-base font-bold" style={{ color: colors.text }}>
                  App Theme
                </Text>
                <Text className="text-xs opacity-75 mt-0.5" style={{ color: colors.muted }}>
                  {getThemeModeLabel(themeMode)}
                </Text>
              </View>
            </View>
            <ChevronRight size={18} color={colors.muted} />
          </TouchableOpacity>

          {/* Logout Card */}
          <TouchableOpacity
            activeOpacity={0.7}
            onPress={handleLogout}
            className="flex-row items-center justify-between p-4 rounded-2xl border mt-6"
            style={{
              backgroundColor: colors.surface,
              borderColor: colors.border,
            }}
          >
            <View className="flex-row items-center gap-3">
              <View className="w-10 h-10 rounded-full items-center justify-center bg-red-50 dark:bg-red-950/20">
                <LogOut size={20} color={colors.error} />
              </View>
              <View className="ml-1">
                <Text className="text-base font-bold" style={{ color: colors.error }}>
                  Sign Out
                </Text>
                <Text className="text-xs opacity-75 mt-0.5" style={{ color: colors.muted }}>
                  Sign out of your active session
                </Text>
              </View>
            </View>
            <ChevronRight size={18} color={colors.muted} />
          </TouchableOpacity>
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
                Choose App Theme
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
