import { getApiErrorMessage } from '@/api/client'
import { useToastStore } from './store'
import type { ToastInput, ToastType } from './types'

function show(input: ToastInput) {
  return useToastStore.getState().show(input)
}

function showTyped(type: ToastType, message: string, title?: string, duration?: number) {
  return show({ type, message, title, duration })
}

/** Imperative toast API — mirrors the jQuery `$.toast()` plugin used in the demo. */
export const toast = {
  show,
  success: (message: string, title = 'Success', duration?: number) =>
    showTyped('success', message, title, duration),
  error: (message: string, title = 'Error', duration?: number) =>
    showTyped('error', message, title, duration),
  info: (message: string, title = 'Info', duration?: number) => showTyped('info', message, title, duration),
  warning: (message: string, title = 'Warning', duration?: number) =>
    showTyped('warning', message, title, duration),
  dismiss: (id: string) => useToastStore.getState().dismiss(id),
}

export function notifyApiError(error: unknown, fallback = 'Request failed') {
  toast.error(getApiErrorMessage(error, fallback))
}
