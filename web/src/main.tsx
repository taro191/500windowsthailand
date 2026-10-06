import { StrictMode, useEffect, useState } from 'react'
import { createRoot } from 'react-dom/client'
import App from './App'
import { init } from './lib/store'
import { startDomTranslator } from './i18n/domTranslator'
import './index.css'

/** Loads data from the API before showing the app; offers a retry if the server can't be reached. */
function Boot() {
  const [state, setState] = useState<'loading' | 'ready' | string>('loading')
  const load = () => {
    setState('loading')
    init().then((result) => setState(result.success ? 'ready' : result.error))
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
