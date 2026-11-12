import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { Clock, MessageSquare, Loader2 } from 'lucide-react';
import { MainTemplate } from '../../components/templates';
import { AttendanceStatusCard } from '../../components/organisms/AttendanceStatusCard';
import { MapCard } from '../../components/molecules/MapCard';
import { AttendanceHistory } from '../../components/organisms/AttendanceHistory';
import { LocationPermissionModal } from '../../components/molecules/LocationPermissionModal';
import { Input } from '../../components/atoms/Input';
import { useTheme } from '../../hooks/useTheme';
import { showAlert } from '../../stores/alertStore';
import { Toaster } from '../../utils/toast';
import { attendanceNotesSchema } from '../../schemas/attendance';
import { getApiErrorMessage } from '../../api/client';
import { useAttendanceListQuery, useClockMutation } from '../../hooks/useAttendance';
import { ClockRequest } from '../../api/attendance/types';
import { formatDate as formatUtilDate, formatTime as formatUtilTime } from '../../utils/date';

export const AttendanceScreen: React.FC = () => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { colors, isDark } = useTheme();

  const [coords, setCoords] = useState<{ latitude: number; longitude: number; accuracy?: number } | null>(null);
  const [isLocating, setIsLocating] = useState(false);
  const [geoError, setGeoError] = useState<string | null>(null);
  const [notes, setNotes] = useState('');
  const [notesError, setNotesError] = useState<string | null>(null);
  const [showPermissionModal, setShowPermissionModal] = useState(false);
  const [isPermissionBlocked, setIsPermissionBlocked] = useState(false);

  // TanStack Query custom hooks offload list fetching, offline cache, and clock mutations
  const { data: clocks = [], isLoading: isLoadingClocks } = useAttendanceListQuery();
  const clockMutation = useClockMutation();

  // Background GPS Position acquisition loop
  const startGPSCapture = useCallback(() => {
    if (!navigator.geolocation) {
      setGeoError('Geolocation is not supported by your browser.');
      return;
    }

    setIsLocating(true);
    setGeoError(null);

    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setCoords({
          latitude: pos.coords.latitude,
          longitude: pos.coords.longitude,
          accuracy: pos.coords.accuracy,
        });
        setIsLocating(false);
      },
      (err) => {
        console.warn('GPS Position acquisition failed:', err);
        setIsLocating(false);
        if (err.code === 1) { // PERMISSION_DENIED
          setIsPermissionBlocked(true);
          setShowPermissionModal(true);
          setGeoError('Location permission denied. Please allow GPS access.');
        } else if (err.code === 2) {
          setGeoError('GPS Signal lost. Make sure location is turned on.');
        } else {
          setGeoError('GPS acquisition timed out. Please retry.');
        }
      },
      { enableHighAccuracy: true, timeout: 15000, maximumAge: 10000 }
    );
  }, []);

  useEffect(() => {
    startGPSCapture();
  }, [startGPSCapture]);

  const sortedClocks = useMemo(() => {
    return [...clocks].sort((a, b) => {
      const timeA = new Date(a.clocked_at || (a as any).created_at || 0).getTime();
      const timeB = new Date(b.clocked_at || (b as any).created_at || 0).getTime();
      return timeB - timeA;
    });
  }, [clocks]);

  const latestClock = sortedClocks[0] || null;
  const isClockedIn = latestClock ? latestClock.action === 'in' : false;

  const handleNotesChange = (text: string) => {
    setNotes(text);
    const validationResult = attendanceNotesSchema.safeParse({ notes: text });
    if (!validationResult.success) {
      setNotesError(validationResult.error.issues[0]?.message || 'Invalid notes');
    } else {
      setNotesError(null);
    }
  };

  const handleClockAction = () => {
    if (!coords) {
      Toaster.error(t('attendance_err_no_gps', 'GPS coordinates required. Please ensure location is enabled.'));
      startGPSCapture();
      return;
    }

    if (notesError) {
      Toaster.error(notesError);
      return;
    }

    const action = isClockedIn ? 'out' : 'in';
    const actionLabel = isClockedIn
      ? t('attendance_btn_clock_out', 'Clock Out')
      : t('attendance_btn_clock_in', 'Clock In');
    const confirmMessage = isClockedIn
      ? t('attendance_confirm_clock_out', 'Are you sure you want to clock out for the day?')
      : t('attendance_confirm_clock_in', 'Are you sure you want to clock in now?');

    showAlert({
      type: 'info',
      title: actionLabel,
      message: confirmMessage,
      cancelText: t('common_cancel', 'Cancel'),
      confirmText: actionLabel,
      onConfirm: async () => {
        const payload: ClockRequest = {
          action,
          clock_type: action,
          latitude: coords.latitude,
          longitude: coords.longitude,
          accuracy_meters: coords.accuracy,
          notes: notes.trim() || undefined,
          clocked_at: new Date().toISOString(),
        };

        clockMutation.mutate(payload, {
          onSuccess: (res) => {
            if (res?.verified === false && !navigator.onLine) {
              Toaster.info(t('attendance_sync_offline', 'Attendance clocked offline. Will sync when reconnected.'));
            } else {
              Toaster.success(
                action === 'in'
                  ? t('attendance_success_clock_in', 'Clocked in successfully!')
                  : t('attendance_success_clock_out', 'Clocked out successfully!')
              );
            }
            setNotes('');
          },
          onError: (err) => {
            Toaster.error(getApiErrorMessage(err, 'Failed to submit attendance request.'));
          },
        });
      },
    });
  };

  const formatTime = (timeStr?: string) => {
    if (!timeStr) return '—';
    return formatUtilTime(timeStr);
  };

  const formatDate = (timeStr?: string) => {
    if (!timeStr) return '—';
    return formatUtilDate(timeStr, 'ddd, MMM D, YYYY');
  };

  return (
    <MainTemplate title={t('attendance_title', 'Duty Attendance')}>
      <div className="p-4 space-y-4">
        {/* Header Time Card Organism */}
        <AttendanceStatusCard
          isClockedIn={isClockedIn}
          latestClock={latestClock}
          formatTime={formatTime}
        />

        {/* Interactive Map Box Organism */}
        <MapCard
          coords={coords}
          isLocating={isLocating}
          geoError={geoError}
          onRefreshGps={startGPSCapture}
          heightClass="h-44"
        />

        {/* Action Module: Clock Trigger & Notes Input */}
        <div
          className="p-4 rounded-none border mb-6 shadow-sm transition-colors"
          style={{
            backgroundColor: colors.surface,
            borderColor: colors.border,
          }}
        >
          {/* Notes Input Field */}
          <div className="mb-4">
            <div className="flex items-center gap-2 mb-2">
              <MessageSquare size={14} className="text-gray-400" />
              <span
                className="text-xs font-bold uppercase tracking-wide"
                style={{ color: colors.text }}
              >
                {t('attendance_notes_label', 'Duty Remarks')}
              </span>
            </div>
            <Input
              multiline
              rows={3}
              value={notes}
              onChange={(e) => handleNotesChange(e.target.value)}
              placeholder={t('attendance_notes_placeholder', 'Add optional shift remarks or task notes...')}
              className="w-full py-2.5 rounded-none text-sm text-left"
              error={notesError || undefined}
            />
          </div>

          {/* Action Trigger Button */}
          <button
            onClick={handleClockAction}
            disabled={!coords || clockMutation.isPending || !!notesError}
            className="w-full py-4 rounded-none flex items-center justify-center gap-2 shadow-md font-bold text-base text-white transition-opacity active:opacity-90"
            style={{
              backgroundColor: isClockedIn ? colors.error : colors.success,
              opacity: !coords || clockMutation.isPending || !!notesError ? 0.5 : 1,
              cursor: !coords || clockMutation.isPending || !!notesError ? 'not-allowed' : 'pointer',
            }}
          >
            {clockMutation.isPending ? (
              <Loader2 className="animate-spin" size={20} color="#FFFFFF" />
            ) : (
              <>
                <Clock size={20} color="#FFFFFF" />
                <span>
                  {isClockedIn
                    ? t('attendance_btn_clock_out', 'Clock Out')
                    : t('attendance_btn_clock_in', 'Clock In')}
                </span>
              </>
            )}
          </button>
        </div>

        {/* Activity Logs Timeline Feed Organism */}
        <AttendanceHistory
          isLoading={isLoadingClocks && clocks.length === 0}
          sortedClocks={sortedClocks}
          formatDate={formatDate}
          formatTime={formatTime}
          onPressItem={(log) =>
            navigate(`/attendance/${log.id || (log as any).entry_id}`, {
              state: { log },
            })
          }
        />
      </div>

      <LocationPermissionModal
        visible={showPermissionModal}
        isBlocked={isPermissionBlocked}
        onCancel={() => setShowPermissionModal(false)}
        onConfirm={() => {
          setShowPermissionModal(false);
          startGPSCapture();
        }}
      />
    </MainTemplate>
  );
};
export default AttendanceScreen;
