import { create } from 'zustand';

export type AlertType = 'success' | 'error' | 'info' | 'warning';

export interface AlertOptions {
  type: AlertType;
  title: string;
  message?: string;
  confirmText?: string;
  cancelText?: string;
  onConfirm?: () => void | Promise<void>;
  onCancel?: () => void | Promise<void>;
  dismissable?: boolean;
  autoDismiss?: number;
}

interface AlertState extends AlertOptions {
  isOpen: boolean;
}

interface AlertStore extends AlertState {
  showAlert: (options: AlertOptions) => void;
  hideAlert: () => void;
}

const initialState: AlertState = {
  isOpen: false,
  type: 'info',
  title: '',
  message: '',
  confirmText: undefined,
  cancelText: undefined,
  onConfirm: undefined,
  onCancel: undefined,
  dismissable: false,
  autoDismiss: undefined,
};

export const useAlertStore = create<AlertStore>((set) => ({
  ...initialState,
  showAlert: (options) => {
    set({
      isOpen: true,
      type: options.type,
      title: options.title,
      message: options.message,
      confirmText: options.confirmText,
      cancelText: options.cancelText,
      onConfirm: options.onConfirm,
      onCancel: options.onCancel,
      dismissable: options.dismissable !== undefined ? options.dismissable : false,
      autoDismiss: options.autoDismiss,
    });
  },
  hideAlert: () => set((state) => ({ ...state, isOpen: false })),
}));

export const showAlert = (options: AlertOptions) => useAlertStore.getState().showAlert(options);
export const hideAlert = () => useAlertStore.getState().hideAlert();
