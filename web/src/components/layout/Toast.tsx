import { CircleAlert, CircleCheck } from 'lucide-react'
import type { Toast as ToastMessage } from '@/hooks/useToast'

export function Toast({ toast }: { toast: ToastMessage | null }) {
  if (!toast) return null
  const borderClass =
    toast.type === 'error'
      ? 'border-rose-600 text-rose-200'
      : toast.type === 'info'
        ? 'border-purple-500 text-purple-200'
        : 'border-rose-500/80 text-rose-200'
  return (
    <div className="fixed top-18 right-4 z-50 animate-bounce duration-300 max-w-sm">
      <div
        className={`flex items-center gap-2.5 px-4 py-3 bg-stone-900 border text-xs sm:text-sm font-medium rounded-xl shadow-2xl backdrop-blur ${borderClass}`}
      >
        {toast.type === 'error' ? (
          <CircleAlert className="w-4 h-4 text-rose-400 shrink-0" />
        ) : (
          <CircleCheck className="w-4 h-4 text-amber-400 shrink-0" />
        )}
        <span>{toast.text}</span>
      </div>
    </div>
  )
}
