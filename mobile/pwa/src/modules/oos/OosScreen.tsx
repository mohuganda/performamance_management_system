import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { MapPin, FileText, CheckSquare, Search, RefreshCw, Calendar, ChevronRight } from 'lucide-react';
import { MainTemplate } from '../../components/templates';
import { Card } from '../../components/atoms/Card';
import { Badge } from '../../components/atoms/Badge';
import { Button } from '../../components/atoms/Button';
import { Input } from '../../components/atoms/Input';
import { DateRangePicker } from '../../components/molecules/DateRangePicker';
import { AttachmentPicker, AttachmentFile } from '../../components/molecules/AttachmentPicker';
import { MapCard } from '../../components/molecules/MapCard';
import { useTheme } from '../../hooks/useTheme';
import { useAuthStore } from '../../stores/authStore';
import { Toaster } from '../../utils/toast';
import { getApiErrorMessage } from '../../api/client';
import { useOosReasonsQuery, useOosRequestsQuery, useCreateOosMutation } from '../../hooks/useOos';
import { usePlacesSearch } from '../../hooks/usePlacesSearch';
import { OosSubmissionPayload } from '../../api/oos/types';
import { GooglePlacePrediction } from '../../api/maps/types';
import { formatDate } from '../../utils/date';

export const OosScreen: React.FC = () => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { colors } = useTheme();
  const { hasPermission } = useAuthStore();

  const canApprove = hasPermission('oos.requests.approve');
  const [activeTab, setActiveTab] = useState<'history' | 'apply' | 'approvals'>('history');

  // TanStack Query custom hooks offload all OOS data queries, caching, and mutation queueing
  const { data: reasons = [], isLoading: isLoadingReasons } = useOosReasonsQuery();
  const { data: requests = [], isLoading: isLoadingRequests, refetch: refetchRequests } = useOosRequestsQuery();
  const isLoading = isLoadingReasons || isLoadingRequests;
  const createMutation = useCreateOosMutation();

  // Form State
  const [selectedReasonId, setSelectedReasonId] = useState<number | null>(null);
  const [startDate, setStartDate] = useState<string | null>(null);
  const [endDate, setEndDate] = useState<string | null>(null);
  const [destinationName, setDestinationName] = useState('');
  const [destinationAddress, setDestinationAddress] = useState('');
  const [coords, setCoords] = useState<{ latitude: number; longitude: number } | null>(null);
  const [expectedDeliverables, setExpectedDeliverables] = useState('');
  const [remarks, setRemarks] = useState('');
  const [attachments, setAttachments] = useState<AttachmentFile[]>([]);
  const [formErrors, setFormErrors] = useState<Record<string, string>>({});

  // Places Search custom hook
  const {
    searchQuery,
    setSearchQuery,
    predictions,
    selectPrediction,
    clearSearch,
  } = usePlacesSearch({
    onPlaceSelected: (res) => {
      setDestinationName(res.name);
      setDestinationAddress(res.formatted_address);
      setCoords({ latitude: res.latitude, longitude: res.longitude });
    },
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormErrors({});

    const errors: Record<string, string> = {};
    if (!selectedReasonId) errors.reason = 'Please select a reason';
    if (!destinationName.trim()) errors.destinationName = 'Destination is required';
    if (!startDate) errors.startDate = 'Start date is required';
    if (!endDate) errors.endDate = 'End date is required';
    if (!coords) errors.coords = 'Please choose a destination location';

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
      expected_deliverables: expectedDeliverables.trim() || undefined,
      remarks: remarks.trim() || undefined,
      attachment_url: attachments.length > 0 ? attachments[0].dataUrl : undefined,
      submit: true,
    };

    createMutation.mutate(payload, {
      onSuccess: (data) => {
        if (data?.offline) {
          Toaster.info(t('oos_sync_offline', 'Travel request saved offline. Will sync when reconnected.'));
        } else {
          Toaster.success(t('oos_submit_success', 'Travel request submitted successfully!'));
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

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'approved':
        return <Badge label={t('status_approved', 'Approved')} variant="success" />;
      case 'rejected':
        return <Badge label={t('status_rejected', 'Rejected')} variant="error" />;
      default:
        return <Badge label={t('status_pending', 'Pending Approval')} variant="warning" />;
    }
  };

  return (
    <MainTemplate title={t('oos_title', 'Out of Station Duty')} showBack>
      <div className="flex flex-col">
        {/* Tab Selection Bar */}
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
            className="flex-1 py-4 flex items-center justify-center gap-1.5 border-b-2 text-xs font-bold transition-colors"
            style={{
              borderBottomColor: activeTab === 'history' ? colors.primary : 'transparent',
              color: activeTab === 'history' ? colors.primary : colors.muted,
            }}
          >
            <FileText size={16} />
            <span>{t('oos_tab_history', 'History')}</span>
          </button>

          {/* New Application Tab */}
          <button
            onClick={() => setActiveTab('apply')}
            className="flex-1 py-4 flex items-center justify-center gap-1.5 border-b-2 text-xs font-bold transition-colors"
            style={{
              borderBottomColor: activeTab === 'apply' ? colors.primary : 'transparent',
              color: activeTab === 'apply' ? colors.primary : colors.muted,
            }}
          >
            <MapPin size={16} />
            <span>{t('oos_tab_apply', 'New Request')}</span>
          </button>

          {/* Approvals Tab */}
          {canApprove && (
            <button
              onClick={() => setActiveTab('approvals')}
              className="flex-1 py-4 flex items-center justify-center gap-1.5 border-b-2 text-xs font-bold transition-colors"
              style={{
                borderBottomColor: activeTab === 'approvals' ? colors.primary : 'transparent',
                color: activeTab === 'approvals' ? colors.primary : colors.muted,
              }}
            >
              <CheckSquare size={16} />
              <span>{t('oos_tab_approvals', 'Approvals')}</span>
            </button>
          )}
        </div>

        {/* Tab Contents */}
        <div className="p-4 space-y-4">
          {activeTab === 'history' && (
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <span
                  className="text-xs font-bold uppercase tracking-wider"
                  style={{ color: colors.muted }}
                >
                  Out-of-Station Travel Duties
                </span>
                <button
                  onClick={() => refetchRequests()}
                  disabled={isLoading}
                  className="text-xs flex items-center gap-1 hover:opacity-80 transition-opacity"
                  style={{ color: colors.muted }}
                >
                  <RefreshCw size={12} className={isLoading ? 'animate-spin' : ''} />
                  Refresh
                </button>
              </div>

              {requests.length === 0 ? (
                <Card className="p-6 text-center text-xs" style={{ color: colors.muted }}>
                  No travel duty assignments on record.
                </Card>
              ) : (
                <div className="space-y-2.5">
                  {requests.map((item) => (
                    <Card
                      key={item.id}
                      onClick={() => navigate(`/oos/${item.id}`)}
                      className="p-4 space-y-2 cursor-pointer transition-colors"
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-1.5 text-sm font-bold" style={{ color: colors.text }}>
                          <MapPin size={16} className="text-blue-500 flex-shrink-0" />
                          <span className="truncate">{item.destination_name}</span>
                        </div>
                        {getStatusBadge(item.status)}
                      </div>

                      <div className="flex items-center justify-between text-xs" style={{ color: colors.muted }}>
                        <div className="flex items-center gap-1">
                          <Calendar size={13} />
                          <span>
                            {formatDate(item.start_date)} - {formatDate(item.end_date)}
                          </span>
                        </div>
                        <ChevronRight size={16} />
                      </div>
                    </Card>
                  ))}
                </div>
              )}
            </div>
          )}

          {activeTab === 'apply' && (
            <Card className="p-5">
              <form onSubmit={handleSubmit} className="space-y-4">
                {/* Reason Select */}
                <div>
                  <label className="block text-sm font-medium mb-1" style={{ color: colors.text }}>
                    Official Reason / Purpose
                  </label>
                  <select
                    value={selectedReasonId || ''}
                    onChange={(e) => setSelectedReasonId(Number(e.target.value))}
                    className="w-full border rounded-none px-4 py-3 bg-white dark:bg-[#1E1E1E] text-base outline-none"
                    style={{
                      borderColor: formErrors.reason ? colors.error : colors.border,
                      color: colors.text,
                    }}
                  >
                    <option value="">Select official purpose...</option>
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

                {/* Places Search */}
                <div>
                  <label className="block text-sm font-medium mb-1" style={{ color: colors.text }}>
                    Destination Facility / Location
                  </label>
                  <div className="relative">
                    <input
                      type="text"
                      placeholder="Search facility name, district or hospital..."
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      className="w-full border rounded-none px-4 py-3 bg-white dark:bg-[#1E1E1E] text-base outline-none"
                      style={{
                        borderColor: formErrors.destinationName ? colors.error : colors.border,
                        color: colors.text,
                      }}
                    />
                    <Search
                      size={16}
                      className="absolute right-3.5 top-3.5"
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
                          className="w-full p-2.5 text-left text-xs border-b last:border-b-0 hover:bg-gray-50 dark:hover:bg-zinc-800"
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

                  {destinationName && (
                    <div
                      className="mt-2 p-2.5 rounded-none border text-xs flex items-center justify-between"
                      style={{
                        backgroundColor: `${colors.primary}08`,
                        borderColor: colors.primary,
                      }}
                    >
                      <div>
                        <p className="font-bold" style={{ color: colors.text }}>
                          {destinationName}
                        </p>
                        {destinationAddress && (
                          <p style={{ color: colors.muted }}>{destinationAddress}</p>
                        )}
                      </div>
                      <span className="text-[10px] font-bold text-emerald-600 uppercase">Selected</span>
                    </div>
                  )}
                </div>

                {/* Map Preview */}
                {coords && (
                  <MapCard
                    coords={coords}
                    targetCoords={coords}
                    isLocating={false}
                    geoError={null}
                    heightClass="h-40"
                  />
                )}

                {/* Date Range */}
                <div>
                  <DateRangePicker
                    startDate={startDate}
                    endDate={endDate}
                    onStartDateChange={(s: string) => setStartDate(s)}
                    onEndDateChange={(e: string) => setEndDate(e)}
                    startError={formErrors.startDate}
                    endError={formErrors.endDate}
                  />
                </div>

                {/* Expected Deliverables */}
                <div>
                  <Input
                    label="Key Deliverables / Assignment Terms"
                    multiline
                    rows={2}
                    placeholder="Specific outcomes expected upon completion..."
                    value={expectedDeliverables}
                    onChange={(e) => setExpectedDeliverables(e.target.value)}
                  />
                </div>

                {/* Remarks */}
                <div>
                  <Input
                    label="Additional Remarks (Optional)"
                    multiline
                    rows={2}
                    placeholder="Any notes or logistical details..."
                    value={remarks}
                    onChange={(e) => setRemarks(e.target.value)}
                  />
                </div>

                {/* Attachments */}
                <div>
                  <AttachmentPicker
                    label="Letter of Invitation / Memo"
                    attachments={attachments}
                    onAttachmentsChange={setAttachments}
                    allowMultiple={false}
                  />
                </div>

                <div className="pt-2">
                  <Button
                    type="submit"
                    title="Submit Travel Request"
                    loading={createMutation.isPending}
                    className="py-4"
                  />
                </div>
              </form>
            </Card>
          )}

          {activeTab === 'approvals' && (
            <Card className="p-6 text-center text-xs" style={{ color: colors.muted }}>
              Manage supervisor reviews directly via the Approvals Inbox tab.
            </Card>
          )}
        </div>
      </div>
    </MainTemplate>
  );
};
export default OosScreen;
