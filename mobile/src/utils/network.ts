import NetInfo from '@react-native-community/netinfo';
import { onlineManager } from '@tanstack/react-query';
import { useSyncStore } from '../stores/syncStore';

export function initNetworkListener() {
  let netInfoUnsubscribe: (() => void) | undefined;

  onlineManager.setEventListener((setOnline) => {
    netInfoUnsubscribe = NetInfo.addEventListener((state) => {
      const isOnline = !!state.isConnected && !!state.isInternetReachable;
      setOnline(isOnline);
      if (isOnline) {
        useSyncStore.getState().processQueue();
      }
    });
    return netInfoUnsubscribe;
  });

  return () => {
    if (netInfoUnsubscribe) {
      netInfoUnsubscribe();
    }
  };
}

