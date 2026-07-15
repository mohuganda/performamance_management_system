import { useState, useEffect, useCallback } from 'react';
import { Platform, PermissionsAndroid, Linking } from 'react-native';
import { createMMKV } from 'react-native-mmkv';
import Geolocation from 'react-native-geolocation-service';

const permStorage = createMMKV({ id: 'moh-pms-permissions' });
const HAS_PROMPTED_KEY = 'location_has_prompted';

export type PermissionStatus = 'granted' | 'denied' | 'blocked' | 'undetermined';

export function useLocationPermission() {
  const [status, setStatus] = useState<PermissionStatus>('undetermined');
  const [showPrimer, setShowPrimer] = useState(false);
  const [showBlocked, setShowBlocked] = useState(false);

  const checkStatus = useCallback(async (): Promise<PermissionStatus> => {
    if (Platform.OS === 'android') {
      const hasFine = await PermissionsAndroid.check(
        PermissionsAndroid.PERMISSIONS.ACCESS_FINE_LOCATION
      );
      if (hasFine) {
        setStatus('granted');
        return 'granted';
      }

      const hasPrompted = permStorage.getBoolean(HAS_PROMPTED_KEY);
      if (!hasPrompted) {
        setStatus('undetermined');
        return 'undetermined';
      }

      setStatus('denied');
      return 'denied';
    } else {
      const hasPrompted = permStorage.getBoolean(HAS_PROMPTED_KEY);
      if (!hasPrompted) {
        setStatus('undetermined');
        return 'undetermined';
      }

      return new Promise<PermissionStatus>((resolve) => {
        Geolocation.getCurrentPosition(
          () => {
            setStatus('granted');
            resolve('granted');
          },
          (err) => {
            if (err.code === 1) {
              setStatus('blocked');
              resolve('blocked');
            } else {
              setStatus('granted');
              resolve('granted');
            }
          },
          { enableHighAccuracy: false, timeout: 2000, maximumAge: 10000 }
        );
      });
    }
  }, []);

  const requestNativePermission = useCallback(async (): Promise<boolean> => {
    setShowPrimer(false);
    permStorage.set(HAS_PROMPTED_KEY, true);
    if (Platform.OS === 'android') {
      try {
        const result = await PermissionsAndroid.request(
          PermissionsAndroid.PERMISSIONS.ACCESS_FINE_LOCATION
        );
        if (result === PermissionsAndroid.RESULTS.GRANTED) {
          setStatus('granted');
          return true;
        } else if (result === PermissionsAndroid.RESULTS.NEVER_ASK_AGAIN) {
          setStatus('blocked');
          setShowBlocked(true);
          return false;
        } else {
          setStatus('denied');
          return false;
        }
      } catch (err) {
        console.error('Failed to request android location permission', err);
        setStatus('denied');
        return false;
      }
    } else {
      Geolocation.requestAuthorization('whenInUse');
      return new Promise<boolean>((resolve) => {
        Geolocation.getCurrentPosition(
          () => {
            setStatus('granted');
            resolve(true);
          },
          (err) => {
            if (err.code === 1) {
              setStatus('blocked');
              setShowBlocked(true);
              resolve(false);
            } else {
              setStatus('granted');
              resolve(true);
            }
          },
          { enableHighAccuracy: false, timeout: 5000 }
        );
      });
    }
  }, []);

  const triggerPermissionFlow = useCallback(async (onGranted: () => void) => {
    const currentStatus = await checkStatus();
    if (currentStatus === 'granted') {
      onGranted();
    } else if (currentStatus === 'undetermined' || currentStatus === 'denied') {
      setShowPrimer(true);
    } else if (currentStatus === 'blocked') {
      setShowBlocked(true);
    }
  }, [checkStatus]);

  const handleOpenSettings = useCallback(() => {
    Linking.openSettings();
    setShowBlocked(false);
  }, []);

  return {
    status,
    showPrimer,
    showBlocked,
    setShowPrimer,
    setShowBlocked,
    checkStatus,
    requestPermission: requestNativePermission,
    triggerPermissionFlow,
    openSettings: handleOpenSettings,
  };
}
