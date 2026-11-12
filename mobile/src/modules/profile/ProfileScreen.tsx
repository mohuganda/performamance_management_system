import React, { useState, useEffect } from 'react';
import { View, Text, ScrollView, RefreshControl, TouchableOpacity, Image, StyleSheet } from 'react-native';
import { useTranslation } from 'react-i18next';
import MapView, { Marker, Circle } from 'react-native-maps';
import { Camera, MapPin, Image as ImageIcon } from 'lucide-react-native';
import { useAuthStore } from '../../stores/authStore';
import { Button } from '../../components/atoms/Button';
import { Card } from '../../components/atoms/Card';
import { UserAvatar } from '../../components/atoms/UserAvatar';
import { Badge } from '../../components/atoms/Badge';
import { MainTemplate } from '../../components/templates';
import { useProfileSync, useUpdateProfileMutation } from '../../app/hooks/useProfile';
import { InteractiveSignaturePad } from '../../components/molecules/InteractiveSignaturePad';
import { pick, types } from '@react-native-documents/picker';
import { useTheme } from '../../app/hooks/useTheme';
import withObservables from '@nozbe/with-observables';
import { database } from '../../db/index';
import ProfileModel from '../../db/models/ProfileModel';
import { formatDateTime } from '../../utils/date';
import { resolveFileUrl } from '../../utils/fileUrl';
import { StaffDetail, AuthUser, AccountInfo } from '../../api/auth/types';

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

const cleanPrefix = (str?: string | null): string => {
  if (!str) return '—';
  if (str.includes('|')) {
    const parts = str.split('|');
    return parts.slice(1).join('|') || str;
  }
  return str;
};

interface InfoRowProps {
  label: string;
  value?: string | number | null;
  isLast?: boolean;
}

const InfoRow: React.FC<InfoRowProps> = ({ label, value, isLast = false }) => {
  const displayValue = value !== undefined && value !== null && value !== '' ? String(value) : '—';
  return (
    <View
      className={`flex-row justify-between items-center py-2.5 ${
        !isLast ? 'border-b border-gray-100 dark:border-zinc-800' : ''
      }`}
    >
      <Text className="text-sm font-medium text-gray-500 dark:text-gray-400 flex-1">{label}</Text>
      <Text className="text-sm font-semibold text-gray-900 dark:text-gray-100 text-right flex-1 ml-4">
        {displayValue}
      </Text>
    </View>
  );
};

function BaseProfileScreen({ dbProfile }: { dbProfile?: ProfileModel[] }) {
  const { t } = useTranslation();
  const { user, token } = useAuthStore();
  const { colors, isDark } = useTheme();
  const [signatureModalVisible, setSignatureModalVisible] = useState(false);
  const [signatureError, setSignatureError] = useState(false);

  // Background sync trigger
  const { data: syncData, isLoading, refetch, isFetching } = useProfileSync();
  const updateMutation = useUpdateProfileMutation();

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

  const activeDbProfile = dbProfile && dbProfile.length > 0 ? dbProfile[0] : null;

  let dbStaff: StaffDetail | null = null;
  let dbUser: AuthUser | null = null;
  let dbAccount: AccountInfo | null = null;
  let dbRoles: string[] | null = null;

  if (activeDbProfile) {
    try {
      if (activeDbProfile.staffData) dbStaff = JSON.parse(activeDbProfile.staffData);
      if (activeDbProfile.userData) dbUser = JSON.parse(activeDbProfile.userData);
      if (activeDbProfile.accountData) dbAccount = JSON.parse(activeDbProfile.accountData);
      if (activeDbProfile.roles) dbRoles = JSON.parse(activeDbProfile.roles);
    } catch (e) {
      console.warn('Failed to parse ProfileModel JSON', e);
    }
  }

  const staff = dbStaff || syncData?.staff;
  const account = dbAccount || syncData?.account;
  const currentUser: any = dbUser || syncData?.user || user;
  const roles: string[] = dbRoles || syncData?.roles || (currentUser?.Role ? [currentUser.Role] : []);

  const displayName = staff?.name || currentUser?.Name || t('profile_title');
  const userEmail = currentUser?.Email || staff?.email || '—';
  const isActive = account?.is_active ?? currentUser?.IsActive;

  useEffect(() => {
    setSignatureError(false);
  }, [currentUser?.SignatureImage]);

  // Geofence Map Coordinates
  const dutyStationLat = staff?.effective_duty_station?.latitude ?? staff?.facility_latitude;
  const dutyStationLng = staff?.effective_duty_station?.longitude ?? staff?.facility_longitude;
  const hasValidCoords =
    typeof dutyStationLat === 'number' &&
    typeof dutyStationLng === 'number' &&
    !isNaN(dutyStationLat) &&
    !isNaN(dutyStationLng) &&
    (dutyStationLat !== 0 || dutyStationLng !== 0);
  const radiusMeters = staff?.effective_duty_station?.radius_meters || 500;
  const dutyStationLabel =
    staff?.effective_duty_station?.label || staff?.facility_name || t('profile_duty_station');

  return (
    <>
      <ScrollView
        className="flex-1 bg-gray-50 dark:bg-zinc-950"
        contentContainerStyle={{ paddingBottom: 40 }}
        refreshControl={
          <RefreshControl
            refreshing={isFetching || isLoading}
            onRefresh={refetch}
            colors={[colors.primary]}
          />
        }
      >
        <View className="p-6 space-y-6">
          {/* User Card Header */}
          <Card className="items-center py-8">
            <TouchableOpacity
              onPress={handlePickPhoto}
              disabled={updateMutation.isPending}
              activeOpacity={0.8}
            >
              <View className="relative">
                <UserAvatar
                  photoUrl={currentUser?.ProfilePhoto}
                  name={displayName}
                  size="lg"
                  className="mb-4"
                />
                <View
                  className="absolute bottom-4 right-0 w-8 h-8 rounded-full items-center justify-center border-2 border-white dark:border-zinc-900"
                  style={{ backgroundColor: colors.primary }}
                >
                  <Camera size={14} color="#ffffff" />
                </View>
              </View>
            </TouchableOpacity>

            <Text className="text-xl font-bold text-gray-900 dark:text-gray-100 text-center">
              {displayName}
            </Text>
            <Text className="text-sm font-medium text-gray-500 dark:text-gray-400 mt-0.5 text-center">
              {userEmail}
            </Text>

            <View className="flex-row flex-wrap gap-2 justify-center mt-3">
              {roles.map((r, idx) => (
                <Badge key={idx} label={r} variant="info" />
              ))}
              {isActive !== undefined && (
                <Badge
                  label={isActive ? t('profile_status_active') : t('profile_status_inactive')}
                  variant={isActive ? 'success' : 'error'}
                />
              )}
            </View>
          </Card>

          {/* Electronic Signature Section */}
          <Card>
            <Text className="text-lg font-bold text-gray-800 dark:text-gray-100 mb-2">
              {t('profile_electronic_signature')}
            </Text>
            <Text className="text-sm text-gray-500 dark:text-gray-400 mb-4">
              {t('profile_electronic_signature_desc')}
            </Text>

            <View className="bg-gray-50 dark:bg-zinc-800 border border-gray-200 dark:border-zinc-700 rounded-none p-4 items-center justify-center min-h-[120px]">
              {currentUser?.SignatureImage && !signatureError ? (
                <Image
                  source={{
                    uri: resolveFileUrl(currentUser.SignatureImage)!,
                    headers: token ? { Authorization: `Bearer ${token}` } : undefined,
                  }}
                  style={{ width: '100%', height: 100 }}
                  resizeMode="contain"
                  onError={() => setSignatureError(true)}
                />
              ) : (
                <View className="items-center justify-center py-4">
                  <ImageIcon size={40} color="#9CA3AF" />
                  <Text className="text-gray-400 dark:text-gray-500 italic text-sm mt-2">
                    {t('profile_no_signature')}
                  </Text>
                </View>
              )}
            </View>

            {currentUser?.SignatureUpdatedAt && (
              <Text className="text-xs text-gray-400 dark:text-gray-500 mt-2 text-right">
                {t('profile_signature_updated')}: {formatDateTime(currentUser.SignatureUpdatedAt)}
              </Text>
            )}

            <Button
              title={
                currentUser?.SignatureImage
                  ? t('profile_update_signature')
                  : t('profile_draw_signature')
              }
              onPress={() => setSignatureModalVisible(true)}
              variant="secondary"
              className="mt-4"
              disabled={updateMutation.isPending}
            />
          </Card>

          {/* Biodata Section */}
          {staff && (
            <Card>
              <Text className="text-lg font-bold text-gray-800 dark:text-gray-100 mb-4">
                {t('profile_biodata_details')}
              </Text>
              <View className="space-y-1">
                <InfoRow label={t('profile_full_name')} value={staff.name} />
                <InfoRow label={t('profile_firstname')} value={staff.firstname} />
                <InfoRow label={t('profile_surname')} value={staff.surname} />
                <InfoRow label={t('profile_nin')} value={staff.nin} />
                <InfoRow label={t('profile_gender')} value={staff.gender} />
                <InfoRow label={t('profile_mobile')} value={staff.mobile} />
                <InfoRow label={t('profile_personal_email')} value={staff.email} />
                <InfoRow label={t('profile_ihris_pid')} value={cleanPrefix(staff.ihris_pid)} isLast />
              </View>
            </Card>
          )}

          {/* Employment & Position Section */}
          {staff && (
            <Card>
              <Text className="text-lg font-bold text-gray-800 dark:text-gray-100 mb-4">
                {t('profile_employment_deployment')}
              </Text>
              <View className="space-y-1">
                <InfoRow label={t('profile_job_title')} value={staff.job_title} />
                <InfoRow label={t('profile_cadre')} value={staff.cadre} />
                <InfoRow label={t('profile_department')} value={staff.department_name} />
                <InfoRow label={t('profile_hr_department')} value={staff.hr_department_name} />
                <InfoRow
                  label={t('profile_employment_terms')}
                  value={cleanPrefix(staff.employment_terms)}
                />
                <InfoRow label={t('profile_salary_grade')} value={staff.salary_grade} isLast />
              </View>
            </Card>
          )}

          {/* Facility & Duty Station Deployment */}
          {staff && (
            <Card>
              <Text className="text-lg font-bold text-gray-800 dark:text-gray-100 mb-4">
                {t('profile_facility_deployment')}
              </Text>
              <View className="space-y-1">
                <InfoRow label={t('profile_facility_name')} value={staff.facility_name} />
                <InfoRow label={t('profile_institution_type')} value={staff.institution_type} />
                <InfoRow label={t('profile_district')} value={staff.district_name} />
                <InfoRow label={t('profile_region')} value={staff.region} />
                <InfoRow
                  label={t('profile_duty_station')}
                  value={dutyStationLabel}
                />
                <InfoRow
                  label={t('profile_geofence_radius')}
                  value={
                    staff.effective_duty_station
                      ? `${staff.effective_duty_station.radius_meters}m (${staff.effective_duty_station.source})`
                      : `${radiusMeters}m`
                  }
                />
                <InfoRow
                  label={t('profile_ihris_last_sync')}
                  value={
                    staff.ihris_last_sync_at
                      ? formatDateTime(staff.ihris_last_sync_at)
                      : undefined
                  }
                  isLast={!hasValidCoords}
                />
              </View>

              {/* Duty Station Geofence Map */}
              {hasValidCoords && (
                <View className="mt-4 pt-4 border-t border-gray-100 dark:border-zinc-800">
                  <View className="flex-row justify-between items-center mb-2.5">
                    <View className="flex-row items-center">
                      <MapPin size={15} color={colors.primary} />
                      <Text className="text-xs font-bold uppercase tracking-wider text-gray-700 dark:text-gray-300 ml-1.5">
                        {t('profile_geofence_map')}
                      </Text>
                    </View>
                    <Badge
                      label={t('profile_geofence_meter_radius', { radius: radiusMeters })}
                      variant="success"
                    />
                  </View>

                  <View className="h-52 w-full rounded-none overflow-hidden border border-gray-200 dark:border-zinc-700 relative">
                    <MapView
                      style={StyleSheet.absoluteFill}
                      initialRegion={{
                        latitude: dutyStationLat!,
                        longitude: dutyStationLng!,
                        latitudeDelta: 0.015,
                        longitudeDelta: 0.015,
                      }}
                      scrollEnabled={true}
                      zoomEnabled={true}
                      pitchEnabled={false}
                      rotateEnabled={false}
                      userInterfaceStyle={isDark ? 'dark' : 'light'}
                    >
                      <Marker
                        coordinate={{
                          latitude: dutyStationLat!,
                          longitude: dutyStationLng!,
                        }}
                        title={dutyStationLabel}
                        description={t('profile_geofence_legend')}
                      >
                        <View className="items-center justify-center">
                          <View
                            className="w-7 h-7 rounded-full items-center justify-center border-2 border-white shadow-sm"
                            style={{ backgroundColor: colors.primary }}
                          >
                            <MapPin size={14} color="#FFFFFF" />
                          </View>
                          <View
                            className="w-3 h-3 -mt-2"
                            style={[styles.pinPoint, { backgroundColor: colors.primary }]}
                          />
                        </View>
                      </Marker>

                      <Circle
                        center={{
                          latitude: dutyStationLat!,
                          longitude: dutyStationLng!,
                        }}
                        radius={radiusMeters}
                        fillColor="rgba(16, 185, 129, 0.20)"
                        strokeColor="rgba(16, 185, 129, 0.85)"
                        strokeWidth={2}
                      />
                    </MapView>
                  </View>
                  <Text className="text-[11px] text-gray-400 dark:text-gray-500 mt-2 italic">
                    {t('profile_geofence_legend')}
                  </Text>
                </View>
              )}
            </Card>
          )}

          {/* Supervisory Approval Chain Section */}
          <Card>
            <Text className="text-lg font-bold text-gray-800 dark:text-gray-100 mb-4">
              {t('profile_supervisor_chain')}
            </Text>
            {staff?.supervisors && staff.supervisors.length > 0 ? (
              <View className="space-y-3">
                {staff.supervisors.map((sup, index) => (
                  <View
                    key={sup.sequence || index}
                    className={`flex-row items-center py-2.5 ${
                      index < staff.supervisors!.length - 1
                        ? 'border-b border-gray-100 dark:border-zinc-800'
                        : ''
                    }`}
                  >
                    <View className="w-7 h-7 rounded-full bg-blue-50 dark:bg-blue-950/40 items-center justify-center mr-3 border border-blue-100 dark:border-blue-900">
                      <Text className="text-xs font-bold text-blue-600 dark:text-blue-400">
                        {sup.sequence || index + 1}
                      </Text>
                    </View>
                    <View className="flex-1 mr-2">
                      <Text className="text-sm font-semibold text-gray-900 dark:text-gray-100">
                        {sup.supervisor_name}
                      </Text>
                      {sup.supervisor_job_title ? (
                        <Text className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                          {sup.supervisor_job_title}
                        </Text>
                      ) : null}
                    </View>
                  </View>
                ))}
              </View>
            ) : staff?.supervisor_name ? (
              <InfoRow label={t('profile_supervisor_name')} value={staff.supervisor_name} isLast />
            ) : (
              <Text className="text-sm text-gray-400 dark:text-gray-500 italic">
                {t('profile_no_supervisors')}
              </Text>
            )}
          </Card>

          {/* Account & Security Section */}
          <Card>
            <Text className="text-lg font-bold text-gray-800 dark:text-gray-100 mb-4">
              {t('profile_account_security')}
            </Text>
            <View className="space-y-1">
              <InfoRow label={t('profile_govnet_email')} value={currentUser?.Email} />
              <InfoRow
                label={t('profile_account_status')}
                value={
                  (account?.is_active ?? currentUser?.IsActive)
                    ? t('profile_status_active')
                    : t('profile_status_inactive')
                }
              />
              <InfoRow
                label={t('profile_totp_status')}
                value={
                  (account?.totp_enabled ?? currentUser?.TotpEnabled)
                    ? t('profile_status_enabled')
                    : t('profile_status_disabled')
                }
              />
              <InfoRow
                label={t('profile_last_login')}
                value={
                  account?.last_login_at || currentUser?.LastLoginAt
                    ? formatDateTime(account?.last_login_at || currentUser?.LastLoginAt)
                    : undefined
                }
              />
              <InfoRow
                label={t('profile_password_changed')}
                value={
                  account?.password_changed_at || currentUser?.PasswordChangedAt
                    ? formatDateTime(account?.password_changed_at || currentUser?.PasswordChangedAt)
                    : undefined
                }
              />
              <InfoRow
                label={t('profile_activation_completed')}
                value={
                  account?.activation_completed_at
                    ? formatDateTime(account.activation_completed_at)
                    : undefined
                }
              />
              <InfoRow
                label={t('profile_must_change_password')}
                value={
                  (account?.must_change_password ?? currentUser?.MustChangePassword)
                    ? t('profile_yes')
                    : t('profile_no')
                }
                isLast
              />
            </View>
          </Card>
        </View>
      </ScrollView>

      {/* Signature Pad Modal */}
      <InteractiveSignaturePad
        visible={signatureModalVisible}
        onClose={() => setSignatureModalVisible(false)}
        onOK={handleSignatureSave}
      />
    </>
  );
}

const styles = StyleSheet.create({
  pinPoint: {
    transform: [{ rotate: '45deg' }],
    zIndex: -1,
  },
});

const ProfileDataObserver = withObservables([], () => ({
  dbProfile: database.collections.get<ProfileModel>('profiles').query().observe(),
}))(BaseProfileScreen);

export const ProfileScreen = () => {
  const { t } = useTranslation();
  return (
    <MainTemplate title={t('profile_title')} showBack={true}>
      <ProfileDataObserver />
    </MainTemplate>
  );
};
