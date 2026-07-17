import React from 'react';
import { View, Text, ActivityIndicator, TouchableOpacity, StyleSheet } from 'react-native';
import MapView, { Marker, Circle } from 'react-native-maps';
import { Navigation } from 'lucide-react-native';
import { useTranslation } from 'react-i18next';
import { useTheme } from '../../../app/hooks/useTheme';

interface AttendanceMapCardProps {
  coords: { latitude: number; longitude: number; accuracy?: number } | null;
  isLocating: boolean;
  geoError: string | null;
  startGPSCapture: () => void;
  initialRegion: any;
}

export const AttendanceMapCard: React.FC<AttendanceMapCardProps> = ({
  coords,
  isLocating,
  geoError,
  startGPSCapture,
  initialRegion,
}) => {
  const { t } = useTranslation();
  const { colors, isDark } = useTheme();
  console.log('COORDS', coords)

  return (
    <View
      className="rounded-none border overflow-hidden mb-4 shadow-sm"
      style={{
        backgroundColor: colors.surface,
        borderColor: colors.border,
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
          style={StyleSheet.absoluteFill}
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
                <View className="items-center justify-center">
                  <View
                    className="w-7 h-7 rounded-full items-center justify-center border-2 border-white shadow-sm"
                    style={{ backgroundColor: colors.error }}
                  >
                    <View className="w-2 h-2 rounded-full bg-white" />
                  </View>
                  <View
                    className="w-3 h-3 -mt-2"
                    style={[styles.pinPoint, { backgroundColor: colors.error }]}
                  />
                </View>
              </Marker>
              <Circle
                center={coords}
                radius={coords.accuracy || 15}
                fillColor="rgba(59, 131, 246, 0.71)"
                strokeColor="rgba(59, 131, 246, 1)"
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
  );
};

const styles = StyleSheet.create({
  pinPoint: {
    transform: [{ rotate: '45deg' }],
    zIndex: -1,
  },
});

export default AttendanceMapCard;
