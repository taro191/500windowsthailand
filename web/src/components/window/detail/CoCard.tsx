import { useEffect, useRef, useState } from 'react'
import type { RegionId } from '@shared/types'
import { REGION_IDS } from '@shared/regions'
import { loadCoCenter, onCoCenterChange } from '@/lib/coCenter'
import { useSettings } from '@/lib/settings'
import { loadBoard } from '@/lib/store'
import { btn, btnOn, card, h3, muted, type DetailContext } from './ui'

// The embed script styles itself with the KAP page's variable names.
const EMBED_VARS = {
  '--bg': 'var(--kap-bg)',
  '--card': 'var(--kap-card)',
  '--line': 'var(--kap-line)',
  '--tx': 'var(--kap-text)',
  '--mu': 'var(--kap-muted)',
  '--ac': 'var(--kap-gold)',
  '--ac2': 'var(--kap-teal)',
  '--ac2t': 'var(--kap-teal)',
} as React.CSSProperties

/**
 * "Kapsulep & Co": web apps from the team (Co Store, set on the admin page) and windows picked
 * every 2 hours from all over Thailand (Co Center). Hidden when both are empty.
 */
export function CoCard({ ctx }: { ctx: DetailContext }) {
  const { coStore } = useSettings()
  const apps = coStore.apps
  const title = coStore.title.replace(/\s*:\s*Store\s*$/i, '') || 'Kapsulep & Co'
  const [hasCenter, setHasCenter] = useState(() => !!window.KAP_CO_EMBED?.has())
  const [tab, setTab] = useState<'store' | 'center'>('store')
  const [category, setCategory] = useState('')
  const centerRef = useRef<HTMLDivElement>(null)
  const openWindow = useRef(ctx.openWindow)
  openWindow.current = ctx.openWindow

  useEffect(() => {
    let live = true
    loadCoCenter().then((embed) => live && setHasCenter(!!embed?.has()))
    const off = onCoCenterChange(() => setHasCenter(!!window.KAP_CO_EMBED?.has()))
    // A window picked by Co Center opens here instead of reloading the site.
    const onClick = (e: Event) => {
      const match = String((e as CustomEvent<{ url?: string }>).detail?.url ?? '').match(/^\/w\/([a-z]+)\/(\d+)$/)
      if (!match || !REGION_IDS.includes(match[1] as RegionId)) return
      const found = loadBoard(match[1] as RegionId).find((w) => w.id === Number(match[2]))
      if (!found) return
      e.preventDefault()
      openWindow.current(found)
    }
    document.addEventListener('kap:co-click', onClick)
    return () => {
      live = false
      off()
      document.removeEventListener('kap:co-click', onClick)
    }
  }, [])

  const hasStore = apps.length > 0
  const shown = hasStore && hasCenter ? tab : hasCenter ? 'center' : 'store'

  // The embed draws into its own node; it is moved into this card and shown on its tab.
  useEffect(() => {
    const embed = window.KAP_CO_EMBED
    if (!hasCenter || !embed || !centerRef.current) return
    centerRef.current.appendChild(embed.node())
    embed.show(shown === 'center')
  }, [hasCenter, shown])

  if (!hasStore && !hasCenter) return null
  const categories = [...new Set(apps.map((a) => a.category).filter(Boolean))]
  const pick = categories.includes(category) ? category : ''

  return (
    <section className={card} aria-label={title}>
      <div className="mb-3">
        <h3 className={`${h3} flex items-center`}>
          <span aria-hidden="true" className="inline-grid place-items-center w-8 h-8 rounded-[10px] mr-2 text-[17px] bg-linear-135 from-(--kap-teal) to-(--kap-gold)">
            🧩
          </span>
          {title}
        </h3>
        <p className={`${muted} text-[13px] mt-1 mb-0`}>{shown === 'center' ? 'Co Center · หน้าต่างแนะนำ สุ่มเปลี่ยนทุก 2 ชั่วโมง' : 'Co Store · เว็บแอปในระบบ เลือกใช้ได้เลย'}</p>
      </div>
      {hasStore && hasCenter && (
        <div role="group" aria-label={title} className="grid grid-cols-2 gap-1 p-1 mb-3 rounded-2xl bg-(--kap-text)/7 border border-(--kap-line)">
          {(
            [
              ['store', '🛍', 'Co Store'],
              ['center', '🌏', 'Co Center'],
            ] as const
          ).map(([id, icon, label]) => (
            <button
              key={id}
              type="button"
              aria-pressed={shown === id}
              onClick={() => setTab(id)}
              className={`flex items-center justify-center gap-1.5 min-h-[42px] rounded-xl text-[14px] font-medium cursor-pointer transition-colors ${shown === id ? 'bg-(--kap-teal) text-[#06101f] font-semibold shadow-[0_2px_8px_#0003]' : `${muted} hover:text-(--kap-text)`}`}
            >
              <span aria-hidden="true">{icon}</span>
              {label}
            </button>
          ))}
        </div>
      )}
      {shown === 'store' && (
        <>
          {categories.length > 1 && (
            <div role="group" aria-label="หมวดเว็บแอป" className="flex flex-wrap gap-1.5 mb-2.5">
              {['', ...categories].map((c) => (
                <button key={c} type="button" aria-pressed={pick === c} onClick={() => setCategory(c)} className={`${btn} ${pick === c ? btnOn : ''}`}>
                  {c || 'ทั้งหมด'}
                </button>
              ))}
            </div>
          )}
          <div className="grid grid-cols-2 min-[600px]:grid-cols-3 gap-2.5">
            {apps
              .filter((a) => !pick || a.category === pick)
              .map((a) => {
                const external = /^https?:/i.test(a.url)
                return (
                  <a
                    key={a.id}
                    href={a.url}
                    {...(external ? { target: '_blank', rel: 'noopener noreferrer' } : {})}
                    className="flex gap-2.5 items-start min-w-0 p-3 min-h-[76px] border border-(--kap-line) rounded-[14px] text-(--kap-text) no-underline bg-(--kap-text)/3 transition hover:-translate-y-0.5 hover:border-(--kap-teal) hover:shadow-[0_6px_16px_#0004]"
                  >
                    <span aria-hidden="true" className="shrink-0 w-10 h-10 rounded-[10px] grid place-items-center text-[22px] overflow-hidden bg-linear-135 from-(--kap-teal)/25 to-(--kap-bg)">
                      {a.iconUrl ? <img src={a.iconUrl} alt="" loading="lazy" className="w-full h-full object-cover" /> : a.icon || '🧩'}
                    </span>
                    <span className="min-w-0 flex flex-col gap-0.5">
                      <b className="text-[14px] leading-tight [overflow-wrap:anywhere]">
                        {a.name}
                        {a.badge && <span className="inline-block ml-1.5 px-[7px] border border-(--kap-teal) rounded-full text-(--kap-teal) text-[11px] font-medium align-[1px]">{a.badge}</span>}
                      </b>
                      {a.description && <small className={`${muted} text-[12px] leading-snug line-clamp-2`}>{a.description}</small>}
                    </span>
                  </a>
                )
              })}
          </div>
        </>
      )}
      <div ref={centerRef} style={EMBED_VARS} hidden={shown !== 'center'} />
    </section>
  )
}
