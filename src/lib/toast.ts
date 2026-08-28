import { create } from 'zustand'

export type ToastType = 'success' | 'error' | 'info' | 'warning'

export interface ToastMessage {
  id: string
  type: ToastType
  text: string
  duration?: number
}

interface ToastStore {
  toasts: ToastMessage[]
  addToast: (type: ToastType, text: string, duration?: number) => void
  removeToast: (id: string) => void
}

export const useToastStore = create<ToastStore>((set) => ({
  toasts: [],
  addToast: (type, text, duration = 3800) => {
    const id = crypto.randomUUID()
    set((state) => ({ toasts: [...state.toasts, { id, type, text, duration }] }))
    if (duration > 0) {
      setTimeout(() => {
        set((state) => ({ toasts: state.toasts.filter((t) => t.id !== id) }))
      }, duration)
    }
  },
  removeToast: (id) => set((state) => ({ toasts: state.toasts.filter((t) => t.id !== id) })),
}))

export const toast = {
  success: (text: string, duration?: number) => useToastStore.getState().addToast('success', text, duration),
  error: (text: string, duration?: number) => useToastStore.getState().addToast('error', text, duration),
  info: (text: string, duration?: number) => useToastStore.getState().addToast('info', text, duration),
  warning: (text: string, duration?: number) => useToastStore.getState().addToast('warning', text, duration),
  dismiss: (id: string) => useToastStore.getState().removeToast(id),
}
