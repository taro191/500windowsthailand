import { Component, type ReactNode } from 'react'

/** Shows the error and a reload button instead of a blank page when rendering crashes. */
export class ErrorBoundary extends Component<{ children: ReactNode }, { error: Error | null }> {
  state = { error: null as Error | null }

  static getDerivedStateFromError(error: Error) {
    return { error }
  }

  componentDidCatch(error: Error) {
    console.error(error)
  }

  render() {
    const { error } = this.state
    if (!error) return this.props.children
    return (
      <div className="min-h-screen bg-[#09080e] text-stone-300 flex flex-col items-center justify-center gap-4 p-6 text-center font-['Prompt',sans-serif]">
        <div className="text-5xl" aria-hidden>
          😵
        </div>
        <h1 className="text-xl font-bold text-stone-100">หน้าเว็บขัดข้อง</h1>
        <p className="text-sm max-w-sm">กรุณากดโหลดใหม่ ถ้ายังเกิดซ้ำ ช่วยแคปหน้าจอนี้ส่งให้ผู้ดูแล</p>
        <p className="text-xs text-rose-300 max-w-sm break-words font-mono">{String(error?.message || error)}</p>
        <button
          type="button"
          onClick={() => window.location.reload()}
          className="px-5 py-2.5 rounded-xl bg-gradient-to-r from-orange-500 via-rose-500 to-purple-600 text-white text-sm font-bold cursor-pointer"
        >
          โหลดใหม่
        </button>
      </div>
    )
  }
}
