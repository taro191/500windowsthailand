import { useEffect, useState } from 'react'
import { onPreviewChange, previewTheme, setPreviewTheme } from '@/lib/themes'

/** Shown while an admin tries out a theme from the theme library in this tab. */
export function ThemePreviewBar() {
  const [theme, setTheme] = useState(previewTheme)
  useEffect(() => onPreviewChange(() => setTheme(previewTheme())), [])
  if (!theme) return null

  const stop = () => {
    setPreviewTheme(null)
    const url = new URL(window.location.href)
    url.searchParams.delete('theme-preview')
    window.history.replaceState(null, '', url)
  }

  return (
    <div className="fixed z-[90] bottom-20 sm:bottom-4 left-1/2 -translate-x-1/2 flex items-center gap-3 max-w-[calc(100vw-32px)] pl-4 pr-1.5 py-1.5 rounded-full bg-black/85 text-white text-sm shadow-lg border border-white/15 backdrop-blur font-['Prompt',sans-serif]">
      <span className="min-w-0 truncate">
        กำลังดูตัวอย่างธีม <b>{theme.name}</b> (เห็นเฉพาะคุณ)
      </span>
      <button type="button" onClick={stop} className="shrink-0 px-3 py-1 rounded-full bg-white text-black font-semibold cursor-pointer">
        ปิดตัวอย่าง
      </button>
    </div>
  )
}
