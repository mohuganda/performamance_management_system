import React, { useState, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { Mail, Shield, Building, Award, Phone, FileSignature, Camera } from 'lucide-react';
import { MainTemplate } from '../../components/templates';
import { Card } from '../../components/atoms/Card';
import { Badge } from '../../components/atoms/Badge';
import { Button } from '../../components/atoms/Button';
import { SignaturePadModal } from '../../components/molecules/SignaturePadModal';
import { useAuthStore } from '../../stores/authStore';
import { useTheme } from '../../hooks/useTheme';
import { Toaster } from '../../utils/toast';
import { getApiErrorMessage } from '../../api/client';
import { useProfileQuery, useUpdateProfileMutation } from '../../hooks/useProfile';

export const ProfileScreen: React.FC = () => {
  const { t } = useTranslation();
  const { user } = useAuthStore();
  const { colors } = useTheme();

  // TanStack Query custom hooks offload profile fetching and update mutations
  const { data: profileData } = useProfileQuery();
  const updateProfileMutation = useUpdateProfileMutation();
  const isUpdating = updateProfileMutation.isPending;

  const [signatureModalVisible, setSignatureModalVisible] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleSignatureSave = async (signatureDataUrl: string) => {
    updateProfileMutation.mutate(
      { signature_image: signatureDataUrl },
      {
        onSuccess: () => {
          Toaster.success('Official electronic signature saved successfully!');
        },
        onError: (err) => {
          Toaster.error(getApiErrorMessage(err, 'Failed to update electronic signature.'));
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
            Toaster.success('Profile photo updated successfully!');
          },
          onError: (err) => {
            Toaster.error(getApiErrorMessage(err, 'Failed to upload profile photo.'));
          },
        }
      );
    };
    reader.readAsDataURL(file);
  };

  const currentUser = profileData?.user || user;
  const staff = profileData?.staff;

  return (
    <MainTemplate title={t('profile_title', 'Officer Profile')} showBack>
      <div className="p-4 space-y-4">
        {/* User Avatar Card Header */}
        <Card className="p-6 flex flex-col items-center text-center">
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
            {currentUser?.ProfilePhoto ? (
              <img
                src={currentUser.ProfilePhoto}
                alt={currentUser.Name || 'Officer'}
                className="w-24 h-24 rounded-full object-cover border-2 border-zinc-200 dark:border-zinc-700"
              />
            ) : (
              <div
                className="w-24 h-24 rounded-full flex items-center justify-center font-bold text-3xl"
                style={{
                  backgroundColor: colors.primary,
                  color: colors.surface,
                }}
              >
                {currentUser?.Name?.charAt(0) || 'O'}
              </div>
            )}
            <div
              className="absolute bottom-0 right-0 p-2 text-white rounded-full shadow border-2"
              style={{
                backgroundColor: colors.primary,
                borderColor: colors.surface,
              }}
            >
              <Camera size={14} />
            </div>
          </div>

          <h2 className="text-lg font-bold mt-3 leading-snug" style={{ color: colors.text }}>
            {currentUser?.Name}
          </h2>
          <p className="text-xs mt-0.5" style={{ color: colors.muted }}>
            {currentUser?.Email}
          </p>
          <div className="mt-2">
            <Badge label={currentUser?.Role || 'Staff'} variant="info" />
          </div>
        </Card>

        {/* Staff Official Deployment Info */}
        <Card className="p-4 space-y-3">
          <h3
            className="text-xs font-bold uppercase tracking-wider mb-2"
            style={{ color: colors.muted }}
          >
            Public Service Record
          </h3>

          <div className="space-y-2.5 text-xs">
            <div className="flex items-center justify-between py-1 border-b border-gray-100 dark:border-zinc-800">
              <span className="flex items-center gap-1.5" style={{ color: colors.muted }}>
                <Building size={14} />
                Facility / Station
              </span>
              <span className="font-bold text-right" style={{ color: colors.text }}>
                {staff?.facility_name || 'Mulago National Referral Hospital'}
              </span>
            </div>

            <div className="flex items-center justify-between py-1 border-b border-gray-100 dark:border-zinc-800">
              <span className="flex items-center gap-1.5" style={{ color: colors.muted }}>
                <Award size={14} />
                Cadre / Designation
              </span>
              <span className="font-bold text-right" style={{ color: colors.text }}>
                {staff?.job_title || staff?.cadre || 'Medical Officer'}
              </span>
            </div>

            <div className="flex items-center justify-between py-1 border-b border-gray-100 dark:border-zinc-800">
              <span className="flex items-center gap-1.5" style={{ color: colors.muted }}>
                <Shield size={14} />
                IPPS / Staff Number
              </span>
              <span className="font-mono font-bold" style={{ color: colors.text }}>
                {staff?.ipps || staff?.ihris_pid || 'MOH-10824-UG'}
              </span>
            </div>

            <div className="flex items-center justify-between py-1 border-b border-gray-100 dark:border-zinc-800">
              <span className="flex items-center gap-1.5" style={{ color: colors.muted }}>
                <Mail size={14} />
                GovNet Email
              </span>
              <span className="font-bold" style={{ color: colors.text }}>
                {currentUser?.Email}
              </span>
            </div>

            <div className="flex items-center justify-between py-1">
              <span className="flex items-center gap-1.5" style={{ color: colors.muted }}>
                <Phone size={14} />
                Contact Phone
              </span>
              <span className="font-bold" style={{ color: colors.text }}>
                {staff?.mobile || '+256 700 000 000'}
              </span>
            </div>
          </div>
        </Card>

        {/* Electronic Signature Pad Card */}
        <Card className="p-4 space-y-3">
          <div className="flex items-center justify-between">
            <span
              className="text-xs font-bold uppercase tracking-wider"
              style={{ color: colors.muted }}
            >
              Official Electronic Signature
            </span>
            <Button
              variant="secondary"
              onClick={() => setSignatureModalVisible(true)}
              className="w-auto px-3 py-1.5 text-xs font-bold"
            >
              <FileSignature size={14} className="mr-1.5" />
              {currentUser?.SignatureImage ? 'Update' : 'Capture'}
            </Button>
          </div>

          {currentUser?.SignatureImage ? (
            <div
              className="p-3 border rounded-none flex items-center justify-center"
              style={{
                backgroundColor: colors.surface,
                borderColor: colors.border,
              }}
            >
              <img
                src={currentUser.SignatureImage}
                alt="Electronic Signature"
                className="max-h-20 object-contain"
              />
            </div>
          ) : (
            <p className="text-xs italic" style={{ color: colors.muted }}>
              No digital signature registered. Required for appraisal sign-offs and supervisory approvals.
            </p>
          )}
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
