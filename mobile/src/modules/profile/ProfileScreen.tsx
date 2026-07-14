import React from 'react';
import { View, Text, ScrollView, RefreshControl } from 'react-native';
import { useQuery } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { useAuthStore } from '../../stores/authStore';
import { Button } from '../../components/atoms/Button';
import { Card } from '../../components/atoms/Card';
import { UserAvatar } from '../../components/atoms/UserAvatar';
import { Badge } from '../../components/atoms/Badge';
import { MainTemplate } from '../../components/templates';
import apiClient from '../../api/client';
import { colors } from '../../theme/colors';

export function ProfileScreen() {
  const { t } = useTranslation();
  const { logout, user } = useAuthStore();

  const { data: profile, isLoading, refetch, isFetching } = useQuery({
    queryKey: ['profile-me'],
    queryFn: async () => {
      const res = await apiClient.get('/auth/me');
      return res.data;
    },
  });

  const handleSignOut = async () => {
    await logout();
  };

  const staff = profile?.staff;
  const contract = staff?.Contracts?.[0] || staff?.contracts?.[0];
  const supervisors = contract?.Supervisors || contract?.supervisors || [];

  return (
    <MainTemplate title={t('profile_title')} showBack={true}>
      <ScrollView
        className="flex-1"
        refreshControl={
          <RefreshControl refreshing={isFetching} onRefresh={refetch} colors={[colors.primary.DEFAULT]} />
        }
      >
        <View className="p-6 space-y-6">
          
          {/* User Card Header */}
          <Card className="items-center py-8">
            <UserAvatar
              photoUrl={user?.profile_photo}
              name={user?.name || 'MoH User'}
              size="lg"
              className="mb-4"
            />
            <Text className="text-xl font-bold text-gray-900">{user?.name}</Text>
            <Text className="text-sm font-medium text-gray-500 mt-0.5">{user?.email}</Text>
            <Badge label={user?.role || t('staff')} variant="info" className="mt-3" />
          </Card>

          {/* Biodata Section */}
          {staff && (
            <Card>
              <Text className="text-lg font-bold text-gray-800 mb-4">{t('profile_biodata_details')}</Text>
              <View className="space-y-3">
                <View className="flex-row justify-between border-b border-gray-50 pb-2">
                  <Text className="text-sm font-medium text-gray-500">{t('profile_gender')}</Text>
                  <Text className="text-sm font-semibold text-gray-900 capitalize">
                    {staff.Gender || staff.gender || '—'}
                  </Text>
                </View>
                <View className="flex-row justify-between border-b border-gray-50 pb-2">
                  <Text className="text-sm font-medium text-gray-500">{t('profile_mobile')}</Text>
                  <Text className="text-sm font-semibold text-gray-900">
                    {staff.Mobile || staff.mobile || '—'}
                  </Text>
                </View>
                <View className="flex-row justify-between border-b border-gray-50 pb-2">
                  <Text className="text-sm font-medium text-gray-500">{t('profile_ipps')}</Text>
                  <Text className="text-sm font-semibold text-gray-900 uppercase">
                    {staff.Ipps || staff.ipps || '—'}
                  </Text>
                </View>
                <View className="flex-row justify-between">
                  <Text className="text-sm font-medium text-gray-500">{t('profile_cadre')}</Text>
                  <Text className="text-sm font-semibold text-gray-900">
                    {staff.Cadre || staff.cadre || '—'}
                  </Text>
                </View>
              </View>
            </Card>
          )}

          {/* Contract Section */}
          {contract && (
            <Card>
              <Text className="text-lg font-bold text-gray-800 mb-4">{t('profile_employment_deployment')}</Text>
              <View className="space-y-3">
                <View className="flex-row justify-between border-b border-gray-50 pb-2">
                  <Text className="text-sm font-medium text-gray-500">{t('profile_facility')}</Text>
                  <Text className="text-sm font-semibold text-gray-900 text-right flex-1 ml-4">
                    {contract.Facility?.Name || contract.facility?.name || '—'}
                  </Text>
                </View>
                <View className="flex-row justify-between border-b border-gray-50 pb-2">
                  <Text className="text-sm font-medium text-gray-500">{t('profile_job_title')}</Text>
                  <Text className="text-sm font-semibold text-gray-900 text-right flex-1 ml-4">
                    {contract.Job?.JobTitle || contract.job?.job_title || '—'}
                  </Text>
                </View>
                <View className="flex-row justify-between border-b border-gray-50 pb-2">
                  <Text className="text-sm font-medium text-gray-500">{t('profile_department')}</Text>
                  <Text className="text-sm font-semibold text-gray-900">
                    {contract.Department?.Name || contract.department?.name || '—'}
                  </Text>
                </View>
                <View className="flex-row justify-between">
                  <Text className="text-sm font-medium text-gray-500">{t('profile_salary_grade')}</Text>
                  <Text className="text-sm font-semibold text-gray-900 uppercase">
                    {contract.SalaryGrade || contract.salary_grade || '—'}
                  </Text>
                </View>
              </View>
            </Card>
          )}

          {/* Supervisors Section */}
          {supervisors.length > 0 && (
            <Card>
              <Text className="text-lg font-bold text-gray-800 mb-4">{t('profile_supervisor_chain')}</Text>
              <View className="space-y-4">
                {supervisors
                  .sort((a: any, b: any) => a.ApprovalSequence - b.ApprovalSequence)
                  .map((sup: any, index: number) => (
                    <View key={index} className="flex-row items-center">
                      <View className="w-8 h-8 rounded-full bg-gray-100 items-center justify-center mr-3">
                        <Text className="text-sm font-bold text-primary">
                          {sup.ApprovalSequence || sup.approval_sequence || index + 1}
                        </Text>
                      </View>
                      <View className="flex-1">
                        <Text className="text-sm font-semibold text-gray-900">
                          {sup.SupervisorStaff?.Name || sup.supervisor_staff?.Name || 'Supervisor'}
                        </Text>
                        <Text className="text-xs text-gray-500">
                          {sup.SupervisorStaff?.Email || sup.supervisor_staff?.Email || ''}
                        </Text>
                      </View>
                    </View>
                  ))}
              </View>
            </Card>
          )}

          {/* Logout Control */}
          <Button
            title={t('profile_sign_out')}
            onPress={handleSignOut}
            variant="danger"
            className="mt-4"
          />

        </View>
      </ScrollView>
    </MainTemplate>
  );
}
