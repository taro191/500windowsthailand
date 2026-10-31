import { useEffect, useMemo, useRef, useState } from 'react'
import type { Quota, User, WindowItem, WindowProfile } from '@shared/types'
import { REGION_IDS, REGIONS_BY_ID } from '@shared/regions'
import { CATEGORIES } from '@shared/categories'
import { highlightKind, highlightLabel, starLevel } from '@shared/windowBadges'
import { emptyProfile } from '@shared/windowProfile'
import { quotaFullMessage } from '@shared/windowQuota'
import { copyToClipboard } from '@/lib/browser'
import { editPolicyLabel, useRules, useSettings } from '@/lib/settings'
import { loadBoard, markWelcomed, saveWindowProfile } from '@/lib/store'
import { STAR_LABELS } from '../board/WindowBadges'
import { Lightbox, type LightboxCaption } from '../Lightbox'
import { DetailsCard } from './detail/DetailsCard'
import { FriendCard } from './detail/FriendCard'
import { Gallery } from './detail/Gallery'
import { LinksCard } from './detail/LinksCard'
import { OwnerStudio } from './detail/OwnerStudio'
import { ProfileCard, TagsCard, UpdatesCard } from './detail/ProfileCard'
import { Showcase } from './detail/Showcase'
import { StatusScreen, type StatusView } from './detail/StatusScreen'
import { KapDialog, StatsCard } from './detail/StatsCard'
import { btn, btnPri, card, field, h3, muted, para, pill, type DetailContext } from './detail/ui'

type ToastKind = 'success' | 'error' | 'info'

interface WindowDetailModalProps {
  windowItem: WindowItem | null
  currentUser: User | null
  quota: Quota
  onClose: () => void
  onClaim: (window: WindowItem) => void
  onBuyResale: (window: WindowItem) => void
  onOpenEditor: (window: WindowItem) => void
  onListForResale: (window: WindowItem, price: number) => void
  onCancelResale: (window: WindowItem) => void
  /** Demo: give back today's free edits. */
  onSimulatePass24Hours: (windowId: number) => void
  /** Demo: pretend the window has been held for `days` days. */
  onSimulateHolding: (windowId: number, days: number) => void
  onLike: (windowId: number) => void
  onToggleFollow: (windowId: number) => void
  onShowFollowing: () => void
  onOpenKyc: () => void
  onOpenAuth: () => void
  /** Opens another window (search results, "Friend and Co"). */
  onOpenWindow: (window: WindowItem) => void
  /** The window changed in the store (profile or reviews saved): reload the board. */
  onWindowChanged: () => void
  onNotify: (message: string, kind?: ToastKind) => void
}

const windowUrl = (w: { region: string; id: number }) => `${window.location.origin}/w/${w.region}/${w.id}`

/** The window page (KAP design): one column of cards, each with its own owner mode. */
export function WindowDetailModal(props: WindowDetailModalProps) {
  const { windowItem: w, currentUser, quota, onClose, onClaim, onBuyResale, onOpenKyc, onNotify } = props
  const rules = useRules()
  const [viewer, setViewer] = useState<{ images: string[]; index: number; caption?: LightboxCaption } | null>(null)
  const [searching, setSearching] = useState<string | null>(null)
  const isOwner = !!currentUser && !!w && w.ownerId === currentUser.id
  const pageRef = useRef<HTMLDivElement>(null)
  /** The owner pressed "start" on the welcome screen (shown before the server confirms). */
  const [welcomed, setWelcomed] = useState(false)

  // Another window opened from this page (Friend and Co, search): start it from the top.
  useEffect(() => {
    setViewer(null)
    setSearching(null)
    setWelcomed(false)
    pageRef.current?.scrollTo({ top: 0 })
  }, [w?.id, w?.region])

  if (!w) return null

  const isThailand = w.region === 'thailand'
  const isAvailable = w.status === 'available'
  const isForResale = w.status === 'for_resale'
  const code = w.code || `#${w.id.toString().padStart(3, '0')}`
  const region = REGIONS_BY_ID[w.region]
  const category = CATEGORIES[w.category]
  const highlight = highlightKind(w)
  const highlightText = highlightLabel(w)
  const stars = starLevel(w)
  const profile = w.profile ?? emptyProfile()
  const isAdmin = currentUser?.role === 'admin'
  // Admins still see a suspended window's content (the server sends it to them only).
  const statusView: StatusView | null =
    w.lifecycle === 'suspended' && !isAdmin
      ? 'suspended'
      : w.lifecycle === 'pending'
        ? 'pending'
        : w.welcome && isOwner && !welcomed
          ? 'welcome'
          : w.lifecycle === 'building' && !isOwner
            ? 'building'
            : null
  const startSetup = async () => {
    setWelcomed(true)
    pageRef.current?.scrollTo({ top: 0 })
    const result = await markWelcomed(w.region, w.id)
    if (result.success) props.onWindowChanged()
  }

  const ctx: DetailContext = {
    w,
    profile,
    isOwner,
    currentUser,
    notify: onNotify,
    changed: props.onWindowChanged,
    saveProfile: async (next: WindowProfile) => {
      const result = await saveWindowProfile(w.region, w.id, next)
      if (!result.success) {
        onNotify(result.error, 'error')
        return false
      }
      props.onWindowChanged()
      onNotify('บันทึกเรียบร้อยแล้ว')
      return true
    },
    openAuth: props.onOpenAuth,
    openWindow: props.onOpenWindow,
    search: (query) => setSearching(query),
    showImages: (images, index, caption) => setViewer({ images, index, caption }),
  }

  const share = async () => {
    const url = windowUrl(w)
    if (navigator.share) {
      try {
        await navigator.share({ title: `${w.title} ${code}`, url })
        return
      } catch (e) {
        if ((e as Error)?.name === 'AbortError') return
      }
    }
    if (await copyToClipboard(url)) onNotify('คัดลอกลิงก์แล้ว')
    else onNotify('คัดลอกลิงก์ไม่สำเร็จ', 'error')
  }

  const canAcquireHere = isThailand ? quota.canAcquireThailand : quota.canAcquireRegional
  const quotaMessage = `${quotaFullMessage(quota, isThailand)} ไม่สามารถจับจองเพิ่มได้`
  /** Runs `action` unless the signed-in user still has to complete KYC. */
  const requireKyc = (action: () => void) => () => (currentUser && !currentUser.isVerified ? onOpenKyc() : action())
  const cta = `${btn} ${btnPri} w-full !py-3 !text-[15px]`
  const purchase =
    (isAvailable || (isForResale && !isOwner)) &&
    (!canAcquireHere && currentUser ? (
      <div className="p-3 rounded-xl border border-(--kap-line) text-center">
        <b className="block text-(--kap-warn) text-[13px]">⚠️ {quotaMessage}</b>
        <span className={`text-[12px] ${muted}`}>(โควตาผู้ใช้ 1 คน อ้างอิงเลขบัตรประชาชน: ไทย {quota.thailandLimit} บาน + ภูมิภาค {quota.regionalLimit} บาน)</span>
      </div>
    ) : isAvailable ? (
      <button type="button" onClick={requireKyc(() => onClaim(w))} className={cta}>
        ✨ จับจองเป็นเจ้าของบานนี้ ({rules.claimPriceLabel})
      </button>
    ) : (
      <button type="button" onClick={requireKyc(() => onBuyResale(w))} className={cta}>
        🛍️ ซื้อต่อหน้าต่างนี้ในราคา ฿{w.resalePrice?.toLocaleString()}
      </button>
    ))

  return (
    <div ref={pageRef} className="kap fixed inset-0 z-50 overflow-y-auto overscroll-contain bg-(--kap-bg) text-(--kap-text) font-[Prompt,system-ui,sans-serif] leading-normal">
      <div className="max-w-[900px] mx-auto px-3 pt-3 pb-9 pl-[max(12px,env(safe-area-inset-left))] pr-[max(12px,env(safe-area-inset-right))] flex flex-col gap-3.5">
        <header className="flex flex-wrap gap-2 items-center">
          <span className="text-[20px] sm:text-[22px] font-semibold text-(--kap-gold)">{code}</span>
          <span className={pill} title="ตำแหน่งจัดวางบนหน้าต่างในรอบปัจจุบัน">
            ตำแหน่ง #{w.slotPosition || w.id}
          </span>
          {region && <span className={pill}>{region.name}</span>}
          {category && (
            <span className={pill}>
              {category.icon} {category.label}
              {w.province && ` · ${w.province}`}
            </span>
          )}
          {highlightText && (
            <span className={pill}>
              {highlight === 'hot' ? '🔥' : highlight === 'fresh' ? '✨' : '🟢'} {highlightText}
            </span>
          )}
          {stars > 0 && <span className={pill}>⭐ {STAR_LABELS[stars as 1 | 2 | 3]}</span>}
          {isOwner && <span className={`${pill} !border-(--kap-gold) text-(--kap-gold)`}>บานของฉัน</span>}
          <span className="flex gap-2 ml-auto">
            <button type="button" onClick={share} aria-label="แชร์หน้านี้" className={`${btn} !min-h-9`}>
              แชร์
            </button>
            <button type="button" onClick={onClose} aria-label="ปิดหน้านี้" className={`${btn} !min-h-9`}>
              ✕
            </button>
          </span>
        </header>

        {statusView ? (
          <StatusScreen
            view={statusView}
            w={w}
            onStart={startSetup}
            onBack={onClose}
            onContact={
              isOwner
                ? () => {
                    onClose()
                    window.location.hash = 'contact'
                  }
                : undefined
            }
          />
        ) : isAvailable ? (
          <>
            <section className={card}>
              <div className="rounded-2xl aspect-[4/3] max-h-[60vh] border border-dashed border-(--kap-gold)/60 flex flex-col items-center justify-center text-center p-6">
                <span className="text-4xl mb-2">✨</span>
                <h3 className={h3}>บานหน้าต่างนี้พร้อมให้คุณเป็นเจ้าของ</h3>
                <AvailableNote />
              </div>
            </section>
            <section className={`${card} space-y-3`}>
              <h3 className={`${h3} text-[18px]`}>{w.title}</h3>
              {w.description && <p className={`${para} whitespace-pre-line`}>{w.description}</p>}
              {purchase}
            </section>
          </>
        ) : (
          <>
            {w.lifecycle === 'suspended' && (
              <section className={`${card} !border-[#e0657a] text-[13px]`}>
                <b className="text-[#e0657a]">🔒 หน้าต่างนี้ถูกระงับเพื่อตรวจสอบ</b>
                <p className={`${para} !mb-0`}>ผู้ชมและเจ้าของเห็นเฉพาะหน้า "รอการตรวจสอบ" ปลดระงับได้ที่เมนูผู้ดูแลระบบ › หน้าต่างทั้งหมด</p>
              </section>
            )}
            <Gallery
              ctx={ctx}
              onEditCover={() => props.onOpenEditor(w)}
              badge={isForResale ? <span className="bg-black/70 text-(--kap-gold) rounded-full px-3 py-1 text-[12px] font-semibold">🏷️ เปิดขายต่อ ฿{w.resalePrice?.toLocaleString()}</span> : undefined}
            />
            {isForResale && !isOwner && (
              <section className={`${card} !border-(--kap-gold)/70 space-y-2.5`}>
                <div className="flex justify-between items-center gap-3">
                  <div>
                    <b className="block text-(--kap-gold) text-[13px]">🏷️ หน้าต่างนี้เปิดขายต่อ (Resale)</b>
                    <span className={`text-[12px] ${muted}`}>รับช่วงต่อสิทธิ์หน้าต่างนี้ได้</span>
                  </div>
                  <b className="text-[17px] text-(--kap-gold) shrink-0">฿{w.resalePrice?.toLocaleString()}</b>
                </div>
                {purchase}
              </section>
            )}
            <StatsCard ctx={ctx} onLike={() => props.onLike(w.id)} onToggleFollow={() => props.onToggleFollow(w.id)} onShowFollowing={props.onShowFollowing} />
            <ProfileCard ctx={ctx} onOpenEditor={() => props.onOpenEditor(w)} />
            <UpdatesCard ctx={ctx} />
            <DetailsCard ctx={ctx} />
            <Showcase ctx={ctx} kind="works" />
            <Showcase ctx={ctx} kind="products" />
            <LinksCard ctx={ctx} />
            <FriendCard ctx={ctx} />
            <TagsCard ctx={ctx} footer={!isForResale && !isOwner ? <p className={`${para} mt-3.5`}>หน้าต่างนี้มีเจ้าของแล้ว และไม่ได้เปิดขายต่อในขณะนี้</p> : undefined} />
            {isOwner && (
              <OwnerStudio
                windowItem={w}
                currentUser={currentUser}
                onOpenEditor={() => props.onOpenEditor(w)}
                onListForResale={(price) => props.onListForResale(w, price)}
                onCancelResale={() => props.onCancelResale(w)}
                onSimulatePass24Hours={() => props.onSimulatePass24Hours(w.id)}
                onSimulateHolding={(days) => props.onSimulateHolding(w.id, days)}
                onOpenKyc={onOpenKyc}
              />
            )}
          </>
        )}
      </div>

      {viewer && <Lightbox images={viewer.images} index={viewer.index} caption={viewer.caption} onIndex={(index) => setViewer({ ...viewer, index })} onClose={() => setViewer(null)} />}
      {searching !== null && <SearchDialog initial={searching} onClose={() => setSearching(null)} onOpenWindow={props.onOpenWindow} />}
    </div>
  )
}

function AvailableNote() {
  const { editPolicy } = useSettings()
  return (
    <p className={`${para} max-w-sm`}>
      จับจองเพื่อลงรูปภาพส่วนตัว ธุรกิจ หรือเรื่องราวแห่งความทรงจำของคุณ {editPolicyLabel(editPolicy)} และขายต่อได้ทุกเวลา
    </p>
  )
}

/** Searches every window loaded on the boards by name, code, category, province or owner. */
function SearchDialog({ initial, onClose, onOpenWindow }: { initial: string; onClose: () => void; onOpenWindow: (w: WindowItem) => void }) {
  const [query, setQuery] = useState(initial)
  const all = useMemo(() => REGION_IDS.flatMap((r) => loadBoard(r)).filter((x) => x.status !== 'available'), [])
  const q = query.trim().toLowerCase()
  const results = all
    .filter((x) => !q || [x.title, x.description, x.code, x.province, x.ownerName, x.ownerLabel, CATEGORIES[x.category]?.label, ...(x.profile?.tags ?? [])].join(' ').toLowerCase().includes(q))
    .slice(0, 30)
  return (
    <KapDialog title="🔍 ค้นหาหน้าต่าง" label="ค้นหาหน้าต่าง" onClose={onClose}>
      <input autoFocus value={query} onChange={(e) => setQuery(e.target.value)} aria-label="คำค้นหา" placeholder="ชื่อ รหัส หรือหมวดหมู่" className={field} />
      {results.length ? (
        results.map((x) => (
          <button key={`${x.region}-${x.id}`} type="button" onClick={() => onOpenWindow(x)} className="w-full text-left p-2 rounded-lg hover:bg-white/5 cursor-pointer text-(--kap-text)">
            <b>{x.title}</b>{' '}
            <span className={`${muted} text-[13px]`}>
              {x.code} · {CATEGORIES[x.category]?.label}
            </span>
          </button>
        ))
      ) : (
        <p className={para}>ไม่พบผลลัพธ์</p>
      )}
    </KapDialog>
  )
}
