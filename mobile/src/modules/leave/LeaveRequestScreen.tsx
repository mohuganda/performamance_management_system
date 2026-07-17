import React, { useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { AlertCircle } from 'lucide-react-native';
import { useTranslation } from 'react-i18next';
import { useTheme } from '../../app/hooks/useTheme';
import { MainTemplate } from '../../components/templates';
import { Input } from '../../components/atoms/Input';
import { Button } from '../../components/atoms/Button';
import { DropdownSelect } from '../../components/molecules/DropdownSelect';
import { DateRangePicker } from '../../components/molecules/DateRangePicker';
import { AttachmentPicker, AttachmentFile } from '../../components/molecules/AttachmentPicker';
import { FormStatusAlert } from '../../components/molecules/FormStatusAlert';
import {
  useLeaveTypesSync,
  useLeaveConfigQuery,
  useCreateLeaveMutation,
} from '../../app/hooks/useLeave';
import leaveRequestSchema from '../../app/schemas/leave';
import {
  minLeaveStartDate,
  validateLeaveDates,
  parseISODate,
} from '../../utils/leavePolicy';
import leaveService from '../../api/leave/service';
import { Toaster } from '../../utils/toast';
import { getApiErrorMessage } from '../../api/client';
import withObservables from '@nozbe/with-observables';
import { database } from '../../db';
import LeaveTypeModel from '../../db/models/LeaveTypeModel';

interface LeaveRequestScreenProps {
  leaveTypes: LeaveTypeModel[];
}

const BaseLeaveRequestScreen: React.FC<LeaveRequestScreenProps> = ({ leaveTypes }) => {
  const { t } = useTranslation();
  const navigation = useNavigation();
  const { colors } = useTheme();

  // Queries & Mutations
  const { isLoading: isTypesLoading } = useLeaveTypesSync();
  const { data: config } = useLeaveConfigQuery();
  const createMutation = useCreateLeaveMutation();

  // Form State
  const [form, setForm] = useState({
    leave_type_id: '',
    start_date: '',
    end_date: '',
    reason: '',
  });

  const [attachments, setAttachments] = useState<AttachmentFile[]>([]);
  const [isUploading, setIsUploading] = useState(false);
  const [formAlert, setFormAlert] = useState<{ type: 'error' | 'warning' | 'success'; message: string } | null>(null);
  const [validationErrors, setValidationErrors] = useState<Record<string, string>>({});

  const selectedType = React.useMemo(() => {
    if (!leaveTypes || !form.leave_type_id) return undefined;
    return leaveTypes.find((typeItem) => String(typeItem.remoteId) === form.leave_type_id);
  }, [leaveTypes, form.leave_type_id]);

  // Policy helpers
  const policy = config;
  const minDate = React.useMemo(() => minLeaveStartDate(policy, selectedType as any), [policy, selectedType]);

  const leaveDays = React.useMemo(() => {
    if (!form.start_date || !form.end_date) return 0;
    const start = parseISODate(form.start_date);
    const end = parseISODate(form.end_date);
    if (end < start) return 0;
    const diffTime = Math.abs(end.getTime() - start.getTime());
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24)) + 1;
    return diffDays;
  }, [form.start_date, form.end_date]);

  const needsMedicalReport = React.useMemo(() => {
    if (!selectedType || selectedType.medicalReportAfterDays === null || selectedType.medicalReportAfterDays === undefined) {
      return false;
    }
    return leaveDays > selectedType.medicalReportAfterDays;
  }, [selectedType, leaveDays]);

  // Helper to read local file blob and convert to Base64 dataURL
  const fileToDataUrl = async (uri: string): Promise<string> => {
    const response = await fetch(uri);
    const blob = await response.blob();
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onloadend = () => resolve(reader.result as string);
      reader.onerror = reject;
      reader.readAsDataURL(blob);
    });
  };

  // Submit standard leave request form
  const handleSubmit = async (submit: boolean) => {
    setFormAlert(null);
    setValidationErrors({});

    // 1. Zod schema validation
    const result = leaveRequestSchema.safeParse(form);
    if (!result.success) {
      const errors: Record<string, string> = {};
      result.error.issues.forEach((issue) => {
        if (issue.path[0]) {
          errors[issue.path[0] as string] = issue.message;
        }
      });
      setValidationErrors(errors);
      setFormAlert({ type: 'warning', message: 'Please correct the validation errors in the form.' });
      return;
    }

    // 2. Policy-level date validations
    const dateError = validateLeaveDates(form, policy, selectedType as any);
    if (dateError) {
      setFormAlert({ type: 'warning', message: dateError });
      return;
    }

    // 3. Medical report validation
    if (needsMedicalReport && attachments.length === 0) {
      setFormAlert({
        type: 'warning',
        message: t('leave_error_medical_required', {
          days: selectedType?.medicalReportAfterDays ?? 0,
        }),
      });
      return;
    }

    // 4. File uploads
    let uploadedUrls: string[] = [];
    setIsUploading(true);
    try {
      for (const file of attachments) {
        // Upload each file
        const dataUrl = await fileToDataUrl(file.uri);
        const uploadRes = await leaveService.uploadAttachment(dataUrl, file.name);
        uploadedUrls.push(uploadRes.url);
      }
    } catch (error) {
      console.error('File upload failed', error);
      setIsUploading(false);
      setFormAlert({ type: 'error', message: 'Failed to upload attachments. Please check internet and try again.' });
      return;
    }

    setIsUploading(false);

    // 5. Submit leave request (handles offline sync queue automatically)
    const payload = {
      leave_type_id: Number(form.leave_type_id),
      start_date: form.start_date,
      end_date: form.end_date,
      reason: form.reason,
      medical_report_url: uploadedUrls.length > 0 ? JSON.stringify(uploadedUrls.map(url => ({ url, name: 'Attachment' }))) : undefined,
      submit,
    };

    createMutation.mutate(payload, {
      onSuccess: (res: any) => {
        if (res?.offline) {
          Toaster.info(t('leave_success_queued'), 'Offline Mode');
          navigation.goBack();
        } else {
          Toaster.success(submit ? t('leave_success_submit') : t('leave_success_draft'), submit ? 'Submitted' : 'Saved Draft');
          navigation.goBack();
        }
      },
      onError: (err: unknown) => {
        setFormAlert({ type: 'error', message: getApiErrorMessage(err, 'An unexpected error occurred while saving the leave request.') });
      },
    });
  };

  const formattedLeaveTypes = React.useMemo(() => {
    return leaveTypes.map(t => ({ id: t.remoteId || t.id, name: t.name }));
  }, [leaveTypes]);

  return (
    <MainTemplate title={t('leave_apply_title')} showBack={true}>
      <ScrollView className="flex-1" contentContainerStyle={styles.scrollContent}>
        <View className="p-6 space-y-6">
          {formAlert && (
            <TouchableOpacity onPress={() => setFormAlert(null)} activeOpacity={0.9}>
              <FormStatusAlert
                type={formAlert.type}
                message={formAlert.message}
              />
            </TouchableOpacity>
          )}
          {/* Prominent 14-day Advance Notice Warning */}
          <View className="p-4 mb-3 rounded-none flex-row bg-amber-50 dark:bg-amber-950/20 border border-amber-300 dark:border-amber-900/50">
            <AlertCircle size={18} color="#D97706" className="mt-0.5" />
            <View className="flex-1">
              <Text className="ml-3 text-xs font-bold text-amber-800 dark:text-amber-400">
                Notice Requirement:
              </Text>
              <Text className="text-xs text-amber-700 dark:text-amber-400/80 mt-1 leading-relaxed">
                Standard leave requests must be submitted at least <Text className="font-bold">14 days</Text> prior to the selected start date (except sick leave, which is exempt).
              </Text>
            </View>
          </View>

          {/* Leave Type Select Dropdown Organism */}
          <DropdownSelect
            label={t('leave_form_type')}
            placeholder="Choose a leave type..."
            options={formattedLeaveTypes || []}
            selectedValue={form.leave_type_id}
            onSelect={(option) => {
              setForm((f) => ({ ...f, leave_type_id: String(option.id) }));
            }}
            error={validationErrors.leave_type_id}
            loading={isTypesLoading && leaveTypes.length === 0}
            className="mb-4"
          />

          {/* Dates Selection Range Picker Organism */}
          <DateRangePicker
            startDate={form.start_date}
            endDate={form.end_date}
            onStartDateChange={(date) => {
              setForm((f) => ({ ...f, start_date: date }));
            }}
            onEndDateChange={(date) => {
              setForm((f) => ({ ...f, end_date: date }));
            }}
            startLabel={t('leave_form_start_date')}
            endLabel={t('leave_form_end_date')}
            startError={validationErrors.start_date}
            endError={validationErrors.end_date}
            minimumDate={minDate}
            className="mb-4"
          />

          {/* Days count Indicator */}
          {leaveDays > 0 && (
            <View className="bg-gray-50 dark:bg-zinc-900 px-4 py-3.5 rounded-none border border-gray-100 dark:border-zinc-800 flex-row justify-between items-center">
              <Text className="text-sm font-bold" style={{ color: colors.text }}>
                Duration Calculated:
              </Text>
              <Text className="text-base font-black text-success">
                {t('leave_days_count', { count: leaveDays })}
              </Text>
            </View>
          )}

          {/* Reason Input */}
          <Input
            label={t('leave_form_reason')}
            placeholder={t('leave_form_reason_placeholder')}
            value={form.reason}
            onChangeText={(text) => setForm((f) => ({ ...f, reason: text }))}
            error={validationErrors.reason}
            multiline={true}
            numberOfLines={4}
            textAlignVertical="top"
            className="h-28"
          />

          {/* Reusable AttachmentPicker Molecule */}
          <AttachmentPicker
            label={t('leave_form_attachments')}
            required={needsMedicalReport}
            requiredWarningText={needsMedicalReport ? "Medical Certificate Required" : undefined}
            attachments={attachments}
            onAttachmentsChange={setAttachments}
            allowMultiple={true}
            className="mb-4"
          />

          {/* Action buttons */}
          <View className="space-y-3 pt-4">
            <Button
              title={createMutation.isPending || isUploading ? 'Processing Submission...' : t('leave_form_submit')}
              onPress={() => handleSubmit(true)}
              disabled={createMutation.isPending || isUploading}
              loading={createMutation.isPending || isUploading}
            />

            <Button
              title="Save as Draft"
              variant="secondary"
              className="mt-4"
              onPress={() => handleSubmit(false)}
              disabled={createMutation.isPending || isUploading}
            />
          </View>
        </View>
      </ScrollView>

    </MainTemplate>
  );
};

const styles = StyleSheet.create({
  scrollContent: {
    paddingBottom: 40,
  },
});

export const LeaveRequestScreen = withObservables([], () => ({
  leaveTypes: database.collections.get<LeaveTypeModel>('leave_types').query().observe(),
}))(BaseLeaveRequestScreen);

