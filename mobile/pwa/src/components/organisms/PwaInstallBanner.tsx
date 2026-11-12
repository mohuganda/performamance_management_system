import React, { useState, useEffect } from 'react';
import { Download, X, Share } from 'lucide-react';

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

export const PwaInstallBanner: React.FC = () => {
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [showIosPrompt, setShowIosPrompt] = useState(false);
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    // Check if dismissed before
    if (localStorage.getItem('pwa-install-dismissed')) {
      setDismissed(true);
      return;
    }

    // Android/Desktop Chrome install event
    const handleBeforeInstall = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e as BeforeInstallPromptEvent);
    };

    window.addEventListener('beforeinstallprompt', handleBeforeInstall);

    // Detect iOS Safari standalone mode
    const isIos = /iPad|iPhone|iPod/.test(navigator.userAgent) && !(window as any).MSStream;
    const isStandalone = window.matchMedia('(display-mode: standalone)').matches || (navigator as any).standalone;

    if (isIos && !isStandalone) {
      setShowIosPrompt(true);
    }

    return () => {
      window.removeEventListener('beforeinstallprompt', handleBeforeInstall);
    };
  }, []);

  const handleInstallClick = async () => {
    if (!deferredPrompt) return;
    deferredPrompt.prompt();
    const { outcome } = await deferredPrompt.userChoice;
    if (outcome === 'accepted') {
      setDeferredPrompt(null);
    }
  };

  const handleDismiss = () => {
    setDismissed(true);
    localStorage.setItem('pwa-install-dismissed', 'true');
  };

  if (dismissed) return null;

  if (deferredPrompt) {
    return (
      <div className="bg-zinc-900 text-white p-3 border-b border-zinc-700 flex items-center justify-between shadow-md">
        <div className="flex items-center gap-2.5 text-xs">
          <Download size={18} className="text-amber-400 flex-shrink-0" />
          <span>Install PMS iHRIS app for offline use and fast access</span>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={handleInstallClick}
            className="px-3 py-1 bg-white text-zinc-900 font-bold text-xs uppercase tracking-wider shadow"
          >
            Install
          </button>
          <button onClick={handleDismiss} className="text-zinc-400 hover:text-white p-1">
            <X size={16} />
          </button>
        </div>
      </div>
    );
  }

  if (showIosPrompt) {
    return (
      <div className="bg-zinc-900 text-white p-3 border-b border-zinc-700 flex items-center justify-between text-xs shadow-md">
        <div className="flex items-center gap-2 pr-2">
          <Share size={18} className="text-blue-400 flex-shrink-0" />
          <span>
            Install App: Tap <strong className="font-bold underline">Share</strong>, then tap <strong className="font-bold underline">Add to Home Screen</strong>.
          </span>
        </div>
        <button onClick={handleDismiss} className="text-zinc-400 hover:text-white p-1">
          <X size={16} />
        </button>
      </div>
    );
  }

  return null;
};

