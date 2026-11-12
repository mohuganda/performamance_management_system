import React from 'react';
import { usePwaInstall } from '../../hooks/usePwaInstall';
import { Download, Share, X, PlusSquare, Smartphone } from 'lucide-react';

export const GlobalPwaInstallPrompt: React.FC = () => {
  const { canInstall, isIos, triggerInstall, dismissPrompt } = usePwaInstall();

  if (!canInstall) {
    return null;
  }

  return (
    <aside
      aria-label="PWA Installation Prompt"
      className="fixed bottom-4 left-4 right-4 sm:left-auto sm:right-6 sm:bottom-6 sm:w-96 z-50 animate-in fade-in slide-in-from-bottom-4 duration-300 pointer-events-auto"
    >
      <div className="bg-white/95 dark:bg-zinc-900/95 backdrop-blur-md border border-zinc-200 dark:border-zinc-800 rounded-2xl p-4 shadow-2xl shadow-black/20 text-zinc-900 dark:text-zinc-100 transition-colors">

        {/* Header row */}
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-amber-500/10 dark:bg-amber-400/15 border border-amber-500/20 text-amber-600 dark:text-amber-400 flex items-center justify-center flex-shrink-0">
              {isIos ? <Smartphone size={20} /> : <Download size={20} />}
            </div>
            <div>
              <h3 className="text-sm font-bold tracking-tight text-zinc-900 dark:text-white">
                Install PMS - iHRISS App
              </h3>
              <p className="text-[11px] text-zinc-500 dark:text-zinc-400 leading-tight mt-0.5">
                Uganda Ministry of Health
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={() => dismissPrompt()}
            aria-label="Dismiss installation prompt"
            className="text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-200 p-1 rounded-lg transition"
          >
            <X size={18} />
          </button>
        </div>

        {/* Content body */}
        <div className="mt-3">
          {isIos ? (
            <div className="space-y-2 text-xs bg-zinc-50 dark:bg-zinc-800/60 p-3 rounded-xl border border-zinc-200/80 dark:border-zinc-700/50">
              <p className="font-semibold text-zinc-800 dark:text-zinc-200 text-[11px]">
                Install on iPhone or iPad:
              </p>
              <ol className="space-y-1.5 text-[11px] text-zinc-600 dark:text-zinc-300">
                <li className="flex items-center gap-1.5">
                  <span className="font-bold">1.</span> Tap Safari's{' '}
                  <Share size={13} className="text-blue-500 inline flex-shrink-0" />{' '}
                  <strong className="font-semibold text-zinc-900 dark:text-zinc-100">Share</strong> button.
                </li>
                <li className="flex items-center gap-1.5">
                  <span className="font-bold">2.</span> Choose{' '}
                  <PlusSquare size={13} className="text-zinc-500 dark:text-zinc-400 inline flex-shrink-0" />{' '}
                  <strong className="font-semibold text-zinc-900 dark:text-zinc-100">Add to Home Screen</strong>.
                </li>
                <li className="flex items-center gap-1.5">
                  <span className="font-bold">3.</span> Tap{' '}
                  <strong className="font-semibold text-zinc-900 dark:text-zinc-100">Add</strong> in top right.
                </li>
              </ol>
            </div>
          ) : (
            <p className="text-xs text-zinc-600 dark:text-zinc-300 leading-relaxed">
              Install to your home screen for quick offline access, GPS duty clocking, and fast notifications.
            </p>
          )}
        </div>

        {/* Action buttons */}
        <div className="flex items-center gap-2 mt-3.5 pt-1">
          <button
            type="button"
            onClick={() => dismissPrompt()}
            className="flex-1 py-2 px-3 text-xs font-semibold text-zinc-600 dark:text-zinc-300 bg-zinc-100 dark:bg-zinc-800 hover:bg-zinc-200 dark:hover:bg-zinc-700 rounded-xl transition"
          >
            {isIos ? 'Dismiss' : 'Not Now'}
          </button>
          {!isIos && (
            <button
              type="button"
              onClick={triggerInstall}
              className="flex-1 py-2 px-3 text-xs font-bold text-zinc-950 bg-amber-400 hover:bg-amber-300 active:scale-[0.98] rounded-xl shadow-sm transition"
            >
              Install App
            </button>
          )}
        </div>

      </div>
    </aside>
  );
};
