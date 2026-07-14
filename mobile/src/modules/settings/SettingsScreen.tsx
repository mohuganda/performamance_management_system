import React, { useState } from 'react';
import { View, Text, Switch, TouchableOpacity, ScrollView, Alert } from 'react-native';
import { useTranslation } from 'react-i18next';
import { useTheme } from '../../app/hooks/useTheme';
import { MainTemplate } from '../../components/templates';
import { Bell, ShieldCheck, Database, RefreshCw, ChevronRight } from 'lucide-react-native';

export function SettingsScreen() {
  const { t } = useTranslation();
  const { colors } = useTheme();

  // Mock settings state
  const [pushEnabled, setPushEnabled] = useState(true);
  const [biometricsEnabled, setBiometricsEnabled] = useState(false);
  const [backgroundSync, setBackgroundSync] = useState(true);
  const [syncing, setSyncing] = useState(false);

  const handleManualSync = () => {
    setSyncing(true);
    setTimeout(() => {
      setSyncing(false);
      Alert.alert(t('settings_data_synced_title'), t('settings_data_synced_message'));
    }, 1500);
  };

  return (
    <MainTemplate title={t('settings_title')} showBack={true}>
      <ScrollView className="flex-1" contentContainerStyle={{ padding: 16 }}>
        <Text className="text-xs font-bold uppercase tracking-wider mb-4" style={{ color: colors.muted }}>
          {t('settings_customization_security')}
        </Text>

        {/* Notification Group */}
        <View
          className="border rounded-2xl p-4 mb-6"
          style={{
            backgroundColor: colors.surface,
            borderColor: colors.border,
          }}
        >
          <View className="flex-row items-center justify-between">
            <View className="flex-row items-center gap-3">
              <View className="w-9 h-9 rounded-full items-center justify-center" style={{ backgroundColor: colors.border + '33' }}>
                <Bell size={18} color={colors.text} />
              </View>
              <View className="ml-1">
                <Text className="text-base font-bold" style={{ color: colors.text }}>
                  {t('settings_push_notifications')}
                </Text>
                <Text className="text-xs opacity-75 mt-0.5" style={{ color: colors.muted }}>
                  {t('settings_push_notifications_sub')}
                </Text>
              </View>
            </View>
            <Switch
              value={pushEnabled}
              onValueChange={setPushEnabled}
              trackColor={{ false: '#767577', true: colors.primary }}
              thumbColor={pushEnabled ? '#FFFFFF' : '#f4f3f4'}
            />
          </View>
        </View>

        {/* Security Group */}
        <View
          className="border rounded-2xl p-4 mb-6"
          style={{
            backgroundColor: colors.surface,
            borderColor: colors.border,
          }}
        >
          <View className="flex-row items-center justify-between">
            <View className="flex-row items-center gap-3">
              <View className="w-9 h-9 rounded-full items-center justify-center" style={{ backgroundColor: colors.border + '33' }}>
                <ShieldCheck size={18} color={colors.text} />
              </View>
              <View className="ml-1">
                <Text className="text-base font-bold" style={{ color: colors.text }}>
                  {t('settings_biometrics')}
                </Text>
                <Text className="text-xs opacity-75 mt-0.5" style={{ color: colors.muted }}>
                  {t('settings_biometrics_sub')}
                </Text>
              </View>
            </View>
            <Switch
              value={biometricsEnabled}
              onValueChange={setBiometricsEnabled}
              trackColor={{ false: '#767577', true: colors.primary }}
              thumbColor={biometricsEnabled ? '#FFFFFF' : '#f4f3f4'}
            />
          </View>
        </View>

        {/* Synchronization Group */}
        <View
          className="border rounded-2xl p-4 mb-6"
          style={{
            backgroundColor: colors.surface,
            borderColor: colors.border,
          }}
        >
          {/* Background Sync Option */}
          <View className="flex-row items-center justify-between border-b pb-4 mb-4" style={{ borderBottomColor: colors.border }}>
            <View className="flex-row items-center gap-3">
              <View className="w-9 h-9 rounded-full items-center justify-center" style={{ backgroundColor: colors.border + '33' }}>
                <Database size={18} color={colors.text} />
              </View>
              <View className="ml-1">
                <Text className="text-base font-bold" style={{ color: colors.text }}>
                  {t('settings_background_sync')}
                </Text>
                <Text className="text-xs opacity-75 mt-0.5" style={{ color: colors.muted }}>
                  {t('settings_background_sync_sub')}
                </Text>
              </View>
            </View>
            <Switch
              value={backgroundSync}
              onValueChange={setBackgroundSync}
              trackColor={{ false: '#767577', true: colors.primary }}
              thumbColor={backgroundSync ? '#FFFFFF' : '#f4f3f4'}
            />
          </View>

          {/* Manual Trigger Option */}
          <TouchableOpacity
            activeOpacity={0.7}
            onPress={handleManualSync}
            disabled={syncing}
            className="flex-row items-center justify-between pt-1"
          >
            <View className="flex-row items-center gap-3">
              <View className="w-9 h-9 rounded-full items-center justify-center bg-zinc-50 dark:bg-zinc-800">
                <RefreshCw size={18} color={colors.text} className={syncing ? 'animate-spin' : ''} />
              </View>
              <View className="ml-1">
                <Text className="text-base font-bold" style={{ color: colors.text }}>
                  {syncing ? t('settings_syncing_logs') : t('settings_sync_now')}
                </Text>
                <Text className="text-xs opacity-75 mt-0.5" style={{ color: colors.muted }}>
                  {t('settings_sync_now_sub')}
                </Text>
              </View>
            </View>
            <ChevronRight size={18} color={colors.muted} />
          </TouchableOpacity>
        </View>

        {/* App Info Group */}
        <Text className="text-xs font-bold uppercase tracking-wider mb-4" style={{ color: colors.muted }}>
          {t('settings_application_details')}
        </Text>
        <View
          className="border rounded-2xl p-4"
          style={{
            backgroundColor: colors.surface,
            borderColor: colors.border,
          }}
        >
          <View className="flex-row justify-between border-b pb-3 mb-3" style={{ borderBottomColor: colors.border }}>
            <Text className="text-sm font-semibold" style={{ color: colors.muted }}>{t('settings_ministry_branch')}</Text>
            <Text className="text-sm font-bold" style={{ color: colors.text }}>{t('settings_ministry_branch_val')}</Text>
          </View>
          <View className="flex-row justify-between border-b pb-3 mb-3" style={{ borderBottomColor: colors.border }}>
            <Text className="text-sm font-semibold" style={{ color: colors.muted }}>{t('settings_environment')}</Text>
            <Text className="text-sm font-bold" style={{ color: colors.text }}>{t('settings_production')}</Text>
          </View>
          <View className="flex-row justify-between">
            <Text className="text-sm font-semibold" style={{ color: colors.muted }}>{t('settings_build_version')}</Text>
            <Text className="text-sm font-bold" style={{ color: colors.text }}>1.0.0 (Build 24)</Text>
          </View>
        </View>
      </ScrollView>
    </MainTemplate>
  );
}
