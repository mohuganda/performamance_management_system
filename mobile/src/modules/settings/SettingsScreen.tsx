import React, { useState } from 'react';
import { View, Text, Switch, TouchableOpacity, ScrollView, Alert } from 'react-native';
import { useTheme } from '../../app/hooks/useTheme';
import { MainTemplate } from '../../components/templates';
import { Bell, ShieldCheck, Database, RefreshCw, ChevronRight } from 'lucide-react-native';

export function SettingsScreen() {
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
      Alert.alert('Data Synced', 'All local attendance logs and leave requests have been successfully uploaded to the central iHRIS server.');
    }, 1500);
  };

  return (
    <MainTemplate title="Settings" showBack={true}>
      <ScrollView className="flex-1" contentContainerStyle={{ padding: 16 }}>
        <Text className="text-xs font-bold uppercase tracking-wider mb-4" style={{ color: colors.muted }}>
          App Customization & Security
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
                  Push Notifications
                </Text>
                <Text className="text-xs opacity-75 mt-0.5" style={{ color: colors.muted }}>
                  Get alerts for targets & leave status
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
                  Biometric Authentication
                </Text>
                <Text className="text-xs opacity-75 mt-0.5" style={{ color: colors.muted }}>
                  Unlock app with FaceID or Fingerprint
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
                  Background Sync
                </Text>
                <Text className="text-xs opacity-75 mt-0.5" style={{ color: colors.muted }}>
                  Auto-sync data when connected to Wi-Fi
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
                  {syncing ? 'Syncing Server Logs...' : 'Sync Local Records Now'}
                </Text>
                <Text className="text-xs opacity-75 mt-0.5" style={{ color: colors.muted }}>
                  Force immediate upload of local entries
                </Text>
              </View>
            </View>
            <ChevronRight size={18} color={colors.muted} />
          </TouchableOpacity>
        </View>

        {/* App Info Group */}
        <Text className="text-xs font-bold uppercase tracking-wider mb-4" style={{ color: colors.muted }}>
          Application Details
        </Text>
        <View
          className="border rounded-2xl p-4"
          style={{
            backgroundColor: colors.surface,
            borderColor: colors.border,
          }}
        >
          <View className="flex-row justify-between border-b pb-3 mb-3" style={{ borderBottomColor: colors.border }}>
            <Text className="text-sm font-semibold" style={{ color: colors.muted }}>Ministry Branch</Text>
            <Text className="text-sm font-bold" style={{ color: colors.text }}>MoH Uganda - iHRIS</Text>
          </View>
          <View className="flex-row justify-between border-b pb-3 mb-3" style={{ borderBottomColor: colors.border }}>
            <Text className="text-sm font-semibold" style={{ color: colors.muted }}>App Environment</Text>
            <Text className="text-sm font-bold" style={{ color: colors.text }}>Production</Text>
          </View>
          <View className="flex-row justify-between">
            <Text className="text-sm font-semibold" style={{ color: colors.muted }}>App Build Version</Text>
            <Text className="text-sm font-bold" style={{ color: colors.text }}>1.0.0 (Build 24)</Text>
          </View>
        </View>
      </ScrollView>
    </MainTemplate>
  );
}
