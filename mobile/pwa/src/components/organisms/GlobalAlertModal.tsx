import React from 'react';
import { useAlertStore } from '../../stores/alertStore';
import { Button } from '../atoms/Button';
import { CheckCircle2, XCircle, Info, AlertTriangle } from 'lucide-react';
import { useTranslation } from 'react-i18next';

export const GlobalAlertModal: React.FC = () => {
  const { t } = useTranslation();
  const store = useAlertStore();

  if (!store.isOpen) return null;

  const handleConfirm = async () => {
    if (store.onConfirm) {
      await store.onConfirm();
    }
    store.hideAlert();
  };

  const handleCancel = async () => {
    if (store.onCancel) {
      await store.onCancel();
    }
    store.hideAlert();
  };

  const getIcon = () => {
    const size = 36;
    switch (store.type) {
      case 'success':
        return <CheckCircle2 size={size} className="text-green-500" />;
      case 'error':
        return <XCircle size={size} className="text-red-500" />;
      case 'warning':
        return <AlertTriangle size={size} className="text-amber-500" />;
      case 'info':
      default:
        return <Info size={size} className="text-blue-500" />;
    }
  };

  const confirmVariant = store.type === 'error' ? 'danger' : 'primary';
  const showCancel = store.cancelText !== undefined || store.onCancel !== undefined;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-fade-in">
      <div
        className="w-full max-w-sm bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 p-6 shadow-2xl flex flex-col items-center text-center"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-4">{getIcon()}</div>
        <h3 className="text-lg font-bold text-zinc-900 dark:text-zinc-100 mb-2">
          {store.title}
        </h3>
        {store.message && (
          <p className="text-sm text-zinc-600 dark:text-zinc-400 leading-relaxed mb-6">
            {store.message}
          </p>
        )}

        <div className="flex w-full gap-3 mt-2">
          {showCancel && (
            <Button
              variant="secondary"
              title={store.cancelText || t('common_cancel', 'Cancel')}
              onClick={handleCancel}
            />
          )}
          <Button
            variant={confirmVariant}
            title={store.confirmText || t('common_okay', 'Okay')}
            onClick={handleConfirm}
          />
        </div>
      </div>
    </div>
  );
};

