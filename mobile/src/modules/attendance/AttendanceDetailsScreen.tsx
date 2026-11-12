import React, { useRef } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
} from 'react-native';
import { useRoute, useNavigation } from '@react-navigation/native';
import { useTranslation } from 'react-i18next';
import MapView, { Marker, Circle } from 'react-native-maps';
import {
  Clock,
  ShieldCheck,
  AlertTriangle,
  CheckCircle,
  HelpCircle,
  MapPin,
  Crosshair,
  Smartphone,
  Globe,
  Calendar,
  ArrowDownLeft,
  ArrowUpRight,
  Activity,
} from 'lucide-react-native';
import { MainTemplate } from '../../components/templates';
import { useTheme } from '../../app/hooks/useTheme';
import { ClockResponse } from '../../api/attendance/types';
import { formatDate, formatTime } from '../../utils/date';

export const AttendanceDetailsScreen: React.FC = () => {
  const { t } = useTranslation();
  const navigation = useNavigation();
  const route = useRoute<any>();
  const { colors, isDark } = useTheme();

  const log: ClockResponse = route.params?.log;
  const mapRef = useRef<MapView>(null);

  if (!log) {
    return (
      <MainTemplate title={t('attendance_details_title', 'Attendance Log Details')} showBack={true}>
        <View className="flex-1 items-center justify-center p-6">
          <Text className="text-base font-semibold" style={{ color: colors.muted }}>
            Attendance record not found.
          </Text>
          <TouchableOpacity
            onPress={() => navigation.goBack()}
            className="mt-4 px-4 py-2 rounded-none"
            style={{ backgroundColor: colors.primary }}
          >
            <Text className="text-white font-bold">Go Back</Text>
          </TouchableOpacity>
        </View>
      </MainTemplate>
    );
  }

  const isClockIn = (log.action || log.clock_type) === 'in';
  const timestamp = log.clocked_at || log.created_at;
  const lat = log.latitude;
  const lng = log.longitude;
  const hasCoords = lat != null && lng != null && !isNaN(lat) && !isNaN(lng);
  const accuracyRadius = Math.max(log.accuracy_meters || 20, 10);

  // Formatted distance
  const distance = log.distance_from_destination_meters;
  const formattedDistance =
    distance != null
      ? distance >= 1000
        ? `${(distance / 1000).toFixed(2)} km`
        : `${distance.toFixed(1)} m`
      : '—';

  // Verification Status Breakdown
  const rawStatus = (log.verification_status || '').toLowerCase().trim();
  const isAtDutyStation = rawStatus === 'at_duty_station' || (!rawStatus && (log.verified || log.within_geofence));
  const isVerifiedOos = rawStatus === 'verified_oos';
  const isOutsideGeofence = rawStatus === 'outside_geofence';

  let statusTitle = t('attendance_pending_verification');
  let statusDesc = 'Awaiting verification status from server';
  let statusIcon = <HelpCircle size={22} color={colors.muted} strokeWidth={2} />;
  let statusBg = isDark ? 'rgba(63, 63, 70, 0.4)' : '#F3F4F6';
  let statusBorder = colors.border;
  let statusTextColor = colors.text;
  let statusSubColor = colors.muted;

  if (isAtDutyStation) {
    statusTitle = t('attendance_status_at_duty_station');
    statusDesc = 'Officer clocked within assigned facility perimeter';
    statusIcon = <ShieldCheck size={22} color={isDark ? '#34D399' : '#059669'} strokeWidth={2} />;
    statusBg = isDark ? 'rgba(16, 185, 129, 0.12)' : '#ECFDF5';
    statusBorder = isDark ? '#059669' : '#A7F3D0';
    statusTextColor = isDark ? '#34D399' : '#065F46';
    statusSubColor = isDark ? '#A7F3D0' : '#047857';
  } else if (isVerifiedOos) {
    statusTitle = t('attendance_status_verified_oos');
    statusDesc = 'Verified duty attendance at approved travel destination';
    statusIcon = <CheckCircle size={22} color={isDark ? '#2DD4BF' : '#0D9488'} strokeWidth={2} />;
    statusBg = isDark ? 'rgba(13, 148, 136, 0.12)' : '#F0FDFA';
    statusBorder = isDark ? '#0D9488' : '#99F6E4';
    statusTextColor = isDark ? '#2DD4BF' : '#115E59';
    statusSubColor = isDark ? '#99F6E4' : '#0F766E';
  } else if (isOutsideGeofence) {
    statusTitle = t('attendance_status_outside_geofence');
    statusDesc = `Clocked ${formattedDistance} from assigned station`;
    statusIcon = <AlertTriangle size={22} color={isDark ? '#FBBF24' : '#D97706'} strokeWidth={2} />;
    statusBg = isDark ? 'rgba(217, 119, 6, 0.12)' : '#FFFBEB';
    statusBorder = isDark ? '#D97706' : '#FDE68A';
    statusTextColor = isDark ? '#FBBF24' : '#92400E';
    statusSubColor = isDark ? '#FDE68A' : '#B45309';
  }

  // Region for Map
  const region = hasCoords
    ? {
      latitude: lat,
      longitude: lng,
      latitudeDelta: 0.005,
      longitudeDelta: 0.005,
    }
    : null;

  const handleRecenter = () => {
    if (hasCoords && mapRef.current) {
      mapRef.current.animateToRegion(
        {
          latitude: lat,
          longitude: lng,
          latitudeDelta: 0.005,
          longitudeDelta: 0.005,
        },
        500
      );
    }
  };

  const actionBadge = (
    <View
      className="px-2.5 py-1 rounded-none flex-row items-center gap-1 border"
      style={{
        backgroundColor: isClockIn
          ? isDark
            ? 'rgba(16, 185, 129, 0.15)'
            : '#ECFDF5'
          : isDark
            ? 'rgba(244, 63, 94, 0.15)'
            : '#FFF1F2',
        borderColor: isClockIn
          ? isDark
            ? '#059669'
            : '#A7F3D0'
          : isDark
            ? '#E11D48'
            : '#FECDD3',
      }}
    >
      {isClockIn ? (
        <ArrowDownLeft
          size={12}
          color={isDark ? '#34D399' : '#059669'}
          strokeWidth={2.5}
        />
      ) : (
        <ArrowUpRight
          size={12}
          color={isDark ? '#FB7185' : '#E11D48'}
          strokeWidth={2.5}
        />
      )}
      <Text
        className="text-xs font-bold uppercase tracking-wider"
        style={{
          color: isClockIn
            ? isDark
              ? '#34D399'
              : '#059669'
            : isDark
              ? '#FB7185'
              : '#E11D48',
        }}
      >
        {isClockIn
          ? t('attendance_btn_clock_in')
          : t('attendance_btn_clock_out')}
      </Text>
    </View>
  );

  return (
    <MainTemplate
      title={t('attendance_details_title', 'Attendance Log Details')}
      showBack={true}
      rightElement={actionBadge}
    >
      <ScrollView
        className="flex-1"
        contentContainerStyle={{ padding: 16, paddingBottom: 40 }}
      >
        {/* Primary Log Summary Card (rounded-none) */}
        <View
          className="p-5 rounded-none border mb-4 shadow-sm"
          style={{
            backgroundColor: colors.surface,
            borderColor: colors.border,
          }}
        >
          <View className="flex-row items-start justify-between">
            <View>
              <Text
                className="text-2xl font-black tracking-tight"
                style={{
                  color: isClockIn
                    ? isDark
                      ? '#34D399'
                      : '#059669'
                    : isDark
                      ? '#FB7185'
                      : '#E11D48',
                }}
              >
                {formatTime(timestamp, 'hh:mm:ss A')}
              </Text>
              <View className="flex-row items-center gap-1.5 mt-1">
                <Calendar size={13} color={colors.muted} />
                <Text
                  className="text-xs font-semibold"
                  style={{ color: colors.text }}
                >
                  {formatDate(timestamp, 'dddd, DD MMMM YYYY')}
                </Text>
              </View>
            </View>

            {/* Source Pill (rounded-none) */}
            <View className="flex-row items-center gap-1 px-2.5 py-1 rounded-none border border-gray-200 dark:border-zinc-700 bg-gray-100 dark:bg-zinc-800">
              {log.source === 'mobile' ? (
                <Smartphone size={11} color={colors.muted} />
              ) : (
                <Globe size={11} color={colors.muted} />
              )}
              <Text
                className="text-[11px] font-bold capitalize"
                style={{ color: colors.muted }}
              >
                {log.source || 'mobile'}
              </Text>
            </View>
          </View>

          {/* Verification HUD Banner (rounded-none) */}
          <View
            className="mt-4 p-3.5 rounded-none border flex-row items-center gap-2.5"
            style={{
              backgroundColor: statusBg,
              borderColor: statusBorder,
            }}
          >
            {statusIcon}

            <View className="flex-1">
              <Text
                className="font-bold text-xs"
                style={{ color: statusTextColor }}
              >
                {statusTitle}
              </Text>
              <Text
                className="text-[11px] mt-0.5"
                style={{ color: statusSubColor }}
              >
                {statusDesc}
              </Text>
            </View>
          </View>
        </View>

        {/* In-App Interactive Map (rounded-none) */}
        <View
          className="rounded-none border overflow-hidden mb-4 shadow-sm"
          style={{
            backgroundColor: colors.surface,
            borderColor: colors.border,
          }}
        >
          <View
            className="px-4 py-3 border-b flex-row items-center justify-between"
            style={{ borderColor: colors.border }}
          >
            <View className="flex-row items-center gap-1.5">
              <MapPin size={15} color={colors.primary} />
              <Text className="font-bold text-xs uppercase tracking-wider" style={{ color: colors.text }}>
                {t('attendance_location_map', 'Punch Location Map')}
              </Text>
            </View>

            <TouchableOpacity
              onPress={handleRecenter}
              activeOpacity={0.7}
              className="flex-row items-center gap-1 px-2 py-1 rounded-none border border-gray-200 dark:border-zinc-700 bg-gray-100 dark:bg-zinc-800"
            >
              <Crosshair size={12} color={colors.primary} />
              <Text className="text-[10px] font-bold" style={{ color: colors.primary }}>
                {t('attendance_recenter_map', 'Recenter')}
              </Text>
            </TouchableOpacity>
          </View>

          {/* Map canvas */}
          <View className="h-64 w-full relative">
            {hasCoords && region ? (
              <MapView
                ref={mapRef}
                style={StyleSheet.absoluteFill}
                initialRegion={region}
                scrollEnabled={true}
                zoomEnabled={true}
                pitchEnabled={true}
                rotateEnabled={true}
                userInterfaceStyle={isDark ? 'dark' : 'light'}
              >
                {/* Accuracy Radius Circle */}
                <Circle
                  center={{ latitude: lat, longitude: lng }}
                  radius={accuracyRadius}
                  fillColor={
                    isClockIn
                      ? 'rgba(16, 185, 129, 0.18)'
                      : 'rgba(244, 63, 94, 0.18)'
                  }
                  strokeColor={isClockIn ? '#059669' : '#E11D48'}
                  strokeWidth={1.5}
                />

                {/* Clock-in Location Marker */}
                <Marker
                  coordinate={{ latitude: lat, longitude: lng }}
                  title={isClockIn ? 'Clock In Point' : 'Clock Out Point'}
                  description={`Accuracy: ±${Math.round(accuracyRadius)}m`}
                >
                  <View className="items-center justify-center">
                    <View
                      className="w-8 h-8 rounded-full items-center justify-center border-2 border-white dark:border-zinc-900 shadow-md"
                      style={{
                        backgroundColor: isClockIn ? '#10B981' : '#F43F5E',
                      }}
                    >
                      {isClockIn ? (
                        <ArrowDownLeft size={16} color="#FFFFFF" strokeWidth={2.5} />
                      ) : (
                        <ArrowUpRight size={16} color="#FFFFFF" strokeWidth={2.5} />
                      )}
                    </View>
                    <View
                      className="w-2.5 h-2.5 rotate-45 -mt-1"
                      style={{
                        backgroundColor: isClockIn ? '#10B981' : '#F43F5E',
                      }}
                    />
                  </View>
                </Marker>
              </MapView>
            ) : (
              <View className="flex-1 items-center justify-center p-4">
                <MapPin size={32} color={colors.muted} />
                <Text className="text-xs mt-2" style={{ color: colors.muted }}>
                  Coordinates not available for this record.
                </Text>
              </View>
            )}

            {/* In-Map Telemetry Chip (rounded-none) */}
            {hasCoords && (
              <View
                className="absolute bottom-3 left-3 right-3 px-3 py-2 rounded-none border flex-row items-center justify-between"
                style={{
                  backgroundColor: isDark
                    ? 'rgba(24, 24, 27, 0.9)'
                    : 'rgba(255, 255, 255, 0.95)',
                  borderColor: colors.border,
                }}
              >
                <View className="flex-row items-center gap-1.5">
                  <MapPin size={12} color={colors.primary} />
                  <Text className="text-[11px] font-mono font-bold" style={{ color: colors.text }}>
                    {lat.toFixed(5)}°, {lng.toFixed(5)}°
                  </Text>
                </View>
                <Text className="text-[10px] font-semibold" style={{ color: colors.muted }}>
                  Radius: ±{Math.round(accuracyRadius)}m
                </Text>
              </View>
            )}
          </View>
        </View>

        {/* Telemetry 2x2 Dashboard Grid */}
        <View className="mb-4">
          <Text
            className="font-bold text-xs uppercase tracking-wider mb-2.5 px-1"
            style={{ color: colors.muted }}
          >
            {t('attendance_telemetry', 'Audit Telemetry')}
          </Text>

          <View className="flex-row flex-wrap justify-between gap-y-2.5">
            {/* Metric 1: Distance to Station */}
            <View
              className="p-3.5 rounded-none border w-[48%]"
              style={{
                backgroundColor: colors.surface,
                borderColor: colors.border,
              }}
            >
              <View className="flex-row items-center gap-1.5 mb-1">
                <MapPin size={14} color={isOutsideGeofence ? '#D97706' : '#059669'} />
                <Text className="text-[11px] font-medium" style={{ color: colors.muted }}>
                  {t('attendance_distance_from_station', 'Distance to Station')}
                </Text>
              </View>
              <Text
                className="text-base font-bold tracking-tight"
                style={{
                  color: isOutsideGeofence
                    ? isDark
                      ? '#FBBF24'
                      : '#D97706'
                    : isDark
                      ? '#34D399'
                      : '#059669',
                }}
              >
                {formattedDistance}
              </Text>
              <Text className="text-[10px] mt-0.5" style={{ color: colors.muted }}>
                {isAtDutyStation ? 'Target reached' : 'From boundary'}
              </Text>
            </View>

            {/* Metric 2: Accuracy Radius */}
            <View
              className="p-3.5 rounded-none border w-[48%]"
              style={{
                backgroundColor: colors.surface,
                borderColor: colors.border,
              }}
            >
              <View className="flex-row items-center gap-1.5 mb-1">
                <Crosshair size={14} color="#3B82F6" />
                <Text className="text-[11px] font-medium" style={{ color: colors.muted }}>
                  {t('attendance_accuracy_radius', 'GPS Accuracy Radius')}
                </Text>
              </View>
              <Text className="text-base font-bold tracking-tight" style={{ color: colors.text }}>
                {log.accuracy_meters != null
                  ? `±${log.accuracy_meters.toFixed(1)} m`
                  : '—'}
              </Text>
              <Text className="text-[10px] mt-0.5" style={{ color: colors.muted }}>
                Hardware GPS fix
              </Text>
            </View>

            {/* Metric 3: Location Quality */}
            <View
              className="p-3.5 rounded-none border w-[48%]"
              style={{
                backgroundColor: colors.surface,
                borderColor: colors.border,
              }}
            >
              <View className="flex-row items-center gap-1.5 mb-1">
                <Activity size={14} color="#8B5CF6" />
                <Text className="text-[11px] font-medium" style={{ color: colors.muted }}>
                  {t('attendance_signal_quality', 'Signal Quality')}
                </Text>
              </View>
              <Text className="text-base font-bold tracking-tight" style={{ color: colors.text }}>
                {log.location_accuracy_percent != null
                  ? `${log.location_accuracy_percent.toFixed(1)}%`
                  : log.accuracy_meters && log.accuracy_meters < 30
                    ? 'High (90%)'
                    : 'Standard'}
              </Text>
              <Text className="text-[10px] mt-0.5" style={{ color: colors.muted }}>
                Confidence score
              </Text>
            </View>

            {/* Metric 4: Clock Date (Replaced Entry ID) */}
            <View
              className="p-3.5 rounded-none border w-[48%]"
              style={{
                backgroundColor: colors.surface,
                borderColor: colors.border,
              }}
            >
              <View className="flex-row items-center gap-1.5 mb-1">
                <Calendar size={14} color={colors.primary} />
                <Text className="text-[11px] font-medium" style={{ color: colors.muted }}>
                  {t('attendance_date', 'Clock Date')}
                </Text>
              </View>
              <Text
                className="text-base font-bold tracking-tight truncate"
                numberOfLines={1}
                style={{ color: colors.text }}
              >
                {formatDate(timestamp, 'DD MMM YYYY')}
              </Text>
              <Text className="text-[10px] mt-0.5" style={{ color: colors.muted }}>
                {formatDate(timestamp, 'dddd')}
              </Text>
            </View>
          </View>
        </View>

        {/* Additional Remarks / Notes */}
        {log.notes ? (
          <View
            className="p-4 rounded-none border mb-4"
            style={{
              backgroundColor: colors.surface,
              borderColor: colors.border,
            }}
          >
            <Text
              className="text-xs font-bold uppercase tracking-wider mb-1"
              style={{ color: colors.muted }}
            >
              {t('attendance_notes_label', 'Notes')}
            </Text>
            <Text className="text-sm italic" style={{ color: colors.text }}>
              "{log.notes}"
            </Text>
          </View>
        ) : null}
      </ScrollView>
    </MainTemplate>
  );
};

export default AttendanceDetailsScreen;
