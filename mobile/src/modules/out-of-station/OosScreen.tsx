import React, { useState } from 'react';
import { View, Text, TouchableOpacity } from 'react-native';
import { useTranslation } from 'react-i18next';
import { MainTemplate } from '../../components/templates';
import { useTheme } from '../../app/hooks/useTheme';
import { useAuthStore } from '../../stores/authStore';
import { OosHistoryTab } from './components/OosHistoryTab';
import { OosRequestTab } from './components/OosRequestTab';
import { OosApprovalsTab } from './components/OosApprovalsTab';
import { FileText, MapPin, CheckSquare } from 'lucide-react-native';

export function OosScreen() {
  const { t } = useTranslation();
  const { colors } = useTheme();
  const { hasPermission } = useAuthStore();

  const canApprove = hasPermission('oos.requests.approve');
  const [activeTab, setActiveTab] = useState<'history' | 'apply' | 'approvals'>('history');

  return (
    <MainTemplate title={t('oos_title')} showBack={true}>
      <View className="flex-1">
        {/* Tab Selection Bar */}
        <View
          className="flex-row border-b justify-around items-center"
          style={{
            backgroundColor: colors.surface,
            borderBottomColor: colors.border,
          }}
        >
          {/* History Tab */}
          <TouchableOpacity
            onPress={() => setActiveTab('history')}
            className="flex-1 py-4 items-center justify-center border-b-2 flex-row gap-1.5"
            style={{
              borderBottomColor: activeTab === 'history' ? colors.primary : 'transparent',
            }}
          >
            <FileText size={16} color={activeTab === 'history' ? colors.primary : colors.muted} />
            <Text
              className="text-xs font-bold"
              style={{
                color: activeTab === 'history' ? colors.primary : colors.muted,
              }}
            >
              {t('oos_tab_history')}
            </Text>
          </TouchableOpacity>

          {/* New Application Tab */}
          <TouchableOpacity
            onPress={() => setActiveTab('apply')}
            className="flex-1 py-4 items-center justify-center border-b-2 flex-row gap-1.5"
            style={{
              borderBottomColor: activeTab === 'apply' ? colors.primary : 'transparent',
            }}
          >
            <MapPin size={16} color={activeTab === 'apply' ? colors.primary : colors.muted} />
            <Text
              className="text-xs font-bold"
              style={{
                color: activeTab === 'apply' ? colors.primary : colors.muted,
              }}
            >
              {t('oos_tab_apply')}
            </Text>
          </TouchableOpacity>

          {/* Approvals Tab (Only if supervisor has approvals permission) */}
          {canApprove && (
            <TouchableOpacity
              onPress={() => setActiveTab('approvals')}
              className="flex-1 py-4 items-center justify-center border-b-2 flex-row gap-1.5"
              style={{
                borderBottomColor: activeTab === 'approvals' ? colors.primary : 'transparent',
              }}
            >
              <CheckSquare size={16} color={activeTab === 'approvals' ? colors.primary : colors.muted} />
              <Text
                className="text-xs font-bold"
                style={{
                  color: activeTab === 'approvals' ? colors.primary : colors.muted,
                }}
              >
                {t('oos_tab_approvals')}
              </Text>
            </TouchableOpacity>
          )}
        </View>

        {/* Tab Contents View */}
        <View className="flex-1" style={{ backgroundColor: colors.background }}>
          {activeTab === 'history' && <OosHistoryTab />}
          {activeTab === 'apply' && <OosRequestTab onComplete={() => setActiveTab('history')} />}
          {activeTab === 'approvals' && canApprove && <OosApprovalsTab />}
        </View>
      </View>
    </MainTemplate>
  );
}
export default OosScreen;
