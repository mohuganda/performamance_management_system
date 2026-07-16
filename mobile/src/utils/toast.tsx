import React from 'react';

import Toast, { BaseToast, ErrorToast, InfoToast, ToastConfig } from 'react-native-toast-message';

export const toastConfig: ToastConfig = {
  success: (props) => (
    <BaseToast
      {...props}
      style={{
        borderLeftColor: '#22c55e',
        backgroundColor: '#22c55e',
        borderRadius: 8,
        width: '90%',
        elevation: 3,
        shadowOpacity: 0.1,
        shadowRadius: 4,
        shadowOffset: { width: 0, height: 2 },
      }}
      contentContainerStyle={{ paddingHorizontal: 15 }}
      text1Style={{ fontSize: 16, fontWeight: '600', color: '#ffffff' }}
      text2Style={{ fontSize: 14, color: '#ffffff', fontWeight: '400' }}
    />
  ),
  error: (props) => (
    <ErrorToast
      {...props}
      style={{
        borderLeftColor: '#ef4444',
        backgroundColor: '#ef4444',
        borderRadius: 8,
        width: '90%',
        elevation: 3,
        shadowOpacity: 0.1,
        shadowRadius: 4,
        shadowOffset: { width: 0, height: 2 },
      }}
      contentContainerStyle={{ paddingHorizontal: 15 }}
      text1Style={{ fontSize: 16, fontWeight: '600', color: '#ffffff' }}
      text2Style={{ fontSize: 14, color: '#ffffff', fontWeight: '400' }}
      text2NumberOfLines={2}
    />
  ),
  info: (props) => (
    <InfoToast
      {...props}
      style={{
        borderLeftColor: '#3b82f6',
        backgroundColor: '#3b82f6',
        borderRadius: 8,
        width: '90%',
        elevation: 3,
        shadowOpacity: 0.1,
        shadowRadius: 4,
        shadowOffset: { width: 0, height: 2 },
      }}
      contentContainerStyle={{ paddingHorizontal: 15 }}
      text1Style={{ fontSize: 16, fontWeight: '600', color: '#ffffff' }}
      text2Style={{ fontSize: 14, color: '#ffffff', fontWeight: '400' }}
      text2NumberOfLines={2}
    />
  ),
  warning: (props) => (
    <BaseToast
      {...props}
      style={{
        borderLeftColor: '#f59e0b',
        backgroundColor: '#f59e0b',
        borderRadius: 8,
        width: '90%',
        elevation: 3,
        shadowOpacity: 0.1,
        shadowRadius: 4,
        shadowOffset: { width: 0, height: 2 },
      }}
      contentContainerStyle={{ paddingHorizontal: 15 }}
      text1Style={{ fontSize: 16, fontWeight: '600', color: '#ffffff' }}
      text2Style={{ fontSize: 14, color: '#ffffff', fontWeight: '400' }}
      text2NumberOfLines={2}
    />
  ),
};

/**
 * Toast helper class for consistent toast notifications across the application.
 * Wraps react-native-toast-message methods.
 */
export class Toaster {
  /**
   * Display a success toast notification
   * @param message The message to display
   * @param title Optional toast title
   */
  static success(message: string, title?: string) {
    Toast.show({
      type: 'success',
      text1: title || 'Success',
      text2: message,
      visibilityTime: 3000,
      position: 'top',
    });
  }

  /**
   * Display an error toast notification
   * @param message The message to display
   * @param title Optional toast title
   */
  static error(message: string, title?: string) {
    return Toast.show({
      type: 'error',
      text1: title || 'Error',
      text2: message,
      visibilityTime: 3000,
      position: 'top',
    });
  }

  /**
   * Display an info toast notification
   * @param message The message to display
   * @param title Optional toast title
   */
  static info(message: string, title?: string) {
    Toast.show({
      type: 'info',
      text1: title || 'Info',
      text2: message,
      visibilityTime: 3000,
      position: 'top',
    });
  }

  /**
   * Display a warning toast notification
   * @param message The message to display
   * @param title Optional toast title
   */
  static warning(message: string, title?: string) {
    Toast.show({
      type: 'warning',
      text1: title || 'Warning',
      text2: message,
      visibilityTime: 3000,
      position: 'top',
    });
  }

  /**
   * Hide all active toast notifications
   */
  static hide() {
    Toast.hide();
  }
}
