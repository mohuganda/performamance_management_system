import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ScrollView,
  ActivityIndicator,
  Platform,
  KeyboardAvoidingView,
} from 'react-native';
import { useTranslation } from 'react-i18next';
import Geolocation from 'react-native-geolocation-service';
import { Clock, MessageSquare, CheckCircle, AlertTriangle, MapPin } from 'lucide-react-native';
import { MainTemplate } from '../../components/templates';
import { useTheme } from '../../app/hooks/useTheme';
import { useAttendanceListSync, useClockMutation } from '../../app/hooks/useAttendance';
import { showAlert } from '../../stores/alertStore';
import { useLocationPermission } from '../../app/hooks/useLocationPermission';
import { LocationPermissionModal } from '../../components/molecules/LocationPermissionModal';
import { attendanceNotesSchema } from '../../app/schemas/attendance';
import { AttendanceStatusCard } from '../../components/organisms/attendance/AttendanceStatusCard';
import { AttendanceMapCard } from '../../components/organisms/attendance/AttendanceMapCard';
import { AttendanceHistory } from '../../components/organisms/attendance/AttendanceHistory';
import { useOosRequestsSync } from '../../app/hooks/useOos';
import { getDistanceMeters } from '../../utils/haversine';
import { Toaster } from '../../utils/toast';
import { getApiErrorMessage } from '../../api/client';
import withObservables from '@nozbe/with-observables';
import { database } from '../../db';
import AttendanceLog from '../../db/models/AttendanceLog';
import OosRequestModel from '../../db/models/OosRequest';
import { Input } from '../../components/atoms/Input';

// Default map coordinate centered on Kampala, Uganda if location is loading
const DEFAULT_COORDS = {
  latitude: 0.3476,
  longitude: 32.5825,
  latitudeDelta: 0.005,
  longitudeDelta: 0.005,
};

interface AttendanceScreenProps {
  clocks: AttendanceLog[];
  oosRequests: OosRequestModel[];
}

const BaseAttendanceScreen: React.FC<AttendanceScreenProps> = ({ clocks, oosRequests }) => {
  const { t } = useTranslation();
  const { colors, isDark } = useTheme();

  const [coords, setCoords] = useState<{ latitude: number; longitude: number; accuracy?: number } | null>(null);
  const [isLocating, setIsLocating] = useState(false);
  const [geoError, setGeoError] = useState<string | null>(null);
  const [notes, setNotes] = useState('');
  const [notesError, setNotesError] = useState<string | null>(null);
  const [hasCheckedPermission, setHasCheckedPermission] = useState(false);

  // Reusable Location Permissions Hook
  const {
    status,
    showPrimer,
    showBlocked,
    setShowPrimer,
    setShowBlocked,
    checkStatus,
    requestPermission,
    openSettings,
  } = useLocationPermission();

  // TanStack Query Hooks (ListSync triggers background update)
  const clocksQuery = useAttendanceListSync();
  const clockMutation = useClockMutation();
  useOosRequestsSync(); // Just to trigger background sync

  // Find active approved OOS request for today
  const activeOosRequest = useMemo(() => {
    const todayStr = new Date().toISOString().split('T')[0];
    return oosRequests.find((req) => {
      const isApproved = req.status === 'approved';
      if (!isApproved) return false;
      const start = req.startDate.split('T')[0];
      const end = req.endDate.split('T')[0];
      return todayStr >= start && todayStr <= end;
    });
  }, [oosRequests]);

  // Compute distance from current location to approved OOS coordinates
  const oosDistance = useMemo(() => {
    if (!coords || !activeOosRequest) return null;
    return getDistanceMeters(
      coords.latitude,
      coords.longitude,
      activeOosRequest.destinationLatitude,
      activeOosRequest.destinationLongitude
    );
  }, [coords, activeOosRequest]);

  // Determine if user is within the approved OOS geofence bounds (500m fallback)
  const isWithinOosGeofence = useMemo(() => {
    if (oosDistance === null || !activeOosRequest) return false;
    return oosDistance <= (activeOosRequest.geofenceRadiusMeters || 500);
  }, [oosDistance, activeOosRequest]);

  // Background GPS Position capture loop
  const startGPSCapture = useCallback(() => {
    setIsLocating(true);
    setGeoError(null);
    Geolocation.getCurrentPosition(
      (position) => {
        setCoords({
          latitude: position.coords.latitude,
          longitude: position.coords.longitude,
          accuracy: position.coords.accuracy,
        });
        setIsLocating(false);
      },
      (error) => {
        console.error('GPS Position acquisition failed:', error);
        setGeoError(error.message || 'GPS Signal lost. Make sure location is turned on.');
        setIsLocating(false);
      },
      { enableHighAccuracy: true, timeout: 15000, maximumAge: 10000 }
    );
  }, []);

  // Check permissions status on focus/mount
  useEffect(() => {
    checkStatus().then(() => {
      setHasCheckedPermission(true);
    });
  }, [checkStatus]);

  // Handle auto-triggering primer/blocked modal or GPS capture based on status changes
  useEffect(() => {
    if (!hasCheckedPermission) return;

    if (status === 'granted') {
      startGPSCapture();
    } else if (status === 'denied' || status === 'undetermined') {
      setShowPrimer(true);
    } else if (status === 'blocked') {
      setShowBlocked(true);
    }
  }, [status, hasCheckedPermission, startGPSCapture, setShowPrimer, setShowBlocked]);

  // Sort and process attendance logs from local DB (Newest First)
  const sortedClocks = useMemo(() => {
    return [...clocks]
      .sort((a, b) => {
        const timeA = new Date(a.clockedAt || a.createdAt || 0).getTime();
        const timeB = new Date(b.clockedAt || b.createdAt || 0).getTime();
        return timeB - timeA;
      })
      .map((item) => ({
        id: item.remoteId ?? -1,
        action: item.action as 'in' | 'out',
        clocked_at: item.clockedAt,
        created_at: item.createdAt || undefined,
        latitude: item.latitude,
        longitude: item.longitude,
        accuracy_meters: item.accuracyMeters || undefined,
        verified: item.verified || false,
        within_geofence: item.withinGeofence || false,
        notes: item.notes || undefined,
        location_label: item.locationLabel || undefined,
        verification_status: item.verificationStatus || undefined,
        distance_from_destination_meters: item.distanceFromDestinationMeters || undefined,
        isOfflinePending: item.remoteId === null,
      }));
  }, [clocks]);

  const latestClock = sortedClocks[0] || null;
  const isClockedIn = latestClock ? latestClock.action === 'in' : false;

  // Handle Notes field change and run Zod validation locally
  const handleNotesChange = (text: string) => {
    setNotes(text);
    const validationResult = attendanceNotesSchema.safeParse({ notes: text });
    if (!validationResult.success) {
      setNotesError(validationResult.error.issues[0]?.message || 'Invalid notes');
    } else {
      setNotesError(null);
    }
  };

  // Execute Clock In / Out Mutation
  const handleClockAction = () => {
    if (!coords) {
      Toaster.error(t('attendance_err_no_gps'));
      return;
    }

    if (notesError) {
      Toaster.error(notesError);
      return;
    }

    const action = isClockedIn ? 'out' : 'in';
    const actionLabel = isClockedIn ? t('attendance_btn_clock_out') : t('attendance_btn_clock_in');
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
        try {
          const response = await clockMutation.mutateAsync({
            action,
            latitude: coords.latitude,
            longitude: coords.longitude,
            accuracy_meters: coords.accuracy,
            notes: notes.trim(),
            location_label: activeOosRequest ? activeOosRequest.destinationName : undefined,
          });

          if (response === null) {
            Toaster.info(t('attendance_sync_offline'));
          } else {
            Toaster.success(t('attendance_sync_success'));
          }

          setNotes(''); // Clear notes after submission
        } catch (err: unknown) {
          Toaster.error(getApiErrorMessage(err, 'Failed to submit attendance request.'));
        }
      }
    });
  };

  // Formats time strings nicely for the activity feed
  const formatTime = (timeStr?: string) => {
    if (!timeStr) return '—';
    try {
      const d = new Date(timeStr);
      return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
    } catch {
      return '—';
    }
  };

  const formatDate = (timeStr?: string) => {
    if (!timeStr) return '—';
    try {
      const d = new Date(timeStr);
      return d.toLocaleDateString([], { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' });
    } catch {
      return '—';
    }
  };

  const initialRegion = useMemo(() => {
    if (coords) {
      return {
        latitude: coords.latitude,
        longitude: coords.longitude,
        latitudeDelta: 0.003,
        longitudeDelta: 0.003,
      };
    }
    return DEFAULT_COORDS;
  }, [coords]);

  return (
    <>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        className="flex-1"
      >
        <ScrollView
          className="flex-1 px-4 py-3"
          showsVerticalScrollIndicator={false}
        >
          {/* Header Time Card Organism */}
          <AttendanceStatusCard
            isClockedIn={isClockedIn}
            latestClock={latestClock}
            formatTime={formatTime}
          />

          {activeOosRequest && (
            <View
              className="p-4 border mb-4 flex-row items-center gap-3 shadow-sm"
              style={{
                backgroundColor: isWithinOosGeofence ? 'rgba(21, 128, 61, 0.08)' : 'rgba(180, 83, 9, 0.08)',
                borderColor: isWithinOosGeofence ? colors.success : colors.warning,
              }}
            >
              <View className="flex-1">
                <View className="flex-row items-center gap-2 mb-1">
                  <MapPin size={16} color={isWithinOosGeofence ? colors.success : colors.warning} />
                  <Text className="font-bold text-xs flex-1" style={{ color: colors.text }}>
                    {t('oos_active_deployment', { destination: activeOosRequest.destinationName })}
                  </Text>
                </View>
                {oosDistance !== null ? (
                  <View className="flex-row items-center gap-1.5 mt-1">
                    {isWithinOosGeofence ? (
                      <>
                        <CheckCircle size={14} color={colors.success} />
                        <Text className="text-xs font-semibold text-green-700 dark:text-green-400">
                          {t('oos_inside_geofence')}
                        </Text>
                      </>
                    ) : (
                      <>
                        <AlertTriangle size={14} color={colors.warning} />
                        <Text className="text-xs font-semibold text-amber-700 dark:text-amber-400">
                          {t('oos_outside_geofence', { distance: Math.round(oosDistance) })}
                        </Text>
                      </>
                    )}
                  </View>
                ) : (
                  <ActivityIndicator size="small" color={colors.warning} style={{ alignSelf: 'flex-start', marginTop: 4 }} />
                )}
              </View>
            </View>
          )}

          {/* Interactive Map Box Organism */}
          <AttendanceMapCard
            coords={coords}
            isLocating={isLocating}
            geoError={geoError}
            startGPSCapture={startGPSCapture}
            initialRegion={initialRegion}
          />

          {/* Action Module: Clock Trigger & Notes Input */}
          <View
            className="p-4 rounded-none border mb-6 shadow-sm"
            style={{
              backgroundColor: colors.surface,
              borderColor: colors.border,
            }}
          >
            {/* Notes Input Field */}
            <View className="mb-4">
              <View className="flex-row items-center gap-2 mb-2">
                <MessageSquare size={14} color="#9CA3AF" />
                <Text className="text-xs font-bold uppercase tracking-wide" style={{ color: colors.text }}>
                  {t('attendance_notes_label')}
                </Text>
              </View>
              <Input
                value={notes}
                onChangeText={handleNotesChange}
                placeholder={t('attendance_notes_placeholder')}
                multiline
                numberOfLines={3}
                className="w-full py-2.5 rounded-none text-sm text-left"
                placeholderTextColor={isDark ? '#55555C' : '#9CA3AF'}
              />
              {notesError && (
                <Text className="text-xs font-semibold mt-1" style={{ color: colors.error }}>
                  {notesError}
                </Text>
              )}
            </View>

            {/* Action Trigger Button */}
            <TouchableOpacity
              onPress={handleClockAction}
              disabled={!coords || clockMutation.isPending || !!notesError}
              className="py-4 rounded-none items-center justify-center shadow-md flex-row gap-2"
              style={{
                backgroundColor: isClockedIn ? colors.error : colors.success,
                opacity: (!coords || clockMutation.isPending || !!notesError) ? 0.5 : 1,
              }}
            >
              {clockMutation.isPending ? (
                <ActivityIndicator size="small" color="#FFFFFF" />
              ) : (
                <>
                  <Clock size={20} color="#FFFFFF" />
                  <Text className="text-white font-bold text-base">
                    {isClockedIn ? t('attendance_btn_clock_out') : t('attendance_btn_clock_in')}
                  </Text>
                </>
              )}
            </TouchableOpacity>
          </View>

          {/* Activity Logs Timeline Feed Organism */}
          <AttendanceHistory
            isLoading={clocksQuery.isLoading && clocks.length === 0}
            sortedClocks={sortedClocks}
            formatDate={formatDate}
            formatTime={formatTime}
          />
        </ScrollView>
      </KeyboardAvoidingView>

      {/* Permission explanations primer & blocked dialog UI components */}
      <LocationPermissionModal
        isVisible={showPrimer}
        isBlocked={false}
        onCancel={() => setShowPrimer(false)}
        onConfirm={requestPermission}
      />

      <LocationPermissionModal
        isVisible={showBlocked}
        isBlocked={true}
        onCancel={() => setShowBlocked(false)}
        onConfirm={openSettings}
      />
    </>
  );
};

const AttendanceDataObserver = withObservables([], () => ({
  clocks: database.collections.get<AttendanceLog>('attendance_logs').query().observe(),
  oosRequests: database.collections.get<OosRequestModel>('oos_requests').query().observe(),
}))(BaseAttendanceScreen);

export const AttendanceScreen = () => {
  const { t } = useTranslation();
  return (
    <MainTemplate title={t('attendance_title')}>
      <AttendanceDataObserver />
    </MainTemplate>
  );
};
