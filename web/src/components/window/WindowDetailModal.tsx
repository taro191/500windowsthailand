import { useEffect, useMemo, useRef, useState } from 'react'
import type { Quota, User, WindowItem, WindowProfile } from '@shared/types'
import { REGION_IDS, REGIONS_BY_ID } from '@shared/regions'
import { CATEGORIES } from '@shared/categories'
import { highlightKind, highlightLabel, starLevel } from '@shared/windowBadges'
import { emptyProfile } from '@shared/windowProfile'
import { quotaFullMessage } from '@shared/windowQuota'
import { daysLeft, REFUND_DAYS, trialPayBy, TRIAL_DAYS, TRIAL_GRACE_DAYS } from '@shared/trial'
import { inCodeList, isPaidOnly } from '@shared/paidOnly'
import { copyToClipboard } from '@/lib/browser'
import { claimPriceOf, editPolicyLabel, useRules, useSettings } from '@/lib/settings'
import { loadBoard, markWelcomed, publishWindow, refundWindow, saveWindowProfile } from '@/lib/store'
import { STAR_LABELS } from '../board/WindowBadges'
import { Lightbox, type LightboxCaption } from '../Lightbox'
import { CoCard } from './detail/CoCard'
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
  /** `trial`: open the claim form at the free-trial step. */
  onClaim: (window: WindowItem, trial?: boolean) => void
  onBuyResale: (window: WindowItem) => void
  /** Owner of a free trial window: pay the claim price to keep and publish it. */
  onPayTrial: (window: WindowItem) => void
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
  const settings = useSettings()
  const [viewer, setViewer] = useState<{ images: string[]; index: number; caption?: LightboxCaption } | null>(null)
  const [searching, setSearching] = useState<string | null>(null)
  const isOwner = !!currentUser && !!w && w.ownerId === currentUser.id
  const pageRef = useRef<HTMLDivElement>(null)
  /** The owner pressed "start" on the welcome screen (shown before the server confirms). */
  const [welcomed, setWelcomed] = useState(false)
  const [publishing, setPublishing] = useState(false)

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
  // The owner and admins still get a suspended window's content (the server sends it to them only).
  const statusView: StatusView | null =
    w.lifecycle === 'suspended' && !isAdmin && !isOwner
      ? 'suspended'
      : w.lifecycle === 'pending'
        ? 'pending'
        : w.welcome && isOwner && !welcomed
          ? 'welcome'
          : (w.lifecycle === 'building' || w.lifecycle === 'unpaid') && !isOwner
            ? 'building'
            : null
  const startSetup = async () => {
    setWelcomed(true)
    pageRef.current?.scrollTo({ top: 0 })
    const result = await markWelcomed(w.region, w.id)
    if (result.success) props.onWindowChanged()
  }
  const contactTeam = () => {
    onClose()
    window.location.hash = 'contact'
  }
  const publish = async () => {
    setPublishing(true)
    const result = await publishWindow(w.region, w.id)
    setPublishing(false)
    if (!result.success) return onNotify(result.error, 'error')
    props.onWindowChanged()
    onNotify('เผยแพร่แล้ว ผู้เข้าชมเห็นหน้าต่างของคุณแล้ว')
  }
  const refund = async (toBank: boolean) => {
    const where = toBank ? 'โอนเข้าบัญชีรับเงินของคุณ (ทีมงานตรวจและโอนให้)' : 'คืนเข้ากระเป๋าเงินของคุณทันที'
    const ok = window.confirm(
      `ขอคืนเงินค่าจับจอง ${w.code}?

เงินเต็มจำนวนจะ${where} และบานนี้จะกลับเป็นบานว่างทันที ข้อมูลและรูปในบานจะถูกลบ ยกเลิกภายหลังไม่ได้`,
    )
    if (!ok) return
    const result = await refundWindow(w.region, w.id, toBank)
    if (!result.success) return onNotify(result.error, 'error')
    props.onWindowChanged()
    onNotify(
      toBank
        ? `ส่งคำขอโอนเงินคืน ฿${result.amount.toLocaleString()} แล้ว ทีมงานจะโอนเข้าบัญชีของคุณ ดูสถานะได้ที่กระเป๋าเงิน`
        : `คืนเงิน ฿${result.amount.toLocaleString()} เข้ากระเป๋าเงินแล้ว`,
    )
    onClose()
  }
  // requireKyc is defined further down, so it is looked up when clicked.
  const payTrial = () => requireKyc(() => props.onPayTrial(w))()

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
  // One free trial per account; not on paid-only or not-for-sale codes.
  const offerTrial =
    isAvailable &&
    !currentUser?.trialUsed &&
    !isPaidOnly(w.code, settings.paidOnly.codes) &&
    !inCodeList(w.code, settings.notForSale.codes)
  const purchase =
    (isAvailable || (isForResale && !isOwner)) &&
    (!canAcquireHere && currentUser ? (
      <div className="p-3 rounded-xl border border-(--kap-line) text-center">
        <b className="block text-(--kap-warn) text-[13px]">⚠️ {quotaMessage}</b>
        <span className={`text-[12px] ${muted}`}>(โควตาผู้ใช้ 1 คน อ้างอิงเลขบัตรประชาชน: ไทย {quota.thailandLimit} บาน + ภูมิภาค {quota.regionalLimit} บาน)</span>
      </div>
    ) : isAvailable ? (
      <div className="flex flex-col gap-2">
        <button type="button" onClick={requireKyc(() => onClaim(w))} className={cta}>
          ✨ จับจองเป็นเจ้าของบานนี้ ({rules.claimPriceLabel})
        </button>
        {offerTrial && (
          <button
            type="button"
            onClick={requireKyc(() => onClaim(w, true))}
            className={`${btn} w-full !py-3 !text-[15px] !border-transparent !bg-amber-400 hover:!bg-amber-300 !text-stone-950 font-bold`}
          >
            ทดลองใช้งาน {TRIAL_DAYS} วัน
          </button>
        )}
      </div>
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
          {region && (
            <span className={`${pill} !border-(--kap-gold)/70 text-(--kap-gold) font-semibold`} title="ภูมิภาค">
              📍 {region.name}
            </span>
          )}
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
            onContact={isOwner ? contactTeam : undefined}
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
            {w.lifecycle === 'suspended' && isOwner && (
              <section className={`${card} !border-[#e0657a] text-[13px] flex flex-wrap items-center gap-3`}>
                <div className="flex-1 min-w-[200px]">
                  <b className="text-[#e0657a]">🔒 หน้าต่างบานนี้อยู่ระหว่างรอการตรวจสอบ</b>
                  <p className={`${para} !mb-0`}>คุณยังแก้ไขข้อมูลได้ แต่ยังเผยแพร่ไม่ได้ จนกว่าจะยกเลิกการระงับ</p>
                </div>
                <button type="button" onClick={contactTeam} className={btn}>
                  ติดต่อทีมงาน
                </button>
              </section>
            )}
            {w.lifecycle === 'suspended' && !isOwner && (
              <section className={`${card} !border-[#e0657a] text-[13px]`}>
                <b className="text-[#e0657a]">🔒 หน้าต่างนี้ถูกระงับเพื่อตรวจสอบ</b>
                <p className={`${para} !mb-0`}>ผู้ชมเห็นเฉพาะหน้า "รอการตรวจสอบ" เจ้าของยังแก้ไขข้อมูลได้แต่เผยแพร่ไม่ได้ ปลดระงับได้ที่เมนูผู้ดูแลระบบ › หน้าต่างทั้งหมด</p>
              </section>
            )}
            {w.takenDown && (
              <section className={`${card} !border-[#e0657a] text-[13px] flex flex-wrap items-center gap-3`}>
                <div className="flex-1 min-w-[200px]">
                  <b className="text-[#e0657a]">⚠️ เนื้อหาถูกระงับโดยผู้ดูแลระบบ</b>
                  <p className={`${para} !mb-0`}>เหตุผล: {w.takenDown.reason}</p>
                  <p className={`${para} !mb-0`}>
                    {isOwner
                      ? 'ข้อมูลและรูปของคุณยังอยู่ครบ เห็นได้เฉพาะคุณและผู้ดูแลระบบ ผู้ชมจะเห็นหน้า "กำลังพัฒนา" แก้ไขเนื้อหาให้เหมาะสมแล้วกดเผยแพร่อีกครั้ง'
                      : 'ผู้ชมเห็นหน้า "กำลังพัฒนา" เจ้าของต้องแก้ไขแล้วกดเผยแพร่ใหม่ หรือคืนเนื้อหาได้ที่เมนูผู้ดูแลระบบ › หน้าต่างทั้งหมด'}
                  </p>
                </div>
                {isOwner && (
                  <button type="button" onClick={contactTeam} className={btn}>
                    ติดต่อทีมงาน
                  </button>
                )}
              </section>
            )}
            {w.trialEndsAt && isOwner && (
              <TrialBar w={w} price={claimPriceOf(w)} onPay={payTrial} />
            )}
            {w.unpublished && isOwner && !w.trialEndsAt && (
              <section className={`${card} !border-[#3fb8b0] text-[13px] flex flex-wrap items-center gap-3`}>
                <div className="flex-1 min-w-[200px]">
                  <b className="text-[#3fb8b0]">หน้าต่างนี้ยังไม่เผยแพร่</b>
                  <p className={`${para} !mb-0`}>ผู้เข้าชมจะเห็นหน้า "กำลังพัฒนา" จนกว่าคุณจะกดเผยแพร่ ตกแต่งหน้าต่างให้พร้อม (มีรูปอย่างน้อย 1 รูป) แล้วกดเผยแพร่ได้เลย</p>
                </div>
                <button
                  type="button"
                  onClick={publish}
                  disabled={publishing || w.lifecycle === 'suspended'}
                  title={w.lifecycle === 'suspended' ? 'เผยแพร่ไม่ได้ระหว่างรอการตรวจสอบ' : undefined}
                  className={`${btn} ${btnPri} disabled:opacity-40`}
                >
                  {publishing ? 'กำลังเผยแพร่...' : 'เผยแพร่'}
                </button>
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
            {w.trialEndsAt ? (
              <TrialLockedCard isOwner={isOwner} onPay={payTrial} />
            ) : (
              <>
                <FriendCard ctx={ctx} />
                <CoCard ctx={ctx} />
              </>
            )}
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
            {isOwner && w.refundUntil && <RefundBar until={w.refundUntil} hasAccount={!!currentUser?.payoutAccount} onRefund={refund} />}
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

/** Friend and Co and the Store card, locked on a free trial window until it is paid. */
function TrialLockedCard({ isOwner, onPay }: { isOwner: boolean; onPay: () => void }) {
  return (
    <section className={`${card} text-[13px] flex flex-wrap items-center gap-3`}>
      <div className="flex-1 min-w-[200px]">
        <b>🔒 Friend and Co · 500 Windows Thailand : Store</b>
        <p className={`${para} !mb-0`}>บานทดลองใช้ฟรียังใช้ 2 ส่วนนี้ไม่ได้ ชำระค่าจับจองแล้วปลดล็อกทันที ข้อมูลเดิมอยู่ครบ</p>
      </div>
      {isOwner && (
        <button type="button" onClick={onPay} className={`${btn} ${btnPri}`}>
          อัปเกรดเป็นบานจริง
        </button>
      )}
    </section>
  )
}

/** Owner of a window bought from the system: full refund within REFUND_DAYS, giving the window back. */
function RefundBar({ until, hasAccount, onRefund }: { until: string; hasAccount: boolean; onRefund: (toBank: boolean) => void }) {
  return (
    <section className={`${card} text-[13px] flex flex-wrap items-center gap-3`}>
      <div className="flex-1 min-w-[200px]">
        <b>↩️ ขอคืนเงินได้ภายใน {REFUND_DAYS} วัน (เหลือ {daysLeft(until)} วัน)</b>
        <p className={`${para} !mb-0`}>
          คืนเงินเต็มจำนวนเข้ากระเป๋าเงิน หรือโอนเข้าบัญชีรับเงินของคุณ ถ้ายังไม่ได้ใช้ Friend and Co และต้องคืนบานนี้ด้วย
          {!hasAccount && ' · ตั้งบัญชีรับเงินในกระเป๋าเงินก่อน ถ้าต้องการรับเป็นเงินโอน'}
        </p>
      </div>
      <button type="button" onClick={() => onRefund(false)} className={btn}>
        คืนเข้ากระเป๋าเงิน
      </button>
      <button type="button" onClick={() => onRefund(true)} disabled={!hasAccount} className={`${btn} disabled:opacity-40`}>
        โอนเข้าบัญชี
      </button>
    </section>
  )
}

/** Owner of a free trial window: days left, then the pay-by date, and the pay button. */
function TrialBar({ w, price, onPay }: { w: WindowItem; price: number; onPay: () => void }) {
  const unpaid = w.lifecycle === 'unpaid'
  const payBy = trialPayBy(w.trialEndsAt!)
  const date = (d: Date) => d.toLocaleDateString('th-TH', { day: 'numeric', month: 'short', year: 'numeric' })
  const tone = unpaid ? 'text-(--kap-warn)' : 'text-[#3fb8b0]'
  return (
    <section className={`${card} ${unpaid ? '!border-(--kap-warn)' : '!border-[#3fb8b0]'} text-[13px] flex flex-wrap items-center gap-3`}>
      <div className="flex-1 min-w-[200px]">
        {unpaid ? (
          <>
            <b className={tone}>⏳ ครบช่วงทดลองใช้แล้ว · รอชำระเงิน (เหลือ {daysLeft(payBy)} วัน)</b>
            <p className={`${para} !mb-0`}>
              ชำระค่าจับจองภายใน {date(payBy)} เพื่อเก็บบานนี้ไว้และเผยแพร่ ถ้าเลยกำหนด บานจะกลับเป็นบานว่าง แต่ข้อมูลของคุณยังเก็บไว้ให้กู้ใส่บานว่างอื่นได้
            </p>
          </>
        ) : (
          <>
            <b className={tone}>🧪 บานทดลองใช้ฟรี · เหลือ {daysLeft(w.trialEndsAt!)} วัน</b>
            <p className={`${para} !mb-0`}>
              ผู้เข้าชมจะเห็นหน้า "กำลังพัฒนา" จนกว่าคุณจะชำระค่าจับจอง ชำระแล้วเผยแพร่ทันที · ครบกำหนดแล้วมีเวลาชำระต่ออีก {TRIAL_GRACE_DAYS} วัน
            </p>
          </>
        )}
      </div>
      <button type="button" onClick={onPay} disabled={w.reserved} className={`${btn} ${btnPri} disabled:opacity-40`}>
        {w.reserved ? 'รอตรวจสอบสลิป' : `ชำระ ฿${price.toLocaleString()} และเผยแพร่`}
      </button>
    </section>
  )
}
