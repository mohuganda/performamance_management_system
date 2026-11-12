import React, { useState, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { MapContainer, TileLayer, Marker, Circle } from 'react-leaflet';
import L from 'leaflet';
import { Camera, MapPin, Image as ImageIcon } from 'lucide-react';
import { MainTemplate } from '../../components/templates';
import { Card } from '../../components/atoms/Card';
import { Badge } from '../../components/atoms/Badge';
import { Button } from '../../components/atoms/Button';
import { UserAvatar } from '../../components/atoms/UserAvatar';
import { SignaturePadModal } from '../../components/molecules/SignaturePadModal';
import { useAuthStore } from '../../stores/authStore';
import { Toaster } from '../../utils/toast';
import { getApiErrorMessage } from '../../api/client';
import { useProfileQuery, useUpdateProfileMutation } from '../../hooks/useProfile';
import { useAuthenticatedImage } from '../../hooks/useAuthenticatedImage';
import { formatDateTime } from '../../utils/date';
import { StaffDetail, AuthUser, AccountInfo } from '../../api/auth/types';

const dutyStationPinIcon = L.divIcon({
  className: 'custom-duty-station-pin',
  html: `
    <div style="display:flex; flex-direction:column; align-items:center; transform: translate(-50%, -100%);">
      <div style="width:28px; height:28px; border-radius:50%; background:#059669; border:2px solid #FFFFFF; box-shadow:0 2px 4px rgba(0,0,0,0.4); display:flex; align-items:center; justify-content:center;">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2.5"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/><circle cx="12" cy="10" r="3"/></svg>
      </div>
      <div style="width:8px; height:8px; background:#059669; transform:rotate(45deg); margin-top:-4px;"></div>
    </div>
  `,
  iconSize: [28, 32],
  iconAnchor: [14, 32],
});

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
    <div
      className={`flex justify-between items-center py-2.5 ${
        !isLast ? 'border-b border-gray-100 dark:border-zinc-800' : ''
      }`}
    >
      <span className="text-sm font-medium text-gray-500 dark:text-gray-400 flex-1">{label}</span>
      <span className="text-sm font-semibold text-gray-900 dark:text-gray-100 text-right flex-1 ml-4 break-words">
        {displayValue}
      </span>
    </div>
  );
};

export const ProfileScreen: React.FC = () => {
  const { t } = useTranslation();
  const { user: authUser, roles: authRoles } = useAuthStore();

  const { data: profileData } = useProfileQuery();
  const updateProfileMutation = useUpdateProfileMutation();
  const isUpdating = updateProfileMutation.isPending;

  const [signatureModalVisible, setSignatureModalVisible] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const staff: StaffDetail | undefined = profileData?.staff;
  const account: AccountInfo | undefined = profileData?.account;
  const currentUser: AuthUser | null = profileData?.user || authUser;
  const roles: string[] = profileData?.roles || authRoles || (currentUser?.Role ? [currentUser.Role] : []);

  const displayName = staff?.name || currentUser?.Name || t('profile_title');
  const userEmail = currentUser?.Email || staff?.email || '—';
  const isActive = account?.is_active ?? currentUser?.IsActive;

  // Authenticated signature image
  const { src: signatureSrc, hasError: signatureError } = useAuthenticatedImage(currentUser?.SignatureImage);

  const handleSignatureSave = async (signatureDataUrl: string) => {
    updateProfileMutation.mutate(
      { signature_image: signatureDataUrl },
      {
        onSuccess: () => {
          Toaster.success(t('profile_update_success_desc'));
        },
        onError: (err) => {
          Toaster.error(getApiErrorMessage(err, t('profile_update_failed_desc')));
        },
      }
    );
  };

  const handlePhotoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = () => {
      const base64 = reader.result as string;
      updateProfileMutation.mutate(
        { profile_photo: base64 },
        {
          onSuccess: () => {
            Toaster.success(t('profile_update_success_desc'));
          },
          onError: (err) => {
            Toaster.error(getApiErrorMessage(err, t('profile_update_failed_desc')));
          },
        }
      );
    };
    reader.readAsDataURL(file);
  };

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
    <MainTemplate title={t('profile_title')} showBack>
      <div className="p-6 space-y-6">
        {/* User Card Header */}
        <Card className="flex flex-col items-center py-8 text-center">
          <input
            type="file"
            ref={fileInputRef}
            accept="image/*"
            className="hidden"
            onChange={handlePhotoUpload}
          />
          <div
            className="relative cursor-pointer group"
            onClick={() => fileInputRef.current?.click()}
          >
            <UserAvatar
              photoUrl={currentUser?.ProfilePhoto}
              name={displayName}
              size="lg"
              className="mb-4"
            />
            <div className="absolute bottom-4 right-0 bg-primary w-8 h-8 rounded-full flex items-center justify-center border-2 border-white dark:border-zinc-900 shadow text-white">
              <Camera size={14} color="#ffffff" />
            </div>
          </div>

          <h2 className="text-xl font-bold text-gray-900 dark:text-gray-100 text-center">
            {displayName}
          </h2>
          <p className="text-sm font-medium text-gray-500 dark:text-gray-400 mt-0.5 text-center">
            {userEmail}
          </p>

          <div className="flex flex-wrap gap-2 justify-center mt-3">
            {roles.map((r, idx) => (
              <Badge key={idx} label={r} variant="info" />
            ))}
            {isActive !== undefined && (
              <Badge
                label={isActive ? t('profile_status_active') : t('profile_status_inactive')}
                variant={isActive ? 'success' : 'error'}
              />
            )}
          </div>
        </Card>

        {/* Electronic Signature Section */}
        <Card>
          <h3 className="text-lg font-bold text-gray-800 dark:text-gray-100 mb-2">
            {t('profile_electronic_signature')}
          </h3>
          <p className="text-sm text-gray-500 dark:text-gray-400 mb-4">
            {t('profile_electronic_signature_desc')}
          </p>

          <div className="bg-gray-50 dark:bg-zinc-800 border border-gray-200 dark:border-zinc-700 rounded-none p-4 flex items-center justify-center min-h-[120px]">
            {signatureSrc && !signatureError ? (
              <img
                src={signatureSrc}
                alt="Electronic Signature"
                className="w-full h-[100px] object-contain"
              />
            ) : (
              <div className="flex flex-col items-center justify-center py-4 text-zinc-400 dark:text-zinc-500">
                <ImageIcon size={40} className="mb-2" />
                <span className="text-xs italic">
                  {t('profile_no_signature')}
                </span>
              </div>
            )}
          </div>

          {currentUser?.SignatureUpdatedAt && (
            <p className="text-xs text-gray-400 dark:text-gray-500 mt-2 text-right">
              {t('profile_signature_updated')}: {formatDateTime(currentUser.SignatureUpdatedAt)}
            </p>
          )}

          <Button
            title={
              currentUser?.SignatureImage
                ? t('profile_update_signature')
                : t('profile_draw_signature')
            }
            onClick={() => setSignatureModalVisible(true)}
            variant="secondary"
            className="w-full mt-4"
            disabled={isUpdating}
          >
            {currentUser?.SignatureImage
              ? t('profile_update_signature')
              : t('profile_draw_signature')}
          </Button>
        </Card>

        {/* Biodata Section */}
        {staff && (
          <Card>
            <h3 className="text-lg font-bold text-gray-800 dark:text-gray-100 mb-4">
              {t('profile_biodata_details')}
            </h3>
            <div className="space-y-1">
              <InfoRow label={t('profile_full_name')} value={staff.name} />
              <InfoRow label={t('profile_firstname')} value={staff.firstname} />
              <InfoRow label={t('profile_surname')} value={staff.surname} />
              <InfoRow label={t('profile_nin')} value={staff.nin} />
              <InfoRow label={t('profile_gender')} value={staff.gender} />
              <InfoRow label={t('profile_mobile')} value={staff.mobile} />
              <InfoRow label={t('profile_personal_email')} value={staff.email} />
              <InfoRow label={t('profile_ihris_pid')} value={cleanPrefix(staff.ihris_pid)} isLast />
            </div>
          </Card>
        )}

        {/* Employment & Position Section */}
        {staff && (
          <Card>
            <h3 className="text-lg font-bold text-gray-800 dark:text-gray-100 mb-4">
              {t('profile_employment_deployment')}
            </h3>
            <div className="space-y-1">
              <InfoRow label={t('profile_job_title')} value={staff.job_title} />
              <InfoRow label={t('profile_cadre')} value={staff.cadre} />
              <InfoRow label={t('profile_department')} value={staff.department_name} />
              <InfoRow label={t('profile_hr_department')} value={staff.hr_department_name} />
              <InfoRow
                label={t('profile_employment_terms')}
                value={cleanPrefix(staff.employment_terms)}
              />
              <InfoRow label={t('profile_salary_grade')} value={staff.salary_grade} isLast />
            </div>
          </Card>
        )}

        {/* Facility & Duty Station Deployment */}
        {staff && (
          <Card>
            <h3 className="text-lg font-bold text-gray-800 dark:text-gray-100 mb-4">
              {t('profile_facility_deployment')}
            </h3>
            <div className="space-y-1">
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
            </div>

            {/* Duty Station Geofence Map */}
            {hasValidCoords && (
              <div className="mt-4 pt-4 border-t border-gray-100 dark:border-zinc-800">
                <div className="flex justify-between items-center mb-2.5">
                  <div className="flex items-center text-primary">
                    <MapPin size={15} />
                    <span className="text-xs font-bold uppercase tracking-wider text-gray-700 dark:text-gray-300 ml-1.5">
                      {t('profile_geofence_map')}
                    </span>
                  </div>
                  <Badge
                    label={t('profile_geofence_meter_radius', { radius: radiusMeters })}
                    variant="success"
                  />
                </div>

                <div className="h-52 w-full rounded-none overflow-hidden border border-gray-200 dark:border-zinc-700 relative z-0">
                  <MapContainer
                    key={`${dutyStationLat}-${dutyStationLng}`}
                    center={[dutyStationLat!, dutyStationLng!]}
                    zoom={15}
                    scrollWheelZoom={false}
                    className="h-full w-full"
                  >
                    <TileLayer
                      attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
                      url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                    />
                    <Marker
                      position={[dutyStationLat!, dutyStationLng!]}
                      icon={dutyStationPinIcon}
                    />
                    <Circle
                      center={[dutyStationLat!, dutyStationLng!]}
                      radius={radiusMeters}
                      pathOptions={{
                        fillColor: '#10B981',
                        fillOpacity: 0.2,
                        color: '#059669',
                        weight: 2,
                      }}
                    />
                  </MapContainer>
                </div>
                <p className="text-[11px] text-gray-400 dark:text-gray-500 mt-2 italic">
                  {t('profile_geofence_legend')}
                </p>
              </div>
            )}
          </Card>
        )}

        {/* Supervisory Approval Chain Section */}
        <Card>
          <h3 className="text-lg font-bold text-gray-800 dark:text-gray-100 mb-4">
            {t('profile_supervisor_chain')}
          </h3>
          {staff?.supervisors && staff.supervisors.length > 0 ? (
            <div className="space-y-3">
              {staff.supervisors.map((sup, index) => (
                <div
                  key={sup.sequence || index}
                  className={`flex items-center py-2.5 ${
                    index < staff.supervisors!.length - 1
                      ? 'border-b border-gray-100 dark:border-zinc-800'
                      : ''
                  }`}
                >
                  <div className="w-7 h-7 rounded-full bg-blue-50 dark:bg-blue-950/40 flex items-center justify-center mr-3 border border-blue-100 dark:border-blue-900 shrink-0">
                    <span className="text-xs font-bold text-blue-600 dark:text-blue-400">
                      {sup.sequence || index + 1}
                    </span>
                  </div>
                  <div className="flex-1 mr-2">
                    <p className="text-sm font-semibold text-gray-900 dark:text-gray-100">
                      {sup.supervisor_name}
                    </p>
                    {sup.supervisor_job_title && (
                      <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                        {sup.supervisor_job_title}
                      </p>
                    )}
                  </div>
                </div>
              ))}
            </div>
          ) : staff?.supervisor_name ? (
            <InfoRow label={t('profile_supervisor_name')} value={staff.supervisor_name} isLast />
          ) : (
            <p className="text-sm text-gray-400 dark:text-gray-500 italic">
              {t('profile_no_supervisors')}
            </p>
          )}
        </Card>

        {/* Account & Security Section */}
        <Card>
          <h3 className="text-lg font-bold text-gray-800 dark:text-gray-100 mb-4">
            {t('profile_account_security')}
          </h3>
          <div className="space-y-1">
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
          </div>
        </Card>
      </div>

      <SignaturePadModal
        visible={signatureModalVisible}
        onClose={() => setSignatureModalVisible(false)}
        onSave={handleSignatureSave}
      />
    </MainTemplate>
  );
};

export default ProfileScreen;
