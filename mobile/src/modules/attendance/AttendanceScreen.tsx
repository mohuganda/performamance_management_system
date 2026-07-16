import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ScrollView,
  ActivityIndicator,
  Alert,
  Platform,
  KeyboardAvoidingView,
} from 'react-native';
import { useTranslation } from 'react-i18next';
import Geolocation from 'react-native-geolocation-service';
import { Clock, MessageSquare } from 'lucide-react-native';
import { MainTemplate } from '../../components/templates';
import { useTheme } from '../../app/hooks/useTheme';
import { useAttendanceListQuery, useClockMutation } from '../../app/hooks/useAttendance';
import { useLocationPermission } from '../../app/hooks/useLocationPermission';
import { LocationPermissionModal } from '../../components/molecules/LocationPermissionModal';
import { attendanceNotesSchema } from '../../app/schemas/attendance';
import { AttendanceStatusCard } from '../../components/organisms/AttendanceStatusCard';
import { AttendanceMapCard } from '../../components/organisms/AttendanceMapCard';
import { AttendanceHistory } from '../../components/organisms/AttendanceHistory';

// Default map coordinate centered on Kampala, Uganda if location is loading
const DEFAULT_COORDS = {
  latitude: 0.3476,
  longitude: 32.5825,
  latitudeDelta: 0.005,
  longitudeDelta: 0.005,
};

export function AttendanceScreen() {
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

  // TanStack Query Hooks
  const clocksQuery = useAttendanceListQuery();
  const clockMutation = useClockMutation();

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

  // Sort and process attendance logs (Newest First)
  const sortedClocks = useMemo(() => {
    const clocks = Array.isArray(clocksQuery.data) ? clocksQuery.data : [];
    return [...clocks].sort((a, b) => {
      const timeA = new Date(a.clocked_at || a.created_at || 0).getTime();
      const timeB = new Date(b.clocked_at || b.created_at || 0).getTime();
      return timeB - timeA;
    });
  }, [clocksQuery.data]);

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
  const handleClockAction = async () => {
    if (!coords) {
      Alert.alert('Error', t('attendance_err_no_gps'));
      return;
    }

    if (notesError) {
      Alert.alert('Error', notesError);
      return;
    }

    const action = isClockedIn ? 'out' : 'in';

    try {
      const response = await clockMutation.mutateAsync({
        action,
        latitude: coords.latitude,
        longitude: coords.longitude,
        accuracy_meters: coords.accuracy,
        notes: notes.trim(),
      });

      if (response === null) {
        Alert.alert(t('attendance_title'), t('attendance_sync_offline'));
      } else {
        Alert.alert(t('attendance_title'), t('attendance_sync_success'));
      }

      setNotes(''); // Clear notes after submission
    } catch (err: any) {
      Alert.alert('Error', err.message || 'Failed to submit attendance request.');
    }
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
    <MainTemplate title={t('attendance_title')}>
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
            className="p-4 rounded-2xl border mb-6 shadow-sm"
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
              <TextInput
                value={notes}
                onChangeText={handleNotesChange}
                placeholder={t('attendance_notes_placeholder')}
                multiline
                numberOfLines={3}
                className="w-full px-3 py-2.5 rounded-xl border text-sm text-left"
                style={{
                  backgroundColor: isDark ? '#1C1C1E' : '#F9F9F9',
                  borderColor: notesError ? colors.error : colors.border,
                  color: colors.text,
                  textAlignVertical: 'top',
                  minHeight: 70,
                }}
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
              className="py-4 rounded-xl items-center justify-center shadow-md flex-row gap-2"
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
            isLoading={clocksQuery.isLoading}
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
    </MainTemplate>
  );
}
export default AttendanceScreen;
