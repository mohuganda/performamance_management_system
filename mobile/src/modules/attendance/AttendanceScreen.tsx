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
  KeyboardAvoidingView
} from 'react-native';
import { useTranslation } from 'react-i18next';
import Geolocation from 'react-native-geolocation-service';
import MapView, { Marker, Circle } from 'react-native-maps';
import { MapPin, Navigation, Clock, MessageSquare, CheckCircle, HelpCircle } from 'lucide-react-native';
import { MainTemplate } from '../../components/templates';
import { useTheme } from '../../app/hooks/useTheme';
import { useAuthStore } from '../../stores/authStore';
import { useAttendanceListQuery, useClockMutation } from '../../app/hooks/useAttendance';
import { useLocationPermission } from '../../app/hooks/useLocationPermission';
import { LocationPermissionModal } from '../../components/molecules/LocationPermissionModal';
import { ActiveShiftTimer } from '../../components/molecules/ActiveShiftTimer';
import { attendanceNotesSchema } from '../../app/schemas/attendance';

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
  const { staffId } = useAuthStore();

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
          {/* Header Time Card */}
          <View 
            className="p-5 rounded-2xl border mb-4 shadow-sm"
            style={{ 
              backgroundColor: colors.surface, 
              borderColor: colors.border 
            }}
          >
            <View className="flex-row justify-between items-center mb-3">
              <Text className="text-gray-400 font-semibold uppercase text-xs tracking-wider">
                {t('attendance_status_label')}
              </Text>
              <View className="flex-row items-center gap-1">
                <Clock size={14} color="#9CA3AF" />
                <Text className="text-gray-400 font-medium text-xs">
                  {new Date().toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' })}
                </Text>
              </View>
            </View>

            {isClockedIn && latestClock ? (
              <ActiveShiftTimer clockedInAt={latestClock.clocked_at || latestClock.created_at || ''} />
            ) : (
              <View className="flex-row items-center gap-3 py-2">
                <View className="w-10 h-10 rounded-full items-center justify-center bg-gray-100 dark:bg-gray-800">
                  <Clock size={20} color="#9CA3AF" />
                </View>
                <View>
                  <Text className="text-2xl font-bold font-mono tracking-wide" style={{ color: colors.text }}>
                    {t('attendance_status_clocked_out')}
                  </Text>
                  <Text className="text-xs text-gray-400 font-semibold mt-0.5">
                    {latestClock ? `Last Shift End: ${formatTime(latestClock.clocked_at || latestClock.created_at)}` : 'No logs recorded for today'}
                  </Text>
                </View>
              </View>
            )}
          </View>

          {/* Interactive Map Box */}
          <View 
            className="rounded-2xl border overflow-hidden mb-4 shadow-sm"
            style={{ 
              backgroundColor: colors.surface, 
              borderColor: colors.border 
            }}
          >
            <View className="px-4 py-3 border-b flex-row justify-between items-center" style={{ borderColor: colors.border }}>
              <View className="flex-row items-center gap-2">
                <Navigation size={16} color={coords ? colors.success : '#9CA3AF'} />
                <Text className="font-semibold text-sm" style={{ color: colors.text }}>
                  {coords ? t('attendance_gps_locked') : t('attendance_gps_searching')}
                </Text>
              </View>
              {coords?.accuracy && (
                <Text className="text-xs text-gray-400 font-medium">
                  ±{Math.round(coords.accuracy)}m Accuracy
                </Text>
              )}
            </View>

            <View className="h-44 w-full relative justify-center items-center">
              <MapView
                className="w-full h-full"
                region={initialRegion}
                scrollEnabled={false}
                zoomEnabled={false}
                pitchEnabled={false}
                rotateEnabled={false}
                userInterfaceStyle={isDark ? 'dark' : 'light'}
              >
                {coords && (
                  <>
                    <Marker coordinate={coords}>
                      <View className="w-7 h-7 rounded-full bg-blue-500/20 items-center justify-center border-2 border-white">
                        <View className="w-3.5 h-3.5 rounded-full bg-blue-500" />
                      </View>
                    </Marker>
                    <Circle
                      center={coords}
                      radius={coords.accuracy || 15}
                      fillColor="rgba(59, 130, 246, 0.15)"
                      strokeColor="rgba(59, 130, 246, 0.3)"
                      strokeWidth={1}
                    />
                  </>
                )}
              </MapView>

              {isLocating && (
                <View className="absolute inset-0 bg-black/35 justify-center items-center">
                  <ActivityIndicator size="small" color="#FFFFFF" />
                  <Text className="text-white font-medium text-xs mt-2">Locating Device...</Text>
                </View>
              )}

              {geoError && (
                <View className="absolute inset-0 bg-black/75 justify-center items-center px-6">
                  <Text className="text-red-400 text-center text-xs font-semibold leading-relaxed">
                    {geoError}
                  </Text>
                  <TouchableOpacity 
                    onPress={startGPSCapture}
                    className="mt-3 px-3 py-1.5 rounded-lg bg-red-600/30 border border-red-500/50"
                  >
                    <Text className="text-white text-xs font-bold">Retry GPS Lock</Text>
                  </TouchableOpacity>
                </View>
              )}
            </View>
          </View>

          {/* Action Module: Clock Trigger & Notes Input */}
          <View 
            className="p-4 rounded-2xl border mb-6 shadow-sm"
            style={{ 
              backgroundColor: colors.surface, 
              borderColor: colors.border 
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
                  minHeight: 70
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
                opacity: (!coords || clockMutation.isPending || !!notesError) ? 0.5 : 1
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

          {/* Activity Logs Timeline Feed */}
          <View className="mb-10">
            <Text className="font-bold text-base mb-4 uppercase tracking-wider text-gray-500">
              {t('attendance_history_title')}
            </Text>

            {clocksQuery.isLoading ? (
              <ActivityIndicator size="small" color={colors.primary} className="my-6" />
            ) : sortedClocks.length === 0 ? (
              <View className="items-center py-8">
                <Text className="text-sm text-gray-400 font-medium">No recent logs recorded.</Text>
              </View>
            ) : (
              <View className="flex-col pl-2">
                {sortedClocks.map((row, index) => {
                  const isRowIn = row.action === 'in';
                  const timestamp = row.clocked_at || row.created_at;
                  return (
                    <View key={row.id || index} className="flex-row items-start relative pb-6">
                      {/* Vertical connector line */}
                      {index < sortedClocks.length - 1 && (
                        <View 
                          className="absolute w-[2px] bottom-0 top-8 left-4"
                          style={{ backgroundColor: colors.border }}
                        />
                      )}
                      
                      {/* Status indicator bubble */}
                      <View 
                        className="w-8 h-8 rounded-full items-center justify-center border z-10 mr-4 shadow-sm"
                        style={{ 
                          backgroundColor: isRowIn ? 'rgba(21, 128, 61, 0.1)' : 'rgba(217, 0, 0, 0.1)',
                          borderColor: isRowIn ? colors.success : colors.error
                        }}
                      >
                        <Text 
                          className="font-bold text-xs uppercase"
                          style={{ color: isRowIn ? colors.success : colors.error }}
                        >
                          {isRowIn ? 'IN' : 'OUT'}
                        </Text>
                      </View>

                      {/* Log details card */}
                      <View 
                        className="flex-1 p-4 rounded-xl border"
                        style={{ 
                          backgroundColor: colors.surface,
                          borderColor: colors.border
                        }}
                      >
                        <View className="flex-row items-center justify-between mb-1.5">
                          <Text className="font-bold text-sm" style={{ color: colors.text }}>
                            {formatDate(timestamp)}
                          </Text>
                          <Text className="text-xs text-gray-400 font-medium">
                            {formatTime(timestamp)}
                          </Text>
                        </View>

                        <Text className="text-xs text-gray-400" style={{ lineHeight: 16 }}>
                          GPS: {row.latitude != null && row.longitude != null
                            ? `${row.latitude.toFixed(5)}, ${row.longitude.toFixed(5)}`
                            : '—'}
                        </Text>

                        {row.notes ? (
                          <View className="mt-2 pt-2 border-t" style={{ borderColor: `${colors.border}50` }}>
                            <Text className="text-xs italic text-gray-500 dark:text-gray-400">
                              "{row.notes}"
                            </Text>
                          </View>
                        ) : null}

                        {/* Verification details badge */}
                        <View className="flex-row justify-end mt-2">
                          <View className="flex-row items-center gap-1 px-2 py-0.5 rounded-full bg-gray-100 dark:bg-gray-800">
                            {row.verified || row.within_geofence ? (
                              <>
                                <CheckCircle size={10} color={colors.success} />
                                <Text className="text-[10px] font-bold text-green-700 dark:text-green-400">Verified</Text>
                              </>
                            ) : (
                              <>
                                <HelpCircle size={10} color={colors.warning} />
                                <Text className="text-[10px] font-bold" style={{ color: colors.warning }}>Pending Verification</Text>
                              </>
                            )}
                          </View>
                        </View>
                      </View>
                    </View>
                  );
                })}
              </View>
            )}
          </View>
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
