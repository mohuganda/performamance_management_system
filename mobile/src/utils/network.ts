import NetInfo from '@react-native-community/netinfo';
import { useSyncStore } from '../stores/syncStore';

export function initNetworkListener() {
  return NetInfo.addEventListener((state) => {
    if (state.isConnected && state.isInternetReachable) {
      useSyncStore.getState().processQueue();
    }
  });
}
