import { useState, useEffect, useCallback } from 'react';

export interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

const DISMISS_COOLOFF_HOURS = 24;

export function usePwaInstall() {
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [isIos, setIsIos] = useState(false);
  const [isInstalled, setIsInstalled] = useState(false);
  const [canInstall, setCanInstall] = useState(false);
  const [isDismissed, setIsDismissed] = useState(false);

  useEffect(() => {
    // 1. Detect if the app is currently running in standalone / installed mode
    const checkIsInstalled = (): boolean => {
      const isDisplayStandalone = window.matchMedia('(display-mode: standalone)').matches;
      const isIosStandalone = (window.navigator as any).standalone === true;
      const isTwa = document.referrer.startsWith('android-app://');
      const isStoredInstalled = localStorage.getItem('pwa_installed') === 'true';

      return isDisplayStandalone || isIosStandalone || isTwa || isStoredInstalled;
    };

    const installed = checkIsInstalled();
    setIsInstalled(installed);

    if (installed) {
      setCanInstall(false);
      return;
    }

    // 2. Check if user dismissed the prompt recently
    const dismissedAt = localStorage.getItem('pwa-install-dismissed-at');
    if (dismissedAt) {
      const elapsedHours = (Date.now() - parseInt(dismissedAt, 10)) / (1000 * 60 * 60);
      if (elapsedHours < DISMISS_COOLOFF_HOURS) {
        setIsDismissed(true);
      } else {
        localStorage.removeItem('pwa-install-dismissed-at');
      }
    }

    // 3. Detect iOS Safari
    const ua = window.navigator.userAgent.toLowerCase();
    const isIosDevice = /iphone|ipad|ipod/.test(ua) && !(window as any).MSStream;
    setIsIos(isIosDevice);

    if (isIosDevice && !installed) {
      setCanInstall(true);
    }

    // 4. Capture 'beforeinstallprompt' on Android & Chromium Desktop
    const handleBeforeInstallPrompt = (e: Event) => {
      // Prevent browser's default prompt from appearing automatically
      e.preventDefault();
      setDeferredPrompt(e as BeforeInstallPromptEvent);
      setCanInstall(true);
    };

    // 5. Capture 'appinstalled' event when installation completes
    const handleAppInstalled = () => {
      setIsInstalled(true);
      setCanInstall(false);
      setDeferredPrompt(null);
      localStorage.setItem('pwa_installed', 'true');
      localStorage.removeItem('pwa-install-dismissed-at');
    };

    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
    window.addEventListener('appinstalled', handleAppInstalled);

    return () => {
      window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
      window.removeEventListener('appinstalled', handleAppInstalled);
    };
  }, []);

  const triggerInstall = useCallback(async (): Promise<boolean> => {
    if (!deferredPrompt) {
      return false;
    }

    try {
      await deferredPrompt.prompt();
      const choice = await deferredPrompt.userChoice;
      if (choice.outcome === 'accepted') {
        setIsInstalled(true);
        setCanInstall(false);
        setDeferredPrompt(null);
        localStorage.setItem('pwa_installed', 'true');
        return true;
      }
      return false;
    } catch (err) {
      console.error('[PWA Install Error]:', err);
      return false;
    }
  }, [deferredPrompt]);

  const dismissPrompt = useCallback((hours = DISMISS_COOLOFF_HOURS) => {
    setIsDismissed(true);
    localStorage.setItem('pwa-install-dismissed-at', Date.now().toString());
  }, []);

  return {
    canInstall: canInstall && !isDismissed && !isInstalled,
    isInstalled,
    isIos,
    isDismissed,
    triggerInstall,
    dismissPrompt,
  };
}
