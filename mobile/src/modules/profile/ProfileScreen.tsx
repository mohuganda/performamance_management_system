import React, { useState } from 'react';
import { View, Text, ScrollView, RefreshControl, TouchableOpacity, Image } from 'react-native';
import { useTranslation } from 'react-i18next';
import { useAuthStore } from '../../stores/authStore';
import { Button } from '../../components/atoms/Button';
import { Card } from '../../components/atoms/Card';
import { UserAvatar } from '../../components/atoms/UserAvatar';
import { Badge } from '../../components/atoms/Badge';
import { MainTemplate } from '../../components/templates';
import { useProfileQuery, useUpdateProfileMutation } from '../../app/hooks/useProfile';
import { InteractiveSignaturePad } from '../../components/molecules/InteractiveSignaturePad';
import { pick, types } from '@react-native-documents/picker';
import { colors } from '../../theme/colors';

const fileUriToBase64 = async (uri: string): Promise<string> => {
  const response = await fetch(uri);
  const blob = await response.blob();
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = reject;
    reader.onload = () => {
      resolve(String(reader.result));
    };
    reader.readAsDataURL(blob);
  });
};

export function ProfileScreen() {
  const { t } = useTranslation();
  const { logout, user } = useAuthStore();
  const [signatureModalVisible, setSignatureModalVisible] = useState(false);

  const { data: profile, isLoading, refetch, isFetching } = useProfileQuery();
  const updateMutation = useUpdateProfileMutation();

  const handleSignOut = async () => {
    await logout();
  };

  const handlePickPhoto = async () => {
    try {
      const res = await pick({
        type: [types.images],
        allowMultiSelection: false,
      });
      if (res && res[0]) {
        const base64 = await fileUriToBase64(res[0].uri);
        updateMutation.mutate({ profile_photo: base64 });
      }
    } catch (err: any) {
      // User cancelled or error
    }
  };

  const handleSignatureSave = (signatureDataUrl: string) => {
    updateMutation.mutate({ signature_image: signatureDataUrl });
  };

  // We merge authStore user and fetched profile user
  const currentUser: any = profile?.user || user;
  const staff = profile?.staff;

  return (
    <MainTemplate title={t('profile_title')} showBack={true}>
      <ScrollView
        className="flex-1"
        refreshControl={
          <RefreshControl refreshing={isFetching || isLoading} onRefresh={refetch} colors={[colors.primary.DEFAULT]} />
        }
      >
        <View className="p-6 space-y-6">

          {/* User Card Header */}
          <Card className="items-center py-8">
            <TouchableOpacity onPress={handlePickPhoto} disabled={updateMutation.isPending} activeOpacity={0.8}>
              <View className="relative">
                <UserAvatar
                  photoUrl={currentUser?.ProfilePhoto}
                  name={currentUser?.Name || 'MoH User'}
                  size="lg"
                  className="mb-4"
                />
                <View className="absolute bottom-4 right-0 bg-primary w-8 h-8 rounded-full items-center justify-center border-2 border-white dark:border-gray-900">
                  <Text className="text-white text-lg">+</Text>
                </View>
              </View>
            </TouchableOpacity>

            <Text className="text-xl font-bold text-gray-900 dark:text-gray-100">{currentUser?.Name}</Text>
            <Text className="text-sm font-medium text-gray-500 dark:text-gray-400 mt-0.5">{currentUser?.Email}</Text>
            <Badge label={currentUser?.Role || t('staff')} variant="info" className="mt-3 self-center" />
          </Card>

          {/* Electronic Signature Section */}
          <Card>
            <Text className="text-lg font-bold text-gray-800 dark:text-gray-100 mb-2">{t('profile_electronic_signature')}</Text>
            <Text className="text-sm text-gray-500 dark:text-gray-400 mb-4">
              {t('profile_electronic_signature_desc')}
            </Text>

            <View className="bg-gray-50 dark:bg-gray-500 border border-gray-200 dark:border-gray-800 rounded-none p-4 items-center justify-center min-h-[120px]">
              {currentUser?.SignatureImage ? (
                <Image
                  source={{ uri: currentUser.SignatureImage }}
                  style={{ width: '100%', height: 100 }}
                  resizeMode="contain"
                />
              ) : (
                <Text className="text-gray-400 dark:text-gray-500 italic">{t('profile_no_signature')}</Text>
              )}
            </View>

            <Button
              title={currentUser?.SignatureImage ? t('profile_update_signature') : t('profile_draw_signature')}
              onPress={() => setSignatureModalVisible(true)}
              variant="secondary"
              className="mt-4"
              disabled={updateMutation.isPending}
            />
          </Card>

          {/* Biodata Section */}
          {staff && (
            <Card>
              <Text className="text-lg font-bold text-gray-800 dark:text-gray-100 mb-4">{t('profile_biodata_details')}</Text>
              <View className="space-y-3">
                <View className="flex-row justify-between border-b border-gray-50 dark:border-gray-800 pb-2">
                  <Text className="text-sm font-medium text-gray-500 dark:text-gray-400">{t('profile_gender')}</Text>
                  <Text className="text-sm font-semibold text-gray-900 dark:text-gray-100 capitalize">
                    {staff.gender || '—'}
                  </Text>
                </View>
                <View className="flex-row justify-between border-b border-gray-50 dark:border-gray-800 pb-2">
                  <Text className="text-sm font-medium text-gray-500 dark:text-gray-400">{t('profile_mobile')}</Text>
                  <Text className="text-sm font-semibold text-gray-900 dark:text-gray-100">
                    {staff.mobile || '—'}
                  </Text>
                </View>
                <View className="flex-row justify-between border-b border-gray-50 dark:border-gray-800 pb-2">
                  <Text className="text-sm font-medium text-gray-500 dark:text-gray-400">{t('profile_ipps')}</Text>
                  <Text className="text-sm font-semibold text-gray-900 dark:text-gray-100 uppercase">
                    {staff.ipps || '—'}
                  </Text>
                </View>
                <View className="flex-row justify-between">
                  <Text className="text-sm font-medium text-gray-500 dark:text-gray-400">{t('profile_cadre')}</Text>
                  <Text className="text-sm font-semibold text-gray-900 dark:text-gray-100">
                    {staff.cadre || '—'}
                  </Text>
                </View>
              </View>
            </Card>
          )}

          {/* Contract Section */}
          {staff && (
            <Card>
              <Text className="text-lg font-bold text-gray-800 dark:text-gray-100 mb-4">{t('profile_employment_deployment')}</Text>
              <View className="space-y-3">
                <View className="flex-row justify-between border-b border-gray-50 dark:border-gray-800 pb-2">
                  <Text className="text-sm font-medium text-gray-500 dark:text-gray-400">{t('profile_facility')}</Text>
                  <Text className="text-sm font-semibold text-gray-900 dark:text-gray-100 text-right flex-1 ml-4">
                    {staff.facility_name || '—'}
                  </Text>
                </View>
                <View className="flex-row justify-between border-b border-gray-50 dark:border-gray-800 pb-2">
                  <Text className="text-sm font-medium text-gray-500 dark:text-gray-400">{t('profile_job_title')}</Text>
                  <Text className="text-sm font-semibold text-gray-900 dark:text-gray-100 text-right flex-1 ml-4">
                    {staff.job_title || '—'}
                  </Text>
                </View>
                <View className="flex-row justify-between border-b border-gray-50 dark:border-gray-800 pb-2">
                  <Text className="text-sm font-medium text-gray-500 dark:text-gray-400">{t('profile_department')}</Text>
                  <Text className="text-sm font-semibold text-gray-900 dark:text-gray-100">
                    {staff.department_name || '—'}
                  </Text>
                </View>
                <View className="flex-row justify-between">
                  <Text className="text-sm font-medium text-gray-500 dark:text-gray-400">{t('profile_salary_grade')}</Text>
                  <Text className="text-sm font-semibold text-gray-900 dark:text-gray-100 uppercase">
                    {staff.salary_grade || '—'}
                  </Text>
                </View>
              </View>
            </Card>
          )}

        </View>
      </ScrollView>

      {/* Signature Pad Modal */}
      <InteractiveSignaturePad
        visible={signatureModalVisible}
        onClose={() => setSignatureModalVisible(false)}
        onOK={handleSignatureSave}
      />

    </MainTemplate>
  );
}
