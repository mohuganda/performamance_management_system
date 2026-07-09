import { create } from 'zustand'
import { TOAST_DEFAULT_DURATION, TOAST_DEFAULT_TITLES } from './constants'
import type { ToastInput, ToastRecord } from './types'

type ToastState = {
  items: ToastRecord[]
  show: (input: ToastInput) => string
  dismiss: (id: string) => void
  remove: (id: string) => void
}

let toastCounter = 0

function nextToastId() {
  toastCounter += 1
  return `toast-${Date.now()}-${toastCounter}`
}

export const useToastStore = create<ToastState>((set, get) => ({
  items: [],
  show: (input) => {
    const id = nextToastId()
    const type = input.type ?? 'info'
    const record: ToastRecord = {
      id,
      title: input.title ?? TOAST_DEFAULT_TITLES[type],
      message: input.message,
      type,
      duration: input.duration ?? TOAST_DEFAULT_DURATION,
      visible: false,
    }

    set((state) => ({ items: [...state.items, record] }))

    window.setTimeout(() => {
      set((state) => ({
        items: state.items.map((item) => (item.id === id ? { ...item, visible: true } : item)),
      }))
    }, 100)

    if (record.duration > 0) {
      window.setTimeout(() => {
        get().dismiss(id)
      }, record.duration)
    }

    return id
  },
  dismiss: (id) => {
    set((state) => ({
      items: state.items.map((item) => (item.id === id ? { ...item, visible: false } : item)),
    }))
    window.setTimeout(() => get().remove(id), 300)
  },
  remove: (id) => {
    set((state) => ({ items: state.items.filter((item) => item.id !== id) }))
  },
}))
