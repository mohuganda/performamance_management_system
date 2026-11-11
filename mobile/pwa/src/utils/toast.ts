import { create } from 'zustand';

export interface ToastMessage {
  id: string;
  type: 'success' | 'error' | 'info' | 'warning';
  title?: string;
  message: string;
}

interface ToastState {
  toasts: ToastMessage[];
  addToast: (toast: Omit<ToastMessage, 'id'>) => void;
  removeToast: (id: string) => void;
}

export const useToastStore = create<ToastState>((set) => ({
  toasts: [],
  addToast: (toast) => {
    const id = Math.random().toString(36).substring(2, 9);
    set((state) => ({ toasts: [...state.toasts, { ...toast, id }] }));
    setTimeout(() => {
      set((state) => ({ toasts: state.toasts.filter((t) => t.id !== id) }));
    }, 3500);
  },
  removeToast: (id) =>
    set((state) => ({ toasts: state.toasts.filter((t) => t.id !== id) })),
}));

export class Toaster {
  static success(message: string, title?: string) {
    useToastStore.getState().addToast({ type: 'success', message, title });
  }
  static error(message: string, title?: string) {
    useToastStore.getState().addToast({ type: 'error', message, title });
  }
  static info(message: string, title?: string) {
    useToastStore.getState().addToast({ type: 'info', message, title });
  }
  static warning(message: string, title?: string) {
    useToastStore.getState().addToast({ type: 'warning', message, title });
  }
}

