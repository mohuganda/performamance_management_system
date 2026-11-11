import React from 'react';
import { useToastStore, ToastMessage } from '../../utils/toast';
import { CheckCircle2, XCircle, Info, AlertTriangle, X } from 'lucide-react';

export const ToastContainer: React.FC = () => {
  const { toasts, removeToast } = useToastStore();

  if (toasts.length === 0) return null;

  return (
    <div className="fixed top-3 left-0 right-0 z-50 flex flex-col items-center pointer-events-none px-4 space-y-2">
      {toasts.map((toast: ToastMessage) => {
        let borderStyle = 'border-l-green-500 bg-white dark:bg-zinc-900';
        let Icon = CheckCircle2;
        let iconColor = 'text-green-500';

        if (toast.type === 'error') {
          borderStyle = 'border-l-red-500 bg-white dark:bg-zinc-900';
          Icon = XCircle;
          iconColor = 'text-red-500';
        } else if (toast.type === 'warning') {
          borderStyle = 'border-l-amber-500 bg-white dark:bg-zinc-900';
          Icon = AlertTriangle;
          iconColor = 'text-amber-500';
        } else if (toast.type === 'info') {
          borderStyle = 'border-l-blue-500 bg-white dark:bg-zinc-900';
          Icon = Info;
          iconColor = 'text-blue-500';
        }

        return (
          <div
            key={toast.id}
            className={`pointer-events-auto w-full max-w-sm p-3.5 border border-zinc-200 dark:border-zinc-800 border-l-4 shadow-lg flex items-start gap-3 transition-all duration-200 ${borderStyle}`}
          >
            <Icon size={20} className={`${iconColor} flex-shrink-0 mt-0.5`} />
            <div className="flex-1 min-w-0">
              {toast.title && (
                <p className="text-xs font-bold text-zinc-900 dark:text-zinc-100 uppercase tracking-wide">
                  {toast.title}
                </p>
              )}
              <p className="text-xs text-zinc-600 dark:text-zinc-400 leading-snug mt-0.5">
                {toast.message}
              </p>
            </div>
            <button
              onClick={() => removeToast(toast.id)}
              className="text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-200"
            >
              <X size={16} />
            </button>
          </div>
        );
      })}
    </div>
  );
};
