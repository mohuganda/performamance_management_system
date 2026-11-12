import React, { useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import {
  MapPin,
  FileText,
  CheckSquare,
  Search,
  Calendar,
  ChevronRight,
  CheckCircle2,
  AlertTriangle,
  Clock,
  RefreshCw,
  User,
  Check,
  X,
  ClipboardList,
} from 'lucide-react';
import { MainTemplate } from '../../components/templates';
import { Card } from '../../components/atoms/Card';
import { Button } from '../../components/atoms/Button';
import { Input } from '../../components/atoms/Input';
import { DateRangePicker } from '../../components/molecules/DateRangePicker';
import { AttachmentPicker, AttachmentFile } from '../../components/molecules/AttachmentPicker';
import { OosLocationPickerMap } from '../../components/molecules/OosLocationPickerMap';
import { useTheme } from '../../hooks/useTheme';
import { useAuthStore } from '../../stores/authStore';
import { Toaster } from '../../utils/toast';
import { getApiErrorMessage } from '../../api/client';
import {
  useOosReasonsQuery,
  useOosRequestsQuery,
  useCreateOosMutation,
  useOosPendingApprovalsQuery,
  useApproveOosMutation,
} from '../../hooks/useOos';
import { usePlacesSearch } from '../../hooks/usePlacesSearch';
import { OosSubmissionPayload } from '../../api/oos/types';
import { formatDate } from '../../utils/date';

function formatDateRange(start: string, end: string) {
  if (!start) return '';
  if (!end || start === end) return formatDate(start);
  return `${formatDate(start)} to ${formatDate(end)}`;
}

export const OosScreen: React.FC = () => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { colors } = useTheme();
  const { hasPermission } = useAuthStore();

  const canApprove = hasPermission('oos.requests.approve');
  const [activeTab, setActiveTab] = useState<'history' | 'apply' | 'approvals'>('history');

  // TanStack Query custom hooks
  const { data: reasons = [], isLoading: isLoadingReasons } = useOosReasonsQuery();
  const { data: requests = [], isLoading: isLoadingRequests, refetch: refetchRequests } = useOosRequestsQuery();
  const { data: pendingApprovals = [], isLoading: isLoadingPending } = useOosPendingApprovalsQuery();

  const createMutation = useCreateOosMutation();
  const approveMutation = useApproveOosMutation();

  // Form State
  const [selectedReasonId, setSelectedReasonId] = useState<number | null>(null);
  const [startDate, setStartDate] = useState<string | null>(null);
  const [endDate, setEndDate] = useState<string | null>(null);
  const [destinationName, setDestinationName] = useState('');
  const [destinationAddress, setDestinationAddress] = useState('');
  const [coords, setCoords] = useState<{ latitude: number; longitude: number } | null>(null);
  const [isLocating, setIsLocating] = useState(false);
  const [expectedDeliverables, setExpectedDeliverables] = useState('');
  const [remarks, setRemarks] = useState('');
  const [attachments, setAttachments] = useState<AttachmentFile[]>([]);
  const [formErrors, setFormErrors] = useState<Record<string, string>>({});
  const [approvalComments, setApprovalComments] = useState<Record<number, string>>({});

  // Places Search custom hook
  const {
    searchQuery,
    setSearchQuery,
    predictions,
    selectPrediction,
    reverseGeocode,
    clearSearch,
  } = usePlacesSearch({
    onPlaceSelected: (res) => {
      setDestinationName(res.name);
      setDestinationAddress(res.formatted_address);
      setCoords({ latitude: res.latitude, longitude: res.longitude });
    },
    onReverseGeocoded: (res) => {
      setDestinationName(res.name);
      setDestinationAddress(res.formatted_address);
    },
  });

  const reasonsMap = useMemo(() => {
    const map = new Map<number, string>();
    reasons.forEach((r) => map.set(r.id, r.reason));
    return map;
  }, [reasons]);

  const sortedRequests = useMemo(() => {
    return [...requests].sort((a, b) => {
      const dateA = new Date(a.start_date).getTime();
      const dateB = new Date(b.start_date).getTime();
      return dateB - dateA;
    });
  }, [requests]);

  const handleUseCurrentLocation = () => {
    if (!navigator.geolocation) {
      Toaster.error('Geolocation is not supported by your browser.');
      return;
    }
    setIsLocating(true);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const newCoords = {
          latitude: pos.coords.latitude,
          longitude: pos.coords.longitude,
        };
        setCoords(newCoords);
        setIsLocating(false);
        reverseGeocode(newCoords.latitude, newCoords.longitude);
      },
      (err) => {
        setIsLocating(false);
        Toaster.error('Unable to retrieve current coordinates. Please select manually on the map.');
      },
      { enableHighAccuracy: true, timeout: 15000, maximumAge: 10000 }
    );
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormErrors({});

    const errors: Record<string, string> = {};
    if (!selectedReasonId) errors.reason = 'Please select a reason';
    if (!destinationName.trim()) errors.destinationName = 'Destination is required';
    if (!startDate) errors.startDate = 'Start date is required';
    if (!endDate) errors.endDate = 'End date is required';
    if (!coords) errors.coords = 'Please choose a destination location';

    const todayStr = new Date().toISOString().split('T')[0];
    if (startDate && startDate < todayStr) {
      errors.startDate = t('oos_error_past_dates', 'Out-of-station requests cannot use past dates.');
    }
    if (startDate && endDate && endDate < startDate) {
      errors.endDate = t('oos_error_end_date_before_start', 'End date cannot be before the start date.');
    }

    if (Object.keys(errors).length > 0) {
      setFormErrors(errors);
      return;
    }

    const payload: OosSubmissionPayload = {
      reason_id: selectedReasonId!,
      destination_name: destinationName.trim(),
      destination_address: destinationAddress.trim() || undefined,
      start_date: startDate!,
      end_date: endDate!,
      destination_latitude: coords!.latitude,
      destination_longitude: coords!.longitude,
      geofence_radius_meters: 500,
      expected_deliverables: expectedDeliverables.trim() || undefined,
      remarks: remarks.trim() || undefined,
      attachment_url: attachments.length > 0 ? attachments[0].dataUrl : undefined,
      submit: true,
    };

    createMutation.mutate(payload, {
      onSuccess: (data) => {
        if (data?.offline) {
          Toaster.info(t('oos_success_queued', 'Offline mode: Travel request queued locally. Will sync automatically.'));
        } else {
          Toaster.success(t('oos_success_submit', 'Travel request submitted for approval.'));
        }

        // Reset
        setSelectedReasonId(null);
        setStartDate(null);
        setEndDate(null);
        setDestinationName('');
        setDestinationAddress('');
        setCoords(null);
        setExpectedDeliverables('');
        setRemarks('');
        setAttachments([]);
        clearSearch();
        setActiveTab('history');
      },
      onError: (err) => {
        Toaster.error(getApiErrorMessage(err, 'Failed to submit travel request.'));
      },
    });
  };

  const handleApprovalAction = (approvalId: number, approve: boolean) => {
    const commentText = approvalComments[approvalId]?.trim() || '';
    approveMutation.mutate(
      { id: approvalId, approve, comments: commentText },
      {
        onSuccess: () => {
          Toaster.success(approve ? 'Travel request approved.' : 'Travel request rejected.', 'Success');
          setApprovalComments((prev) => {
            const copy = { ...prev };
            delete copy[approvalId];
            return copy;
          });
        },
        onError: (err) => {
          Toaster.error(getApiErrorMessage(err, 'Could not process travel approval.'));
        },
      }
    );
  };

  const getStatusStyles = (status: string) => {
    switch (status) {
      case 'approved':
        return {
          bg: 'bg-green-500/10 dark:bg-green-500/20',
          border: 'border-green-500/30',
          text: 'text-green-700 dark:text-green-400',
          Icon: CheckCircle2,
          color: colors.success,
          label: t('oos_approved_status', 'Approved'),
        };
      case 'rejected':
        return {
          bg: 'bg-red-500/10 dark:bg-red-500/20',
          border: 'border-red-500/30',
          text: 'text-red-700 dark:text-red-400',
          Icon: AlertTriangle,
          color: colors.error,
          label: t('oos_rejected_status', 'Rejected'),
        };
      case 'pending_sync':
        return {
          bg: 'bg-blue-500/10 dark:bg-blue-500/20',
          border: 'border-blue-500/30',
          text: 'text-blue-700 dark:text-blue-400',
          Icon: RefreshCw,
          color: '#3B82F6',
          label: t('oos_pending_sync_status', 'Pending Sync'),
        };
      case 'sync_failed':
        return {
          bg: 'bg-red-500/10 dark:bg-red-500/20',
          border: 'border-red-500/30',
          text: 'text-red-700 dark:text-red-400',
          Icon: AlertTriangle,
          color: colors.error,
          label: t('oos_sync_failed_status', 'Sync Failed'),
        };
      case 'draft':
        return {
          bg: 'bg-gray-500/10 dark:bg-gray-500/20',
          border: 'border-gray-500/30',
          text: 'text-gray-700 dark:text-gray-400',
          Icon: Clock,
          color: colors.muted,
          label: t('oos_draft_status', 'Draft'),
        };
      default:
        return {
          bg: 'bg-amber-500/10 dark:bg-amber-500/20',
          border: 'border-amber-500/30',
          text: 'text-amber-700 dark:text-amber-400',
          Icon: Clock,
          color: colors.warning,
          label: t('oos_pending_status', 'Pending'),
        };
    }
  };

  return (
    <MainTemplate title={t('oos_title', 'Out of Station')} showBack>
      <div className="flex flex-col">
        {/* Tab Selection Bar matching Mobile OosScreen */}
        <div
          className="flex border-b justify-around items-center sticky top-14 z-30 transition-colors"
          style={{
            backgroundColor: colors.surface,
            borderBottomColor: colors.border,
          }}
        >
          {/* History Tab */}
          <button
            onClick={() => setActiveTab('history')}
            className="flex-1 py-4 flex items-center justify-center gap-1.5 border-b-2 text-xs font-bold transition-colors cursor-pointer"
            style={{
              borderBottomColor: activeTab === 'history' ? colors.primary : 'transparent',
              color: activeTab === 'history' ? colors.primary : colors.muted,
            }}
          >
            <FileText size={16} color={activeTab === 'history' ? colors.primary : colors.muted} />
            <span>{t('oos_tab_history', 'History')}</span>
          </button>

          {/* New Application Tab */}
          <button
            onClick={() => setActiveTab('apply')}
            className="flex-1 py-4 flex items-center justify-center gap-1.5 border-b-2 text-xs font-bold transition-colors cursor-pointer"
            style={{
              borderBottomColor: activeTab === 'apply' ? colors.primary : 'transparent',
              color: activeTab === 'apply' ? colors.primary : colors.muted,
            }}
          >
            <MapPin size={16} color={activeTab === 'apply' ? colors.primary : colors.muted} />
            <span>{t('oos_tab_apply', 'New Application')}</span>
          </button>

          {/* Approvals Tab (Only if supervisor has approvals permission) */}
          {canApprove && (
            <button
              onClick={() => setActiveTab('approvals')}
              className="flex-1 py-4 flex items-center justify-center gap-1.5 border-b-2 text-xs font-bold transition-colors cursor-pointer"
              style={{
                borderBottomColor: activeTab === 'approvals' ? colors.primary : 'transparent',
                color: activeTab === 'approvals' ? colors.primary : colors.muted,
              }}
            >
              <CheckSquare size={16} color={activeTab === 'approvals' ? colors.primary : colors.muted} />
              <span>{t('oos_tab_approvals', 'Approvals')}</span>
            </button>
          )}
        </div>

        {/* Tab Contents */}
        <div className="p-4 space-y-4">
          {activeTab === 'history' && (
            <div className="space-y-4 pb-6">
              <span
                className="text-xs font-bold uppercase tracking-wider block"
                style={{ color: colors.muted }}
              >
                {t('oos_history_title', 'Travel History')}
              </span>

              {isLoadingRequests && requests.length === 0 ? (
                <div className="py-12 flex flex-col items-center justify-center text-xs" style={{ color: colors.muted }}>
                  <RefreshCw size={20} className="animate-spin mb-2" style={{ color: colors.primary }} />
                  <span>{t('oos_history_loading', 'Loading travel requests...')}</span>
                </div>
              ) : requests.length === 0 ? (
                <div className="py-12 px-4 flex flex-col items-center justify-center text-center">
                  <FileText size={32} className="mb-4" style={{ color: colors.border }} />
                  <p className="text-sm font-medium" style={{ color: colors.text }}>
                    {t('oos_history_empty_title', 'No travel requests found.')}
                  </p>
                  <p className="text-xs mt-1" style={{ color: colors.muted }}>
                    {t('oos_history_empty_subtitle', "Tap 'New Application' to submit an out of station request.")}
                  </p>
                </div>
              ) : (
                <div className="space-y-4">
                  {sortedRequests.map((req) => {
                    const statusStyle = getStatusStyles(req.status);
                    const StatusIcon = statusStyle.Icon;
                    const reasonLabel = req.reason_name || reasonsMap.get(req.reason_id) || 'Travel Assignment';
                    const isSyncFailed = req.status === 'sync_failed';

                    return (
                      <div
                        key={req.id}
                        onClick={() => navigate(`/oos/${req.id}`)}
                        className={`p-4 border shadow-sm rounded-none cursor-pointer transition-colors ${
                          isSyncFailed ? 'border-l-4 border-l-red-500' : ''
                        }`}
                        style={{
                          backgroundColor: colors.surface,
                          borderColor: isSyncFailed ? '#ef4444' : colors.border,
                        }}
                      >
                        {/* Header: Reason & Status */}
                        <div className="flex justify-between items-start mb-3">
                          <h3 className="text-base font-bold flex-1 mr-2" style={{ color: colors.text }}>
                            {reasonLabel}
                          </h3>
                          <div
                            className={`flex items-center gap-1 px-2.5 py-1 border ${statusStyle.bg} ${statusStyle.border}`}
                          >
                            <StatusIcon size={12} color={statusStyle.color} />
                            <span className={`text-[10px] font-bold capitalize ${statusStyle.text}`}>
                              {statusStyle.label}
                            </span>
                          </div>
                        </div>

                        {/* Travel Period */}
                        <div className="flex items-center gap-2 mb-2">
                          <Calendar size={14} style={{ color: colors.muted }} />
                          <span className="text-xs font-medium" style={{ color: colors.text }}>
                            {formatDate(req.start_date)} to {formatDate(req.end_date)}
                          </span>
                        </div>

                        {/* Destination */}
                        <div className="flex items-start gap-2 mb-3">
                          <MapPin size={14} style={{ color: colors.muted }} className="mt-0.5 flex-shrink-0" />
                          <div className="flex-1">
                            <p className="text-xs font-bold" style={{ color: colors.text }}>
                              {req.destination_name}
                            </p>
                            {req.destination_address && (
                              <p className="text-[11px] mt-0.5" style={{ color: colors.muted }}>
                                {req.destination_address}
                              </p>
                            )}
                          </div>
                        </div>

                        {/* Tap to View Details Footer matching Mobile */}
                        <div
                          className="mt-3 pt-2.5 border-t flex justify-between items-center"
                          style={{ borderColor: `${colors.border}60` }}
                        >
                          <span className="text-[11px] font-bold" style={{ color: colors.primary }}>
                            {req.status === 'approved'
                              ? t('oos_action_view_and_clockin', 'View Details & Duty Attendance →')
                              : t('oos_action_view_details', 'View Trip Details →')}
                          </span>
                          <ChevronRight size={14} style={{ color: colors.primary }} />
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}

          {activeTab === 'apply' && (
            <div className="pb-12 max-w-2xl mx-auto w-full">
              <form onSubmit={handleSubmit} className="space-y-6">
                {/* Reason Select Option */}
                <div className="space-y-1">
                  <label className="block text-sm font-semibold" style={{ color: colors.text }}>
                    {t('oos_form_reason', 'Travel Reason')}
                  </label>
                  <select
                    value={selectedReasonId || ''}
                    onChange={(e) => setSelectedReasonId(Number(e.target.value))}
                    className="w-full border rounded-none px-4 py-3 text-sm outline-none"
                    style={{
                      backgroundColor: colors.surface,
                      borderColor: formErrors.reason ? colors.error : colors.border,
                      color: colors.text,
                    }}
                  >
                    <option value="">{t('oos_form_reason_placeholder', 'Select travel reason...')}</option>
                    {reasons.map((r) => (
                      <option key={r.id} value={r.id}>
                        {r.reason}
                      </option>
                    ))}
                  </select>
                  {formErrors.reason && (
                    <p className="text-xs font-medium mt-1" style={{ color: colors.error }}>
                      {formErrors.reason}
                    </p>
                  )}
                </div>

                {/* Travel Period Selector */}
                <div>
                  <DateRangePicker
                    startDate={startDate}
                    endDate={endDate}
                    onStartDateChange={(s: string) => setStartDate(s)}
                    onEndDateChange={(e: string) => setEndDate(e)}
                    startLabel={t('oos_form_start_date', 'Start Date')}
                    endLabel={t('oos_form_end_date', 'End Date')}
                    startError={formErrors.startDate}
                    endError={formErrors.endDate}
                  />
                </div>

                {/* Destination Search with Autocomplete */}
                <div className="space-y-1">
                  <label className="block text-sm font-semibold" style={{ color: colors.text }}>
                    {t('oos_form_destination_name', 'Destination Facility/Name')}
                  </label>
                  <div className="relative">
                    <input
                      type="text"
                      placeholder={t('oos_form_destination_name_placeholder', 'e.g., Mbale Regional Referral Hospital')}
                      value={searchQuery}
                      onChange={(e) => {
                        setSearchQuery(e.target.value);
                        setDestinationName(e.target.value);
                        if (!e.target.value) {
                          setDestinationAddress('');
                          setCoords(null);
                        }
                      }}
                      className="w-full border rounded-none px-4 py-3 text-sm outline-none"
                      style={{
                        backgroundColor: colors.surface,
                        borderColor: formErrors.destinationName ? colors.error : colors.border,
                        color: colors.text,
                      }}
                    />
                    <Search
                      size={16}
                      className="absolute right-3.5 top-3.5 pointer-events-none"
                      style={{ color: colors.muted }}
                    />
                  </div>

                  {predictions.length > 0 && (
                    <div
                      className="border border-t-0 max-h-48 overflow-y-auto"
                      style={{
                        backgroundColor: colors.surface,
                        borderColor: colors.border,
                      }}
                    >
                      {predictions.map((p, idx) => (
                        <button
                          key={idx}
                          type="button"
                          onClick={() => selectPrediction(p)}
                          className="w-full p-2.5 text-left text-xs border-b last:border-b-0 hover:bg-gray-50 dark:hover:bg-zinc-800 transition-colors"
                          style={{
                            borderColor: colors.border,
                            color: colors.text,
                          }}
                        >
                          <p className="font-bold">{p.name || p.structured_formatting?.main_text}</p>
                          <p style={{ color: colors.muted }}>{p.address || p.description}</p>
                        </button>
                      ))}
                    </div>
                  )}

                  {formErrors.destinationName && (
                    <p className="text-xs font-medium mt-1" style={{ color: colors.error }}>
                      {formErrors.destinationName}
                    </p>
                  )}
                </div>

                {/* Destination Address — auto-populated, editable */}
                {destinationAddress.length > 0 && (
                  <div className="space-y-1">
                    <label className="block text-sm font-semibold" style={{ color: colors.text }}>
                      {t('oos_form_destination_address', 'Destination Address')}
                    </label>
                    <input
                      type="text"
                      placeholder={t('oos_form_destination_address_placeholder', 'e.g., Pallisa Road, Mbale')}
                      value={destinationAddress}
                      onChange={(e) => setDestinationAddress(e.target.value)}
                      className="w-full border rounded-none px-4 py-3 text-sm outline-none"
                      style={{
                        backgroundColor: colors.surface,
                        borderColor: colors.border,
                        color: colors.text,
                      }}
                    />
                  </div>
                )}

                {/* Fine-tune Location on Map matching Mobile */}
                {coords && (
                  <OosLocationPickerMap
                    coords={coords}
                    onLocationChange={(newCoords) => {
                      setCoords(newCoords);
                      reverseGeocode(newCoords.latitude, newCoords.longitude);
                    }}
                    onUseCurrentLocation={handleUseCurrentLocation}
                    isLocating={isLocating}
                    error={formErrors.coords}
                  />
                )}

                {/* Expected Deliverables */}
                <div className="space-y-1">
                  <label className="block text-sm font-semibold" style={{ color: colors.text }}>
                    {t('oos_form_deliverables', 'Expected Deliverables')}
                  </label>
                  <textarea
                    rows={3}
                    placeholder={t(
                      'oos_form_deliverables_placeholder',
                      'Describe outputs or reports expected from this travel assignment...'
                    )}
                    value={expectedDeliverables}
                    onChange={(e) => setExpectedDeliverables(e.target.value)}
                    className="w-full border rounded-none px-4 py-3 text-sm outline-none"
                    style={{
                      backgroundColor: colors.surface,
                      borderColor: colors.border,
                      color: colors.text,
                    }}
                  />
                </div>

                {/* Remarks */}
                <div className="space-y-1">
                  <label className="block text-sm font-semibold" style={{ color: colors.text }}>
                    {t('oos_form_remarks', 'Remarks')}
                  </label>
                  <textarea
                    rows={2}
                    placeholder={t('oos_form_remarks_placeholder', 'Any additional information or details...')}
                    value={remarks}
                    onChange={(e) => setRemarks(e.target.value)}
                    className="w-full border rounded-none px-4 py-3 text-sm outline-none"
                    style={{
                      backgroundColor: colors.surface,
                      borderColor: colors.border,
                      color: colors.text,
                    }}
                  />
                </div>

                {/* Supporting Travel Documents */}
                <div className="space-y-1">
                  <label className="block text-sm font-semibold mb-2" style={{ color: colors.text }}>
                    {t('oos_form_supporting_docs', 'Supporting Travel Documents')}
                  </label>
                  <AttachmentPicker
                    label=""
                    attachments={attachments}
                    onAttachmentsChange={setAttachments}
                    allowMultiple={false}
                  />
                </div>

                {/* Submit Button matching Mobile */}
                <div className="pt-2">
                  <button
                    type="submit"
                    disabled={createMutation.isPending}
                    className="w-full py-3.5 px-4 text-white font-bold text-sm rounded-none transition-colors disabled:opacity-50 cursor-pointer shadow-sm"
                    style={{ backgroundColor: '#15803D' }}
                  >
                    {createMutation.isPending ? 'Submitting...' : t('oos_form_submit', 'Submit for Supervisor Approval')}
                  </button>
                </div>
              </form>
            </div>
          )}

          {activeTab === 'approvals' && canApprove && (
            <div className="space-y-4 pb-6 max-w-2xl mx-auto w-full">
              <span
                className="text-xs font-bold uppercase tracking-wider block"
                style={{ color: colors.muted }}
              >
                {t('oos_approvals_title', 'Pending Travel Approvals')}
              </span>

              {isLoadingPending ? (
                <div className="py-12 flex flex-col items-center justify-center text-xs" style={{ color: colors.muted }}>
                  <RefreshCw size={20} className="animate-spin mb-2" style={{ color: colors.primary }} />
                </div>
              ) : pendingApprovals.length === 0 ? (
                <div className="py-12 px-6 flex flex-col items-center justify-center text-center">
                  <ClipboardList size={40} className="mb-3 opacity-50" style={{ color: colors.muted }} />
                  <p className="text-sm font-semibold" style={{ color: colors.muted }}>
                    {t('oos_approvals_empty', 'No travel requests waiting for your approval.')}
                  </p>
                </div>
              ) : (
                <div className="space-y-4">
                  {pendingApprovals.map((row: any) => {
                    const approvalId = Number(row.approval_id || row.id);
                    return (
                      <div
                        key={approvalId}
                        className="p-4 border shadow-sm rounded-none"
                        style={{
                          backgroundColor: colors.surface,
                          borderColor: colors.border,
                        }}
                      >
                        {/* Applicant Name */}
                        <div className="flex items-center gap-2 mb-3">
                          <div className="w-8 h-8 rounded-full bg-zinc-100 dark:bg-zinc-800 flex items-center justify-center">
                            <User size={14} style={{ color: colors.text }} />
                          </div>
                          <span className="text-base font-bold flex-1" style={{ color: colors.text }}>
                            {row.staff_name}
                          </span>
                        </div>

                        {/* Travel Details */}
                        <div className="space-y-1.5 mb-3">
                          <div className="flex items-center gap-2">
                            <Calendar size={14} style={{ color: colors.muted }} />
                            <span className="text-xs font-medium" style={{ color: colors.text }}>
                              {row.reason_name} · {formatDateRange(row.start_date, row.end_date)}
                            </span>
                          </div>
                          <div className="flex items-center gap-2">
                            <MapPin size={14} style={{ color: colors.muted }} />
                            <span className="text-xs font-medium" style={{ color: colors.text }}>
                              Destination: {row.destination}
                            </span>
                          </div>
                        </div>

                        {row.expected_deliverables && (
                          <div className="mb-3 p-3 bg-zinc-50 dark:bg-zinc-900 border" style={{ borderColor: colors.border }}>
                            <span className="text-[10px] font-bold uppercase tracking-wider block mb-1" style={{ color: colors.muted }}>
                              {t('oos_form_deliverables', 'Expected Deliverables')}
                            </span>
                            <p className="text-xs" style={{ color: colors.text }}>
                              {row.expected_deliverables}
                            </p>
                          </div>
                        )}

                        {row.remarks && (
                          <p className="text-xs italic mb-4" style={{ color: colors.muted }}>
                            Remarks: "{row.remarks}"
                          </p>
                        )}

                        {/* Supervisor Decision Comments */}
                        <div className="mb-4">
                          <input
                            type="text"
                            value={approvalComments[approvalId] || ''}
                            onChange={(e) =>
                              setApprovalComments((prev) => ({ ...prev, [approvalId]: e.target.value }))
                            }
                            placeholder={t('oos_comment_placeholder', 'Enter decision comments...')}
                            className="w-full px-3 py-2 border text-sm outline-none rounded-none"
                            style={{
                              backgroundColor: colors.surface,
                              borderColor: colors.border,
                              color: colors.text,
                            }}
                          />
                        </div>

                        {/* Approve / Reject Buttons matching Mobile */}
                        <div className="flex gap-3">
                          <button
                            type="button"
                            onClick={() => handleApprovalAction(approvalId, true)}
                            disabled={approveMutation.isPending}
                            className="flex-1 py-2.5 rounded-none flex justify-center items-center gap-1.5 text-white font-bold text-xs cursor-pointer transition-colors"
                            style={{ backgroundColor: colors.success }}
                          >
                            <Check size={14} color="#FFFFFF" />
                            <span>{t('oos_approve_action', 'Approve')}</span>
                          </button>
                          <button
                            type="button"
                            onClick={() => handleApprovalAction(approvalId, false)}
                            disabled={approveMutation.isPending}
                            className="flex-1 py-2.5 rounded-none flex justify-center items-center gap-1.5 text-white font-bold text-xs cursor-pointer transition-colors"
                            style={{ backgroundColor: colors.error }}
                          >
                            <X size={14} color="#FFFFFF" />
                            <span>{t('oos_reject_action', 'Reject')}</span>
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </MainTemplate>
  );
};
export default OosScreen;
