import { useEffect, useState } from 'react'
import type { User, WindowItem, WindowProfile } from '@shared/types'
import type { LightboxCaption } from '../../Lightbox'

// Look of the window page (KAP design): navy cards, gold → teal accents. Colours come from `.kap` in index.css.
export const card = 'bg-(--kap-card) border border-(--kap-line) rounded-2xl p-3.5 sm:p-[18px] min-w-0 [overflow-wrap:anywhere]'
export const btn =
  'inline-flex items-center justify-center gap-1 border border-(--kap-teal) bg-transparent text-(--kap-text) rounded-xl px-3.5 py-2 min-h-[38px] text-[14px] leading-tight cursor-pointer disabled:opacity-45 disabled:cursor-not-allowed'
export const btnPri = '!border-transparent bg-linear-to-r from-(--kap-gold) to-(--kap-teal) !text-[#06101f] font-semibold'
export const btnOn = '!bg-(--kap-teal) !border-(--kap-teal) !text-[#06101f] font-semibold'
export const btnDanger = '!bg-[#c0392b] !border-[#c0392b] !text-white'
export const pill = 'inline-block border border-(--kap-line) bg-(--kap-card) rounded-full px-3 py-1 text-[13px] leading-snug'
export const field =
  'block w-full mb-1.5 text-[13px] pointer-coarse:text-base bg-(--kap-bg) text-(--kap-text) border border-(--kap-line) rounded-lg px-2 py-1.5 focus:outline-none focus:border-(--kap-teal)'
export const muted = 'text-(--kap-muted)'
export const para = 'text-(--kap-muted) text-[14px] leading-[1.7] my-1.5'
export const h3 = 'text-[16px] font-semibold leading-snug m-0'
export const check = 'w-6 h-6 shrink-0 accent-(--kap-teal)'

type ToastKind = 'success' | 'error' | 'info'

/** What every card on the window page gets. */
export interface DetailContext {
  w: WindowItem
  profile: WindowProfile
  isOwner: boolean
  currentUser: User | null
  notify: (message: string, kind?: ToastKind) => void
  /** The window changed on the server: reload it. */
  changed: () => void
  /** Saves the whole profile; false (with a toast) when it fails. */
  saveProfile: (next: WindowProfile) => Promise<boolean>
  openAuth: () => void
  openWindow: (window: WindowItem) => void
  search: (query: string) => void
  showImages: (images: string[], index: number, caption?: LightboxCaption) => void
}

/** "✏️ โหมดเจ้าของ" / "✓ เสร็จสิ้น"; only the owner sees it. */
export function ModeButton({ on, busy, onClick }: { on: boolean; busy?: boolean; onClick: () => void }) {
  return (
    <button type="button" onClick={onClick} disabled={busy} aria-pressed={on} className={`${btn} ${on ? btnOn : ''}`}>
      {busy ? 'กำลังบันทึก…' : on ? '✓ เสร็จสิ้น' : '✏️ โหมดเจ้าของ'}
    </button>
  )
}

/** Card heading with the owner's mode button (and a cancel button while editing). */
export function CardHead({ title, owner, editor }: { title: React.ReactNode; owner: boolean; editor?: { editing: boolean; busy: boolean; toggle: () => void; cancel: () => void } }) {
  return (
    <div className="flex justify-between items-center gap-2 flex-wrap mb-3">
      <h3 className={h3}>{title}</h3>
      {owner && editor && (
        <span className="flex gap-2">
          {editor.editing && !editor.busy && (
            <button type="button" onClick={editor.cancel} className={btn}>
              ยกเลิก
            </button>
          )}
          <ModeButton on={editor.editing} busy={editor.busy} onClick={() => editor.toggle()} />
        </span>
      )}
    </div>
  )
}

export interface CardDraft<K extends keyof WindowProfile> {
  editing: boolean
  busy: boolean
  draft: Pick<WindowProfile, K>
  set: (patch: Partial<Pick<WindowProfile, K>>) => void
  /** Starts editing, or saves (with `last` applied) and finishes. */
  toggle: (last?: Partial<Pick<WindowProfile, K>>) => void
  cancel: () => void
}

/**
 * Owner mode of one card: edits a copy of the card's profile fields, and "เสร็จสิ้น" saves them
 * over the latest profile (so cards edited one after another don't undo each other).
 */
export function useCardDraft<K extends keyof WindowProfile>(ctx: DetailContext, keys: K[]): CardDraft<K> {
  const pick = () => Object.fromEntries(keys.map((k) => [k, structuredClone(ctx.profile[k])])) as Pick<WindowProfile, K>
  const [draft, setDraft] = useState<Pick<WindowProfile, K> | null>(null)
  const [busy, setBusy] = useState(false)
  const windowKey = `${ctx.w.region}-${ctx.w.id}-${ctx.isOwner}`
  useEffect(() => setDraft(null), [windowKey])

  const toggle = async (last?: Partial<Pick<WindowProfile, K>>) => {
    if (!draft) return setDraft(pick())
    const next = { ...draft, ...last }
    if (last) setDraft(next)
    if (JSON.stringify(next) === JSON.stringify(pick())) return setDraft(null)
    setBusy(true)
    const ok = await ctx.saveProfile({ ...ctx.profile, ...next })
    setBusy(false)
    if (ok) setDraft(null)
  }
  return {
    editing: !!draft,
    busy,
    draft: draft ?? pick(),
    set: (patch) => setDraft((d) => (d ? { ...d, ...patch } : d)),
    toggle,
    cancel: () => setDraft(null),
  }
}

/** A delete button that asks "ลบ?" on the first press and deletes on the second. */
export function ConfirmButton({ onConfirm, label = '🗑', className = btn, ariaLabel }: { onConfirm: () => void; label?: React.ReactNode; className?: string; ariaLabel: string }) {
  const [armed, setArmed] = useState(false)
  useEffect(() => {
    if (!armed) return
    const timer = setTimeout(() => setArmed(false), 4000)
    return () => clearTimeout(timer)
  }, [armed])
  return (
    <button
      type="button"
      aria-label={ariaLabel}
      onClick={() => {
        if (armed) {
          setArmed(false)
          onConfirm()
        } else setArmed(true)
      }}
      className={`${className} ${armed ? btnDanger : ''}`}
    >
      {armed ? 'ลบ?' : label}
    </button>
  )
}

/** Owner-mode helper text under a card heading. */
export const Hint = ({ children }: { children: React.ReactNode }) => <p className={`${para} !mt-0 mb-2`}>{children}</p>

const hueOf = (key: string) => [...key].reduce((h, c) => (h * 31 + c.charCodeAt(0)) % 360, 0)

/** One or two letters for a logo placeholder: "Kapsulep Co" → "KC", "ตลาดอาหารใต้" → "ต". */
export function initials(name: string) {
  const n = name.trim()
  if (!n) return '?'
  const words = n.split(/\s+/)
  if (words.length > 1 && /^[A-Za-z0-9]/.test(words[0]) && /^[A-Za-z0-9]/.test(words[1])) return (words[0][0] + words[1][0]).toUpperCase()
  // Thai leading vowels and quotes are skipped so the tile shows a consonant.
  const chars = [...(n.replace(/^[เแโใไ"'“”‘’([\s_-]+/, '') || n)]
  return chars[0]?.toUpperCase() || '?'
}

const LOGO_SIZE = { md: 'w-14 h-14 sm:w-16 sm:h-16 rounded-[14px] text-[22px] sm:text-[26px]', sm: 'w-9 h-9 rounded-[9px] text-[15px]', partner: 'w-12 h-12 rounded-xl text-[20px] mb-1' }

/** Square logo with rounded corners; without one, the name's initials on a colour fixed by `hueKey`. */
export function LogoTile({ src, name, hueKey, size = 'md' }: { src?: string; name: string; hueKey: string; size?: keyof typeof LOGO_SIZE }) {
  return (
    <span
      className={`${LOGO_SIZE[size]} shrink-0 overflow-hidden flex items-center justify-center font-semibold leading-none text-white border border-(--kap-line)`}
      style={{ background: `hsl(${hueOf(hueKey)} 55% 36%)` }}
    >
      {src ? <img src={src} alt="" className="w-full h-full object-cover block" /> : <span aria-hidden="true">{initials(name)}</span>}
    </span>
  )
}
