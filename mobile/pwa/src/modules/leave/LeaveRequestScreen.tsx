import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { MainTemplate } from '../../components/templates';
import { Card } from '../../components/atoms/Card';
import { Button } from '../../components/atoms/Button';
import { Input } from '../../components/atoms/Input';
import { DateRangePicker } from '../../components/molecules/DateRangePicker';
import { AttachmentPicker, AttachmentFile } from '../../components/molecules/AttachmentPicker';
import { useTheme } from '../../hooks/useTheme';
import { Toaster } from '../../utils/toast';
import { getApiErrorMessage } from '../../api/client';
import { useLeaveTypesQuery, useCreateLeaveMutation } from '../../hooks/useLeave';
import { LeaveSubmissionPayload } from '../../api/leave/types';

export const LeaveRequestScreen: React.FC = () => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { colors } = useTheme();

  const { data: leaveTypes = [] } = useLeaveTypesQuery();
  const createMutation = useCreateLeaveMutation();

  const [selectedTypeId, setSelectedTypeId] = useState<string>('');
  const [startDate, setStartDate] = useState<string | null>(null);
  const [endDate, setEndDate] = useState<string | null>(null);
  const [reason, setReason] = useState('');
  const [attachments, setAttachments] = useState<AttachmentFile[]>([]);
  const [errors, setErrors] = useState<Record<string, string>>({});

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrors({});

    const newErrors: Record<string, string> = {};
    if (!selectedTypeId) newErrors.type = 'Please select a leave type';
    if (!startDate) newErrors.startDate = 'Start date is required';
    if (!endDate) newErrors.endDate = 'End date is required';
    if (!reason.trim()) newErrors.reason = 'Please state your reason for leave';

    if (Object.keys(newErrors).length > 0) {
      setErrors(newErrors);
      return;
    }

    const payload: LeaveSubmissionPayload = {
      leave_type_id: Number(selectedTypeId),
      start_date: startDate!,
      end_date: endDate!,
      reason: reason.trim(),
      medical_report_url: attachments.length > 0 ? attachments[0].dataUrl : undefined,
      submit: true,
    };

    createMutation.mutate(payload, {
      onSuccess: (data) => {
        if (data?.offline) {
          Toaster.info(t('leave_sync_offline', 'Leave application stored offline. Will sync once online.'));
        } else {
          Toaster.success(t('leave_submitted_success', 'Leave application submitted successfully!'));
        }
        navigate('/leave/history');
      },
      onError: (err) => {
        Toaster.error(getApiErrorMessage(err, 'Failed to submit leave request.'));
      },
    });
  };

  return (
    <MainTemplate title={t('leave_apply_title', 'Apply for Leave')} showBack>
      <div className="p-4">
        <Card className="p-5">
          <form onSubmit={handleSubmit} className="space-y-4">
            {/* Leave Type Select */}
            <div>
              <label
                className="block text-sm font-medium mb-1"
                style={{ color: colors.text }}
              >
                {t('leave_type_label', 'Leave Category')}
              </label>
              <select
                value={selectedTypeId}
                onChange={(e) => setSelectedTypeId(e.target.value)}
                className="w-full border rounded-none px-4 py-3 bg-white dark:bg-[#1E1E1E] text-base outline-none transition-colors"
                style={{
                  borderColor: errors.type ? colors.error : colors.border,
                  color: colors.text,
                }}
              >
                <option value="">Select category...</option>
                {leaveTypes.map((tp) => (
                  <option key={tp.id} value={tp.id}>
                    {tp.name}
                  </option>
                ))}
              </select>
              {errors.type && (
                <p className="text-xs font-medium mt-1" style={{ color: colors.error }}>
                  {errors.type}
                </p>
              )}
            </div>

            {/* Date Range Picker */}
            <div>
              <DateRangePicker
                startDate={startDate}
                endDate={endDate}
                onStartDateChange={(val: string) => setStartDate(val)}
                onEndDateChange={(val: string) => setEndDate(val)}
                startError={errors.startDate}
                endError={errors.endDate}
              />
            </div>

            {/* Reason */}
            <div>
              <Input
                label={t('leave_reason_label', 'Reason / Motivation')}
                multiline
                rows={3}
                placeholder="State justification for requested time away from duties..."
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                error={errors.reason}
              />
            </div>

            {/* Supporting Attachment */}
            <div>
              <AttachmentPicker
                label="Supporting Documents (Optional)"
                attachments={attachments}
                onAttachmentsChange={setAttachments}
                allowMultiple={false}
              />
            </div>

            {/* Submit Button */}
            <div className="pt-2">
              <Button
                type="submit"
                title={t('leave_submit_btn', 'Submit Application')}
                loading={createMutation.isPending}
                className="py-4"
              />
            </div>
          </form>
        </Card>
      </div>
    </MainTemplate>
  );
};
export default LeaveRequestScreen;
