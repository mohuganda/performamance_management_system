import React, { useState, useEffect, useMemo, useCallback } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  TextInput,
  StyleSheet,
} from 'react-native';
import { useRoute, useNavigation } from '@react-navigation/native';
import { useTranslation } from 'react-i18next';
import MapView, { Marker, Circle } from 'react-native-maps';
import Geolocation from 'react-native-geolocation-service';
import withObservables from '@nozbe/with-observables';
import { Q } from '@nozbe/watermelondb';
import {
  MapPin,
  Calendar,
  CheckCircle2,
  AlertTriangle,
  Clock,
  Navigation,
  RefreshCw,
  Info,
  ShieldCheck,
} from 'lucide-react-native';

import { MainTemplate } from '../../components/templates';
import { Card } from '../../components/atoms/Card';
import { Button } from '../../components/atoms/Button';
import { LocationPermissionModal } from '../../components/molecules/LocationPermissionModal';
import { useTheme } from '../../app/hooks/useTheme';
import { useClockMutation } from '../../app/hooks/useAttendance';
import { useOosReasonsQuery } from '../../app/hooks/useOos';
import { useLocationPermission } from '../../app/hooks/useLocationPermission';
import { database } from '../../db';
import OosRequestModel from '../../db/models/OosRequest';
import AttendanceLog from '../../db/models/AttendanceLog';
import { formatDateRange } from '../../utils/date';
import { getDistanceMeters } from '../../utils/haversine';
import { Toaster } from '../../utils/toast';
import { getApiErrorMessage } from '../../api/client';

interface BaseOosDetailsScreenProps {
  requests: OosRequestModel[];
  attendanceLogs: AttendanceLog[];
}

const DEFAULT_GEOFENCE_RADIUS = 500; // 500 meters
const KAMPALA_COORDS = { latitude: 0.3476, longitude: 32.5825 };

const BaseOosDetailsScreen: React.FC<BaseOosDetailsScreenProps> = ({
  requests,
  attendanceLogs,
}) => {
  const { t } = useTranslation();
  const { colors, isDark } = useTheme();

  const request = requests[0] || null;

  const reasonsQuery = useOosReasonsQuery();
  const clockMutation = useClockMutation();

  // Location Permissions & GPS State
  const {
    showPrimer,
    showBlocked,
    setShowPrimer,
    setShowBlocked,
    requestPermission,
    openSettings,
    checkStatus,
  } = useLocationPermission();

  const [coords, setCoords] = useState<{
    latitude: number;
    longitude: number;
    accuracy?: number;
  } | null>(null);
  const [isLocating, setIsLocating] = useState(false);
  const [notes, setNotes] = useState('');

  // Reason Name lookup
  const reasonLabel = useMemo(() => {
    if (!request) return '';
    if (Array.isArray(reasonsQuery.data)) {
      const found = reasonsQuery.data.find((r) => r.id === request.reasonId);
      if (found) return found.reason;
    }
    return 'Travel Duty Assignment';
  }, [request, reasonsQuery.data]);

  // Determine current active shift status specifically for this out-of-station request
  const oosClocks = useMemo(() => {
    if (!attendanceLogs || attendanceLogs.length === 0 || !request) return [];
    const reqRemoteId = request.remoteId;
    const reqLocalId = request.id;
    return [...attendanceLogs]
      .filter((log) => {
        if (!log.outOfStationRequestId) return false;
        if (reqRemoteId && log.outOfStationRequestId === reqRemoteId) return true;
        if (String(log.outOfStationRequestId) === String(reqRemoteId) || String(log.outOfStationRequestId) === String(reqLocalId)) return true;
        return false;
      })
      .sort((a, b) => {
        const timeA = new Date(a.clockedAt || a.createdAt || 0).getTime();
        const timeB = new Date(b.clockedAt || b.createdAt || 0).getTime();
        return timeB - timeA;
      });
  }, [attendanceLogs, request]);

  const latestClock = oosClocks[0] || null;
  const isClockedIn = latestClock ? latestClock.action === 'in' : false;

  // Capture GPS position
  const fetchLocation = useCallback(() => {
    setIsLocating(true);
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
        console.warn('[OosDetails] GPS acquisition error:', error);
        setIsLocating(false);
      },
      {
        enableHighAccuracy: true,
        timeout: 10000,
        maximumAge: 5000,
      }
    );
  }, []);

  // Auto-fetch location on mount
  useEffect(() => {
    checkStatus().then((status) => {
      if (status === 'granted') {
        fetchLocation();
      }
    });
  }, [checkStatus, fetchLocation]);

  // Destination coordinates normalization
  const destinationCoords = useMemo(() => {
    const lat = Number(request?.destinationLatitude);
    const lng = Number(request?.destinationLongitude);
    if (!isNaN(lat) && !isNaN(lng) && (lat !== 0 || lng !== 0)) {
      return { latitude: lat, longitude: lng };
    }
    if (coords) {
      return { latitude: coords.latitude, longitude: coords.longitude };
    }
    return KAMPALA_COORDS;
  }, [request, coords]);

  // Distance calculation (Haversine)
  const { distanceMeters, isWithinGeofence } = useMemo(() => {
    if (!coords || !request) {
      return { distanceMeters: null, isWithinGeofence: false };
    }

    const dist = getDistanceMeters(
      coords.latitude,
      coords.longitude,
      destinationCoords.latitude,
      destinationCoords.longitude
    );

    const radius = request.geofenceRadiusMeters || DEFAULT_GEOFENCE_RADIUS;
    return {
      distanceMeters: dist,
      isWithinGeofence: dist <= radius,
    };
  }, [coords, request, destinationCoords]);

  if (!request) {
    return (
      <View
        className="flex-1 justify-center items-center p-6"
        style={{ backgroundColor: colors.background }}
      >
        <ActivityIndicator size="small" color={colors.primary} />
        <Text className="text-sm mt-3 font-medium" style={{ color: colors.muted }}>
          {t('oos_loading_details', 'Loading travel details...')}
        </Text>
      </View>
    );
  }

  const radius = request.geofenceRadiusMeters || DEFAULT_GEOFENCE_RADIUS;
  const isApproved = request.status === 'approved';

  // Handle Clock Action
  const handleClockAction = async (clockType: 'in' | 'out') => {
    if (!coords) {
      const status = await checkStatus();
      if (status !== 'granted') {
        setShowPrimer(true);
        return;
      }
      fetchLocation();
      Toaster.info('Acquiring high-accuracy GPS position. Please try in a moment.');
      return;
    }

    // Strictly enforce 500m geofence for clock-in (clock-out is not strictly restricted)
    if (clockType === 'in' && !isWithinGeofence) {
      Toaster.warning(
        `You are ${(distanceMeters! / 1000).toFixed(1)}km away. You must be within ${radius}m of ${request.destinationName} to clock in.`
      );
      return;
    }

    const payload = {
      action: clockType,
      clock_type: clockType,
      latitude: coords.latitude,
      longitude: coords.longitude,
      accuracy_meters: coords.accuracy || 0,
      location_label: request.destinationName,
      out_of_station_request_id: request.remoteId || Number(request.id),
      notes: notes.trim() || undefined,
    };

    clockMutation.mutate(payload, {
      onSuccess: () => {
        Toaster.success(
          clockType === 'in'
            ? `Clocked in for ${request.destinationName}`
            : `Clocked out from ${request.destinationName}`
        );
        setNotes('');
      },
      onError: (err) => {
        Toaster.error(getApiErrorMessage(err, 'Failed to process attendance clock.'));
      },
    });
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
        };
      case 'rejected':
        return {
          bg: 'bg-red-500/10 dark:bg-red-500/20',
          border: 'border-red-500/30',
          text: 'text-red-700 dark:text-red-400',
          Icon: AlertTriangle,
          color: colors.error,
        };
      case 'pending_sync':
        return {
          bg: 'bg-blue-500/10 dark:bg-blue-500/20',
          border: 'border-blue-500/30',
          text: 'text-blue-700 dark:text-blue-400',
          Icon: RefreshCw,
          color: '#3B82F6',
        };
      default:
        return {
          bg: 'bg-amber-500/10 dark:bg-amber-500/20',
          border: 'border-amber-500/30',
          text: 'text-amber-700 dark:text-amber-400',
          Icon: Clock,
          color: colors.warning,
        };
    }
  };

  const statusStyle = getStatusStyles(request.status);
  const StatusIcon = statusStyle.Icon;

  return (
    <>
      <ScrollView
        className="flex-1 px-4 py-3"
        showsVerticalScrollIndicator={false}
        style={{ backgroundColor: colors.background }}
      >
        {/* Top Header Card */}
        <Card className="p-4 mb-4">
          <View className="flex-row justify-between items-start mb-2">
            <Text className="text-lg font-bold flex-1 mr-2" style={{ color: colors.text }}>
              {reasonLabel}
            </Text>
            <View className={`flex-row items-center gap-1 px-2.5 py-1 border ${statusStyle.bg} ${statusStyle.border}`}>
              <StatusIcon size={12} color={statusStyle.color} />
              <Text className={`text-[10px] font-bold capitalize ${statusStyle.text}`}>
                {request.status === 'pending_sync'
                  ? t('oos_pending_sync_status', 'Pending Sync')
                  : t(`oos_${request.status}_status`, { defaultValue: request.status })}
              </Text>
            </View>
          </View>

          {/* Travel Period */}
          <View className="flex-row items-center gap-2 mt-1">
            <Calendar size={14} color={colors.muted} />
            <Text className="text-xs font-semibold" style={{ color: colors.muted }}>
              {formatDateRange(request.startDate, request.endDate)}
            </Text>
          </View>
        </Card>

        {/* Map & Geofence Visualizer Card */}
        <Card className="p-0 overflow-hidden mb-4">
          <View className="h-56 w-full relative bg-zinc-100 dark:bg-zinc-800">
            <MapView
              style={StyleSheet.absoluteFill}
              initialRegion={{
                latitude: destinationCoords.latitude,
                longitude: destinationCoords.longitude,
                latitudeDelta: 0.015,
                longitudeDelta: 0.015,
              }}
              showsUserLocation={true}
              showsCompass={true}
              userInterfaceStyle={isDark ? 'dark' : 'light'}
            >
              {/* Destination Marker */}
              <Marker
                coordinate={{
                  latitude: destinationCoords.latitude,
                  longitude: destinationCoords.longitude,
                }}
                title={request.destinationName}
                description={request.destinationAddress || undefined}
              >
                <View className="items-center justify-center">
                  <View
                    className="w-7 h-7 rounded-full items-center justify-center border-2 border-white shadow-sm"
                    style={{ backgroundColor: colors.error }}
                  >
                    <MapPin size={14} color="#FFFFFF" />
                  </View>
                  <View
                    className="w-3 h-3 -mt-2"
                    style={[styles.pinPoint, { backgroundColor: colors.error }]}
                  />
                </View>
              </Marker>

              {/* 500m Geofence Perimeter Circle */}
              <Circle
                center={{
                  latitude: destinationCoords.latitude,
                  longitude: destinationCoords.longitude,
                }}
                radius={radius}
                fillColor={
                  isWithinGeofence
                    ? 'rgba(34, 197, 94, 0.20)'
                    : 'rgba(59, 130, 246, 0.15)'
                }
                strokeColor={
                  isWithinGeofence
                    ? 'rgba(34, 197, 94, 0.8)'
                    : 'rgba(59, 130, 246, 0.6)'
                }
                strokeWidth={2}
              />
            </MapView>

            {/* Live GPS Refresh Pill on Map */}
            <TouchableOpacity
              onPress={fetchLocation}
              disabled={isLocating}
              activeOpacity={0.8}
              className="absolute top-3 right-3 bg-white dark:bg-zinc-900 border px-3 py-1.5 flex-row items-center gap-1.5 shadow-md"
              style={{ borderColor: colors.border }}
            >
              {isLocating ? (
                <ActivityIndicator size="small" color={colors.primary} style={{ transform: [{ scale: 0.7 }] }} />
              ) : (
                <RefreshCw size={12} color={colors.primary} />
              )}
              <Text className="text-[11px] font-bold" style={{ color: colors.text }}>
                {isLocating ? t('oos_gps_locating', 'Locating...') : t('oos_gps_refresh', 'Locate Me')}
              </Text>
            </TouchableOpacity>
          </View>

          {/* Proximity HUD Banner */}
          <View
            className="p-3 flex-row items-center justify-between border-t"
            style={{
              backgroundColor: isWithinGeofence ? 'rgba(34, 197, 94, 0.08)' : 'rgba(245, 158, 11, 0.08)',
              borderColor: colors.border,
            }}
          >
            <View className="flex-row items-center gap-2 flex-1 pr-2">
              {isWithinGeofence ? (
                <ShieldCheck size={18} color="#16A34A" />
              ) : (
                <AlertTriangle size={18} color="#D97706" />
              )}
              <View className="flex-1">
                <Text
                  className="text-xs font-bold"
                  style={{ color: isWithinGeofence ? '#16A34A' : '#D97706' }}
                >
                  {isWithinGeofence
                    ? t('oos_geofence_inside', 'Inside Destination Zone')
                    : t('oos_geofence_outside', 'Outside Destination Zone')}
                </Text>
                <Text className="text-[11px] mt-0.5" style={{ color: colors.muted }}>
                  {distanceMeters !== null
                    ? isWithinGeofence
                      ? `${Math.round(distanceMeters)}m from target (Within ${radius}m limit)`
                      : `${(distanceMeters / 1000).toFixed(1)} km away — Must be within ${radius}m to clock in`
                    : t('oos_acquiring_gps', 'Acquiring GPS position...')}
                </Text>
              </View>
            </View>
          </View>
        </Card>

        {/* Destination Information */}
        <Card className="p-4 mb-4">
          <Text className="text-xs font-bold uppercase tracking-wider mb-3" style={{ color: colors.muted }}>
            {t('oos_destination_details', 'Destination Details')}
          </Text>

          <View className="flex-row items-start gap-2.5 mb-3">
            <MapPin size={16} color={colors.primary} style={{ marginTop: 2 }} />
            <View className="flex-1">
              <Text className="text-sm font-bold" style={{ color: colors.text }}>
                {request.destinationName}
              </Text>
              {request.destinationAddress && (
                <Text className="text-xs mt-0.5" style={{ color: colors.muted }}>
                  {request.destinationAddress}
                </Text>
              )}
            </View>
          </View>

          {request.expectedDeliverables && (
            <View className="mt-2 pt-2 border-t" style={{ borderColor: `${colors.border}60` }}>
              <Text className="text-[10px] font-bold uppercase tracking-wider" style={{ color: colors.muted }}>
                {t('oos_form_deliverables', 'Expected Deliverables')}
              </Text>
              <Text className="text-xs mt-1" style={{ color: colors.text }}>
                {request.expectedDeliverables}
              </Text>
            </View>
          )}

          {request.remarks && (
            <View className="mt-2 pt-2 border-t" style={{ borderColor: `${colors.border}60` }}>
              <Text className="text-[10px] font-bold uppercase tracking-wider" style={{ color: colors.muted }}>
                {t('oos_form_remarks', 'Remarks')}
              </Text>
              <Text className="text-xs mt-1" style={{ color: colors.text }}>
                {request.remarks}
              </Text>
            </View>
          )}
        </Card>

        {/* Clock In / Clock Out Action Center */}
        <Card className="p-4 mb-8">
          <Text className="text-xs font-bold uppercase tracking-wider mb-3" style={{ color: colors.muted }}>
            {t('oos_duty_attendance', 'Duty Attendance')}
          </Text>

          {!isApproved ? (
            <View className="p-3 bg-zinc-50 dark:bg-zinc-900 border flex-row items-start gap-2" style={{ borderColor: colors.border }}>
              <Info size={16} color={colors.muted} style={{ marginTop: 2 }} />
              <Text className="text-xs flex-1" style={{ color: colors.muted }}>
                {t('oos_attendance_requires_approval', 'Duty clock-in will be enabled once your supervisor approves this travel request.')}
              </Text>
            </View>
          ) : (
            <View className="space-y-3">
              {/* Active Shift Indicator */}
              {isClockedIn && (
                <View className="p-3 bg-green-50 dark:bg-green-950/20 border border-green-500/30 flex-row items-center gap-2 mb-2">
                  <View className="w-2.5 h-2.5 rounded-full bg-green-500" />
                  <Text className="text-xs font-bold text-green-700 dark:text-green-400 flex-1">
                    {t('oos_currently_on_shift', 'You are currently clocked in on active duty.')}
                  </Text>
                </View>
              )}

              {/* Optional Notes Input */}
              <View className="mb-2">
                <Text className="text-xs font-medium mb-1" style={{ color: colors.muted }}>
                  {t('attendance_notes_label', 'Notes / Remarks (Optional)')}
                </Text>
                <TextInput
                  value={notes}
                  onChangeText={setNotes}
                  placeholder={t('attendance_notes_placeholder', 'Add optional notes for this duty log...')}
                  placeholderTextColor={isDark ? '#6B7280' : '#9CA3AF'}
                  className="p-2.5 border text-xs"
                  style={{
                    backgroundColor: colors.surface,
                    borderColor: colors.border,
                    color: colors.text,
                  }}
                />
              </View>

              {/* Action Buttons */}
              {isClockedIn ? (
                <Button
                  title={t('attendance_btn_clock_out', 'Clock Out from Duty Station')}
                  onPress={() => handleClockAction('out')}
                  loading={clockMutation.isPending}
                  className="w-full bg-red-600 dark:bg-red-700"
                />
              ) : (
                <View>
                  <Button
                    title={t('oos_btn_clock_in', 'Clock In for Out-of-Station Duty')}
                    onPress={() => handleClockAction('in')}
                    disabled={!isWithinGeofence || clockMutation.isPending}
                    loading={clockMutation.isPending}
                    className="w-full"
                  />
                  {!isWithinGeofence && (
                    <Text className="text-[11px] text-amber-600 dark:text-amber-400 text-center mt-2">
                      {t('oos_clockin_locked_desc', 'Clock-in is locked until you are within 500m of the destination.')}
                    </Text>
                  )}
                </View>
              )}
            </View>
          )}
        </Card>
      </ScrollView>

      {/* Permission Modals */}
      <LocationPermissionModal
        isVisible={showPrimer || showBlocked}
        isBlocked={showBlocked}
        onCancel={() => {
          setShowPrimer(false);
          setShowBlocked(false);
        }}
        onConfirm={async () => {
          if (showBlocked) {
            openSettings();
          } else {
            const granted = await requestPermission();
            if (granted) {
              fetchLocation();
            }
          }
        }}
      />
    </>
  );
};

const styles = StyleSheet.create({
  pinPoint: {
    transform: [{ rotate: '45deg' }],
    zIndex: -1,
  },
});

const OosDetailsDataObserver = withObservables(['route'], ({ route }: { route: any }) => {
  const reqId = route?.params?.requestId;
  const collection = database.collections.get<OosRequestModel>('oos_requests');
  
  // Robust query matching both remote_id and local id
  const query = typeof reqId === 'number'
    ? collection.query(Q.where('remote_id', reqId))
    : !isNaN(Number(reqId))
      ? collection.query(Q.or(Q.where('id', String(reqId)), Q.where('remote_id', Number(reqId))))
      : collection.query(Q.where('id', String(reqId)));

  return {
    requests: query.observe(),
    attendanceLogs: database.collections.get<AttendanceLog>('attendance_logs').query().observe(),
  };
})(BaseOosDetailsScreen);

export const OosDetailsScreen: React.FC = () => {
  const route = useRoute<any>();
  const { t } = useTranslation();

  return (
    <MainTemplate title={t('oos_details_title', 'Out-of-Station Details')} showBack={true}>
      <OosDetailsDataObserver route={route} />
    </MainTemplate>
  );
};

export default OosDetailsScreen;

