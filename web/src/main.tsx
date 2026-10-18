import { StrictMode, useEffect, useState } from 'react'
import { createRoot } from 'react-dom/client'
import App from './App'
import { init } from './lib/store'
import { startDomTranslator } from './i18n/domTranslator'
import './index.css'

/** Loads data from the API before showing the app; while the server is down it shows a maintenance notice. */
function Boot() {
  const [state, setState] = useState<'loading' | 'ready' | 'maintenance' | string>('loading')
  const load = () => {
    setState('loading')
    init().then((result) => {
      if (result.success) return setState('ready')
      // A 5xx (or no answer at all) means the API is down or being deployed.
      const status = (result as { status?: number }).status
      setState(!status || status >= 500 ? 'maintenance' : result.error)
    })
  }
  useEffect(load, [])

  if (state === 'ready') return <App />
  return (
    <div className="min-h-screen bg-[#09080e] text-stone-300 flex flex-col items-center justify-center gap-4 p-6 text-center font-['Prompt',sans-serif]">
      {state === 'loading' ? (
        <>
          <div className="w-10 h-10 rounded-full border-2 border-rose-500/30 border-t-rose-400 animate-spin" />
          <p className="text-sm">กำลังโหลดหน้าต่างทั้ง 3,500 บาน…</p>
        </>
      ) : state === 'maintenance' ? (
        <>
          <div className="text-5xl" aria-hidden>
            🛠️
          </div>
          <h1 className="text-xl font-bold text-stone-100">ปิดซ่อมบำรุงชั่วคราว</h1>
          <p className="text-sm max-w-sm">ขณะนี้ระบบกำลังปิดปรับปรุง ขออภัยในความไม่สะดวก กรุณากลับมาใหม่อีกครั้งในไม่ช้า</p>
          <button
            type="button"
            onClick={load}
            className="px-5 py-2.5 rounded-xl bg-gradient-to-r from-orange-500 via-rose-500 to-purple-600 text-white text-sm font-bold cursor-pointer"
          >
            ลองใหม่อีกครั้ง
          </button>
        </>
      ) : (
        <>
          <p className="text-sm text-rose-300 max-w-sm">{state}</p>
          <button
            type="button"
            onClick={load}
            className="px-5 py-2.5 rounded-xl bg-gradient-to-r from-orange-500 via-rose-500 to-purple-600 text-white text-sm font-bold cursor-pointer"
          >
            ลองใหม่อีกครั้ง
          </button>
        </>
      )}
    </div>
  )
}

const root = document.getElementById('root')!
createRoot(root).render(
  <StrictMode>
    <Boot />
  </StrictMode>,
)
startDomTranslator(root)
