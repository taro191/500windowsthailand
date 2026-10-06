import { useCallback, useRef, useState } from 'react'

export type ToastType = 'success' | 'error' | 'info'

export interface Toast {
  text: string
  type: ToastType
}

/** One toast at a time, auto-hidden after 3.8 s. */
export function useToast() {
  const [toast, setToast] = useState<Toast | null>(null)
  const timer = useRef<ReturnType<typeof setTimeout>>(undefined)

  const showToast = useCallback((text: string, type: ToastType = 'success') => {
    clearTimeout(timer.current)
    setToast({ text, type })
    timer.current = setTimeout(() => setToast(null), 3800)
  }, [])

  return { toast, showToast }
}
