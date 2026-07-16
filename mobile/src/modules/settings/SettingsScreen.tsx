import React, { useState } from 'react';
import { ScrollView, Alert, StyleSheet } from 'react-native';
import { useTranslation } from 'react-i18next';
import { MainTemplate } from '../../components/templates';
import { Bell, ShieldCheck, Database, RefreshCw } from 'lucide-react-native';
import { SettingsSection } from '../../components/molecules/SettingsSection';
import { SettingsRow } from '../../components/molecules/SettingsRow';

export function SettingsScreen() {
  const { t } = useTranslation();

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
      <ScrollView className="flex-1" contentContainerStyle={styles.scrollContent}>
        {/* Customization & Security Group */}
        <SettingsSection title={t('settings_customization_security')}>
          <SettingsRow
            label={t('settings_push_notifications')}
            subtitle={t('settings_push_notifications_sub')}
            icon={Bell}
            type="toggle"
            value={pushEnabled}
            onValueChange={setPushEnabled}
            isLast={true}
          />
        </SettingsSection>

        {/* Security Section (Biometrics) */}
        <SettingsSection>
          <SettingsRow
            label={t('settings_biometrics')}
            subtitle={t('settings_biometrics_sub')}
            icon={ShieldCheck}
            type="toggle"
            value={biometricsEnabled}
            onValueChange={setBiometricsEnabled}
            isLast={true}
          />
        </SettingsSection>

        {/* Synchronization Section */}
        <SettingsSection>
          <SettingsRow
            label={t('settings_background_sync')}
            subtitle={t('settings_background_sync_sub')}
            icon={Database}
            type="toggle"
            value={backgroundSync}
            onValueChange={setBackgroundSync}
          />
          <SettingsRow
            label={syncing ? t('settings_syncing_logs') : t('settings_sync_now')}
            subtitle={t('settings_sync_now_sub')}
            icon={RefreshCw}
            type="link"
            onPress={handleManualSync}
            loading={syncing}
            isLast={true}
          />
        </SettingsSection>

        {/* App Info Section */}
        <SettingsSection title={t('settings_application_details')}>
          <SettingsRow
            label={t('settings_build_version')}
            infoValue="1.0.0 (Build 24)"
            type="info"
            isLast={true}
          />
        </SettingsSection>
      </ScrollView>
    </MainTemplate>
  );
}

const styles = StyleSheet.create({
  scrollContent: {
    padding: 16,
  },
});
