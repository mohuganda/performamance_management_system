import React, { useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import DateTimePickerModal from 'react-native-modal-datetime-picker';
import { pick, types, errorCodes } from '@react-native-documents/picker';
import { Calendar as CalendarIcon, Upload, Trash2, ChevronDown, AlertCircle } from 'lucide-react-native';
import { useTranslation } from 'react-i18next';
import { useTheme } from '../../app/hooks/useTheme';
import { MainTemplate } from '../../components/templates';
import { Input } from '../../components/atoms/Input';
import { Button } from '../../components/atoms/Button';
import { Card } from '../../components/atoms/Card';
import { FormStatusAlert } from '../../components/molecules/FormStatusAlert';
import {
  useLeaveTypesQuery,
  useLeaveConfigQuery,
  useCreateLeaveMutation,
} from '../../app/hooks/useLeave';
import leaveRequestSchema from '../../app/schemas/leave';
import {
  minLeaveStartDate,
  validateLeaveDates,
  formatDisplayDate,
  parseISODate,
} from '../../utils/leavePolicy';
import leaveService from '../../api/leave/service';

interface AttachmentFile {
  uri: string;
  name: string;
  type: string;
  size?: number;
}

export function LeaveRequestScreen() {
  const { t } = useTranslation();
  const navigation = useNavigation();
  const { colors } = useTheme();

  // Queries & Mutations
  const { data: leaveTypes, isLoading: isTypesLoading } = useLeaveTypesQuery();
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

  // Date Pickers State
  const [isStartPickerVisible, setStartPickerVisibility] = useState(false);
  const [isEndPickerVisible, setEndPickerVisibility] = useState(false);

  // Type Dropdown State
  const [showTypeSelector, setShowTypeSelector] = useState(false);

  const selectedType = React.useMemo(() => {
    if (!leaveTypes || !form.leave_type_id) return undefined;
    return leaveTypes.find((t) => String(t.id) === form.leave_type_id);
  }, [leaveTypes, form.leave_type_id]);

  // Policy helpers
  const policy = config;
  const minDate = React.useMemo(() => minLeaveStartDate(policy, selectedType), [policy, selectedType]);

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
    if (!selectedType || selectedType.medical_report_after_days === null || selectedType.medical_report_after_days === undefined) {
      return false;
    }
    return leaveDays > selectedType.medical_report_after_days;
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

  // Pick supporting document
  const handlePickDocument = async () => {
    try {
      const res = await pick({
        type: [types.images, types.pdf],
        allowMultiSelection: false,
      });
      const file = res[0];
      if (file) {
        setAttachments((prev) => [
          ...prev,
          {
            uri: file.uri,
            name: file.name ?? 'document.pdf',
            type: file.type ?? 'application/pdf',
            size: file.size ?? undefined,
          },
        ]);
      }
    } catch (err: any) {
      if (err?.code !== errorCodes.OPERATION_CANCELED) {
        console.error('Document picking error:', err);
      }
    }
  };

  const handleRemoveAttachment = (index: number) => {
    setAttachments((prev) => prev.filter((_, i) => i !== index));
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
    const dateError = validateLeaveDates(form, policy, selectedType);
    if (dateError) {
      setFormAlert({ type: 'warning', message: dateError });
      return;
    }

    // 3. Medical report validation
    if (needsMedicalReport && attachments.length === 0) {
      setFormAlert({
        type: 'warning',
        message: t('leave_error_medical_required', {
          days: selectedType?.medical_report_after_days ?? 0,
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
          Alert.alert('Offline Mode', t('leave_success_queued'), [
            { text: 'OK', onPress: () => navigation.goBack() },
          ]);
        } else {
          Alert.alert(
            submit ? 'Submitted' : 'Saved Draft',
            submit ? t('leave_success_submit') : t('leave_success_draft'),
            [{ text: 'OK', onPress: () => navigation.goBack() }]
          );
        }
      },
      onError: (err) => {
        setFormAlert({ type: 'error', message: err.message || 'An unexpected error occurred while saving the leave request.' });
      },
    });
  };

  return (
    <MainTemplate title={t('leave_apply_title')} showBack={true}>
      <ScrollView className="flex-1" contentContainerStyle={{ paddingBottom: 40 }}>
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
          <View className="p-4 rounded-2xl flex-row bg-amber-50 dark:bg-amber-950/20 border border-amber-100 dark:border-amber-900/50">
            <AlertCircle size={18} color="#D97706" className="mr-3 mt-0.5" />
            <View className="flex-1">
              <Text className="text-xs font-bold text-amber-800 dark:text-amber-400">
                Notice Requirement:
              </Text>
              <Text className="text-xs text-amber-700 dark:text-amber-400/80 mt-1 leading-relaxed">
                Standard leave requests must be submitted at least <Text className="font-bold">14 days</Text> prior to the selected start date (except sick leave, which is exempt).
              </Text>
            </View>
          </View>
          {/* Leave Type Select Card */}
          <View className="space-y-2">
            <Text className="text-sm font-medium text-gray-700 dark:text-zinc-300">
              {t('leave_form_type')}
            </Text>
            <TouchableOpacity
              activeOpacity={0.7}
              onPress={() => setShowTypeSelector(!showTypeSelector)}
              className="w-full bg-white dark:bg-zinc-950 border border-gray-200 dark:border-zinc-800 rounded-xl px-4 py-4.5 flex-row items-center justify-between"
            >
              <Text className="text-base" style={{ color: selectedType ? colors.text : colors.muted }}>
                {selectedType ? selectedType.name : 'Choose a leave type...'}
              </Text>
              <ChevronDown size={18} color={colors.muted} />
            </TouchableOpacity>

            {validationErrors.leave_type_id && (
              <Text className="text-xs text-[#D90000] font-medium">
                {validationErrors.leave_type_id}
              </Text>
            )}

            {/* Dropdown Options List */}
            {showTypeSelector && (
              <Card className="p-2 border border-gray-100 dark:border-zinc-800 max-h-48 overflow-hidden">
                <ScrollView nestedScrollEnabled={true}>
                  {isTypesLoading ? (
                    <ActivityIndicator size="small" color={colors.primary} className="py-4" />
                  ) : (
                    leaveTypes?.map((t) => (
                      <TouchableOpacity
                        key={t.id}
                        onPress={() => {
                          setForm((f) => ({ ...f, leave_type_id: String(t.id) }));
                          setShowTypeSelector(false);
                        }}
                        className="p-3 rounded-lg border-b border-gray-50 dark:border-zinc-900 last:border-b-0"
                      >
                        <Text className="text-base font-semibold" style={{ color: colors.text }}>
                          {t.name}
                        </Text>
                      </TouchableOpacity>
                    ))
                  )}
                </ScrollView>
              </Card>
            )}
          </View>

          {/* Dates Selection Card */}
          <View className="flex-row space-x-4">
            {/* Start Date */}
            <View className="flex-1 space-y-2">
              <Text className="text-sm font-medium text-gray-700 dark:text-zinc-300">
                {t('leave_form_start_date')}
              </Text>
              <TouchableOpacity
                activeOpacity={0.7}
                onPress={() => setStartPickerVisibility(true)}
                className="bg-white dark:bg-zinc-950 border border-gray-200 dark:border-zinc-800 rounded-xl px-4 py-4 flex-row items-center justify-between"
              >
                <Text className="text-sm" style={{ color: form.start_date ? colors.text : colors.muted }}>
                  {form.start_date ? formatDisplayDate(parseISODate(form.start_date)) : 'Select Date'}
                </Text>
                <CalendarIcon size={16} color={colors.muted} />
              </TouchableOpacity>
              {validationErrors.start_date && (
                <Text className="text-xs text-[#D90000] font-medium">
                  {validationErrors.start_date}
                </Text>
              )}
            </View>

            {/* End Date */}
            <View className="flex-1 space-y-2">
              <Text className="text-sm font-medium text-gray-700 dark:text-zinc-300">
                {t('leave_form_end_date')}
              </Text>
              <TouchableOpacity
                activeOpacity={0.7}
                onPress={() => setEndPickerVisibility(true)}
                className="bg-white dark:bg-zinc-950 border border-gray-200 dark:border-zinc-800 rounded-xl px-4 py-4 flex-row items-center justify-between"
              >
                <Text className="text-sm" style={{ color: form.end_date ? colors.text : colors.muted }}>
                  {form.end_date ? formatDisplayDate(parseISODate(form.end_date)) : 'Select Date'}
                </Text>
                <CalendarIcon size={16} color={colors.muted} />
              </TouchableOpacity>
              {validationErrors.end_date && (
                <Text className="text-xs text-[#D90000] font-medium">
                  {validationErrors.end_date}
                </Text>
              )}
            </View>
          </View>

          {/* Days count Indicator */}
          {leaveDays > 0 && (
            <View className="bg-gray-50 dark:bg-zinc-900 px-4 py-3.5 rounded-xl border border-gray-100 dark:border-zinc-800 flex-row justify-between items-center">
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

          {/* Attachments Section */}
          <View className="space-y-3">
            <View className="flex-row items-center justify-between">
              <Text className="text-sm font-medium text-gray-700 dark:text-zinc-300">
                {t('leave_form_attachments')}
                {needsMedicalReport && <Text className="text-[#D90000]"> *</Text>}
              </Text>
              {needsMedicalReport && (
                <Text className="text-xs text-red-500 font-bold">Medical Certificate Required</Text>
              )}
            </View>

            <TouchableOpacity
              activeOpacity={0.7}
              onPress={handlePickDocument}
              className="w-full border-2 border-dashed border-gray-200 dark:border-zinc-800 rounded-xl p-6 items-center justify-center bg-gray-50 dark:bg-zinc-950/20"
            >
              <Upload size={24} color={colors.muted} className="mb-2" />
              <Text className="text-sm font-bold text-gray-700 dark:text-zinc-300">Select Files</Text>
              <Text className="text-xs text-gray-400 mt-1">Upload Supporting Images or PDF certificates</Text>
            </TouchableOpacity>

            {attachments.length > 0 && (
              <View className="space-y-2">
                {attachments.map((file, index) => (
                  <View
                    key={index}
                    className="flex-row justify-between items-center bg-white dark:bg-zinc-950 border border-gray-200 dark:border-zinc-800 rounded-xl p-3"
                  >
                    <View className="flex-1 pr-2">
                      <Text className="text-sm font-semibold truncate" style={{ color: colors.text }}>
                        {file.name}
                      </Text>
                      {file.size && (
                        <Text className="text-xs text-gray-400">
                          {Math.round(file.size / 1024)} KB
                        </Text>
                      )}
                    </View>
                    <TouchableOpacity onPress={() => handleRemoveAttachment(index)}>
                      <Trash2 size={16} color={colors.error} />
                    </TouchableOpacity>
                  </View>
                ))}
              </View>
            )}
          </View>

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
              onPress={() => handleSubmit(false)}
              disabled={createMutation.isPending || isUploading}
            />
          </View>
        </View>
      </ScrollView>

      {/* DateTime Picker Modals */}
      <DateTimePickerModal
        isVisible={isStartPickerVisible}
        mode="date"
        minimumDate={minDate}
        onConfirm={(date) => {
          setStartPickerVisibility(false);
          const iso = date.toISOString().split('T')[0];
          setForm((f) => ({ ...f, start_date: iso }));
        }}
        onCancel={() => setStartPickerVisibility(false)}
      />

      <DateTimePickerModal
        isVisible={isEndPickerVisible}
        mode="date"
        minimumDate={form.start_date ? parseISODate(form.start_date) : minDate}
        onConfirm={(date) => {
          setEndPickerVisibility(false);
          const iso = date.toISOString().split('T')[0];
          setForm((f) => ({ ...f, end_date: iso }));
        }}
        onCancel={() => setEndPickerVisibility(false)}
      />
    </MainTemplate>
  );
}
