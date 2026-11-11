import { onlineManager } from '@tanstack/react-query';
import { useSyncStore } from '../stores/syncStore';

export function initNetworkListener() {
  const handleOnline = () => {
    onlineManager.setOnline(true);
    useSyncStore.getState().processQueue();
  };

  const handleOffline = () => {
    onlineManager.setOnline(false);
  };

  window.addEventListener('online', handleOnline);
  window.addEventListener('offline', handleOffline);

  // Set initial status
  onlineManager.setOnline(navigator.onLine);
  if (navigator.onLine) {
    useSyncStore.getState().processQueue();
  }

  return () => {
    window.removeEventListener('online', handleOnline);
    window.removeEventListener('offline', handleOffline);
  };
}

