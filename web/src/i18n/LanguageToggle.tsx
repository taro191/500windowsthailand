import { useEffect, useState } from 'react'
import { getLanguage, onLanguageChange, setLanguage, type Language } from './domTranslator'

/** TH / EN pill shown in the Hub's search tab. */
export function LanguageToggle() {
  const [language, setCurrent] = useState<Language>(getLanguage())
  useEffect(() => onLanguageChange(setCurrent), [])

  return (
    <div className="flex items-center justify-end gap-2">
      <span className="text-[11px] text-white/60 font-['system-ui']">ภาษา / Language</span>
      <div
        role="group"
        aria-label="Language"
        className="flex p-[3px] rounded-full border border-white/20 bg-[rgba(12,10,9,0.82)] shadow-[0_4px_14px_rgba(0,0,0,0.24)] text-[11px] font-semibold"
      >
        {(['th', 'en'] as const).map((option) => {
          const active = option === language
          return (
            <button
              key={option}
              type="button"
              aria-pressed={active}
              aria-label={option === 'th' ? 'เปลี่ยนเป็นภาษาไทย' : 'Switch to English'}
              onClick={() => setLanguage(option)}
              className={`min-w-9 min-h-9 px-2 rounded-full cursor-pointer focus-visible:outline-2 focus-visible:outline-rose-300 focus-visible:outline-offset-2 ${active ? 'text-white bg-rose-500/90' : 'text-white/60 bg-transparent'}`}
            >
              {option.toUpperCase()}
            </button>
          )
        })}
      </div>
    </div>
  )
}
