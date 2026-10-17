import { useEffect, useMemo, useState } from 'react'
import {
  Calendar,
  Camera,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  ChevronUp,
  Clock,
  ExternalLink,
  Eye,
  EyeOff,
  FastForward,
  Globe,
  Heart,
  Image as ImageIcon,
  Lock,
  Mail,
  MessageCircle,
  Package,
  Pencil,
  Phone,
  Search,
  Share2,
  ShoppingBag,
  Sparkles,
  Star,
  Store,
  Tag,
  Trash2,
  Users,
  X,
} from 'lucide-react'
import QRCode from 'qrcode'
import type { Quota, User, WindowItem, WindowLink, WindowOffering, WindowProfile, WindowUpdate } from '@shared/types'
import { REGION_IDS, REGIONS_BY_ID } from '@shared/regions'
import { CATEGORIES } from '@shared/categories'
import { followerCount, highlightKind, highlightLabel, likesToday, starLevel, todaysNote } from '@shared/windowBadges'
import { emptyProfile, hasContacts, hasDetails, hasSocials, lineUrl, PROFILE_LIMITS, SOCIALS, telHref, type SocialKey } from '@shared/windowProfile'
import {
  getEditStatus,
  getHoldingPeriod,
  getPriceCap,
  commissionOf,
} from '@/lib/ownershipRules'
import { maskCitizenId, maskPhone } from '@shared/identity'
import { copyToClipboard } from '@/lib/browser'
import { editPolicyLabel, useRules, useSettings } from '@/lib/settings'
import {
  decideLink,
  deleteReview,
  deleteUpdate,
  editUpdate,
  fetchWindow,
  isDemo,
  loadBoard,
  postUpdate,
  removeLink,
  requestLink,
  saveReview,
} from '@/lib/store'
import { deleteReviewAsAdmin, deleteUpdateAsAdmin } from '@/lib/adminApi'
import { Avatar } from '../Avatar'
import { STAR_LABELS } from '../board/WindowBadges'
import { EditProfileModal } from './EditProfileModal'

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

type Props = WindowDetailModalProps & { windowItem: WindowItem; profile: WindowProfile; isOwner: boolean; canManage: boolean }

// Look of the window page (dark navy, violet frame, orange → pink → violet accents).
const LINE = 'border-[#8b64ff59]'
const panel = `rounded-2xl bg-[#0A1330] border ${LINE} p-3.5`
const mut = 'text-[#A9B2CC]'
const grad = 'bg-gradient-to-r from-[#FF8A00] via-[#FF4D94] to-[#8B2CFF]'
const btn = 'border border-[#8B2CFF] rounded-xl px-4 py-1.5 bg-[#120a3a] hover:bg-[#1c1060] transition-colors cursor-pointer disabled:opacity-60 disabled:cursor-not-allowed'
const btnOn = `${grad} !border-transparent text-white hover:opacity-95`
const chip = `border ${LINE} rounded-full px-3 py-px text-[12.5px] bg-[#0d0a30] hover:border-[#FF4D94] transition-colors cursor-pointer`
const field = `w-full bg-[#050c24] border ${LINE} rounded-[10px] p-2.5 text-white text-sm focus:outline-none focus:border-[#FF4D94]`
const linkText = 'text-[#c79bff] hover:text-[#dcc0ff] cursor-pointer'

const windowUrl = (w: { region: string; id: number }) => `${window.location.href.split('#')[0]}#window-${w.region}-${w.id}`
const compact = (n: number) => (n >= 1000 ? `${(n / 1000).toFixed(n >= 10000 ? 0 : 1).replace(/\.0$/, '')}K` : n.toLocaleString())
const thaiDateTime = (iso: string) => new Date(iso).toLocaleString('th-TH', { dateStyle: 'medium', timeStyle: 'short' })

type DialogState =
  | { kind: 'search'; query: string }
  | { kind: 'share' }
  | { kind: 'offering'; offering: WindowOffering }
  | { kind: 'offerings' }
  | { kind: 'work'; index: number }
  | { kind: 'update'; update: WindowUpdate | null }
  | { kind: 'linkRequest' }
  | { kind: 'linkPending' }

export function WindowDetailModal(props: WindowDetailModalProps) {
  const { windowItem, currentUser, quota, onClose, onClaim, onBuyResale, onOpenKyc } = props
  const rules = useRules()
  const [ownerView, setOwnerView] = useState<'manage' | 'preview'>('manage')
  const [editingProfile, setEditingProfile] = useState(false)
  const [dialog, setDialog] = useState<DialogState | null>(null)
  const isOwner = !!currentUser && !!windowItem && windowItem.ownerId === currentUser.id

  useEffect(() => {
    setOwnerView('manage')
    setEditingProfile(false)
    setDialog(null)
  }, [windowItem?.id, windowItem?.region, isOwner])

  if (!windowItem) return null

  const w = windowItem
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
  const canManage = isOwner && ownerView === 'manage'
  const shared: Props = { ...props, windowItem: w, profile, isOwner, canManage }
  const open = (next: DialogState) => () => setDialog(next)
  const search = (query = '') => setDialog({ kind: 'search', query })

  const canAcquireHere = isThailand ? quota.canAcquireThailand : quota.canAcquireRegional
  const quotaMessage = isThailand
    ? `คุณมีหน้าต่างบานประเทศไทยครบ 1 บานแล้ว (${quota.thailandWindow?.code}) ไม่สามารถจับจองเพิ่มได้`
    : `คุณมีหน้าต่างบานภูมิภาคครบ 1 บานแล้ว (${quota.regionalWindow?.code}) ไม่สามารถจับจองเพิ่มได้`

  /** Runs `action` unless the signed-in user still has to complete KYC. */
  const requireKyc = (action: () => void) => () => {
    if (currentUser && !currentUser.isVerified) {
      onOpenKyc()
      return
    }
    action()
  }

  const ctaClass = `w-full py-3 px-4 rounded-2xl text-sm font-bold flex items-center justify-center gap-2 cursor-pointer text-white ${grad} shadow-[0_4px_18px_#ff4d9455] hover:opacity-95`
  const purchaseBar = (
    <>
      {isAvailable &&
        (!canAcquireHere && currentUser ? (
          <QuotaReached message={quotaMessage} />
        ) : (
          <button onClick={requireKyc(() => onClaim(w))} className={ctaClass}>
            <Sparkles className="w-4 h-4" />
            <span>จับจองเป็นเจ้าของบานนี้ ({rules.claimPriceLabel})</span>
          </button>
        ))}
      {isForResale &&
        !isOwner &&
        (!canAcquireHere && currentUser ? (
          <QuotaReached message={quotaMessage} />
        ) : (
          <button onClick={requireKyc(() => onBuyResale(w))} className={ctaClass}>
            <ShoppingBag className="w-4 h-4" />
            <span>ซื้อต่อหน้าต่างนี้ในราคา ฿{w.resalePrice?.toLocaleString()}</span>
          </button>
        ))}
    </>
  )

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-black/85 backdrop-blur-sm p-2 sm:p-3.5 font-['Noto_Sans_Thai','Prompt',sans-serif] text-white text-sm leading-normal">
      <div
        className="relative mx-auto max-w-[1240px] rounded-3xl border-2 border-[#6427FF] p-2.5 sm:p-3.5 bg-[#03091A] bg-[radial-gradient(900px_400px_at_80%_0,#1a0f4a55,transparent)] shadow-[0_0_24px_#6427ff44]"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="sticky top-0 z-10 -mx-2.5 sm:-mx-3.5 -mt-2.5 sm:-mt-3.5 mb-1 px-4 sm:px-5 pt-3.5 pb-3 rounded-t-3xl bg-[#03091A]/95 backdrop-blur flex items-center gap-2.5 flex-wrap">
          <span className={`w-[34px] h-[34px] rounded-full ${grad} grid place-items-center text-base shrink-0`}>{region?.icon}</span>
          <span className={`font-bold text-xl bg-clip-text text-transparent ${grad}`}>{code}</span>
          <span className={`border ${LINE} rounded-xl px-3 py-1 bg-[#120a3a] whitespace-nowrap text-[13px]`} title="ตำแหน่งจัดวางบนหน้าต่างในรอบปัจจุบัน">
            ตำแหน่ง #{w.slotPosition || w.id}
          </span>
          {region && <span className={`hidden sm:inline border ${LINE} rounded-xl px-3 py-1 bg-[#120a3a] whitespace-nowrap text-[13px]`}>{region.name}</span>}
          <span className={`order-last lg:order-none basis-full lg:basis-auto lg:flex-1 lg:min-w-40 lg:border-l ${LINE} lg:pl-3 ${mut} text-[13px]`}>
            {category?.icon} {category?.label}
            {w.province && ` · ${w.province}`}
          </span>
          <span className="ml-auto flex items-center gap-0.5">
            <button onClick={() => search()} className="w-9 h-9 rounded-[10px] grid place-items-center hover:bg-white/10 cursor-pointer" aria-label="ค้นหาหน้าต่าง" title="ค้นหาหน้าต่าง">
              <Search className="w-[18px] h-[18px]" />
            </button>
            <button onClick={open({ kind: 'share' })} className="h-9 px-2 rounded-[10px] flex items-center gap-1.5 hover:bg-white/10 cursor-pointer" title="แชร์ลิงก์บานนี้">
              <Share2 className="w-4 h-4" />
              <span className="hidden sm:inline">แชร์</span>
            </button>
            <button onClick={onClose} className="w-9 h-9 rounded-[10px] grid place-items-center hover:bg-white/10 cursor-pointer" aria-label="ปิด">
              <X className="w-5 h-5" />
            </button>
          </span>
        </div>

        {(highlightText || stars > 0 || isOwner) && (
          <div className="flex flex-wrap items-center gap-2 mb-2.5 ml-1">
            {highlightText && (
              <span
                className={`inline-flex items-center gap-1 rounded-[10px] px-3.5 py-0.5 font-bold border ${highlight === 'hot' ? 'border-[#FF8A00] bg-[#2a1500]' : highlight === 'fresh' ? 'border-[#FF4D94] bg-[#2a0a22]' : 'border-emerald-500 bg-emerald-950/60'}`}
              >
                {highlight === 'hot' ? '🔥' : highlight === 'fresh' ? '✨' : '🟢'} {highlightText}
              </span>
            )}
            {stars > 0 && (
              <span className="rounded-[10px] px-3 py-0.5 text-xs font-bold border border-[#8B2CFF] bg-[#1c1060]">⭐ {STAR_LABELS[stars as 1 | 2 | 3]}</span>
            )}
            {isOwner && <span className="rounded-[10px] px-3 py-0.5 text-xs font-bold border border-[#8B2CFF] bg-[#120a3a] text-[#c79bff]">บานของฉัน</span>}
          </div>
        )}

        {isAvailable ? (
          <div className="grid grid-cols-1 lg:grid-cols-[57fr_43fr] gap-3.5">
            <AvailableImage />
            <div className={`${panel} flex flex-col justify-between gap-4`}>
              <div className="space-y-3.5">
                <div>
                  <h1 className="text-2xl font-bold leading-snug">{w.title}</h1>
                  <p className={`mt-2 ${mut} leading-relaxed`}>{w.description}</p>
                </div>
                <OwnerCard {...shared} />
                <Cheers windowItem={w} onLike={props.onLike} />
              </div>
              {purchaseBar}
            </div>
          </div>
        ) : (
          <div className="flex flex-col gap-3.5 lg:grid lg:grid-cols-[57fr_43fr]">
            <div className="contents lg:flex lg:flex-col lg:gap-3.5 lg:min-w-0">
              <div className="order-1 lg:order-none">
                <Hero windowItem={w} profile={profile} />
              </div>
              <div className="order-2 lg:order-none">
                <ProfilePanel {...shared} onSearch={search} />
              </div>
              <div className="order-4 lg:order-none empty:hidden">
                <Offerings {...shared} onOpen={(offering) => setDialog({ kind: 'offering', offering })} onAll={open({ kind: 'offerings' })} onEditProfile={() => setEditingProfile(true)} />
              </div>
              <div className="order-5 lg:order-none">
                <FriendAndCo {...shared} onRequest={open({ kind: 'linkRequest' })} onPending={open({ kind: 'linkPending' })} />
              </div>
            </div>

            <div className="contents lg:flex lg:flex-col lg:gap-3.5 lg:min-w-0">
              {isOwner && (
                <div className="order-3 lg:order-none space-y-3.5">
                  <div className={`flex items-center gap-1.5 p-1 rounded-xl border ${LINE} bg-[#0A1330] text-xs`}>
                    <button
                      type="button"
                      onClick={() => setOwnerView('manage')}
                      className={`flex-1 py-2 px-3 rounded-lg font-semibold flex items-center justify-center gap-1.5 cursor-pointer ${ownerView === 'manage' ? `${grad} text-white` : `${mut} hover:text-white`}`}
                    >
                      <Lock className="w-3.5 h-3.5" />
                      <span>🛠️ สตูดิโอจัดการบาน</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => setOwnerView('preview')}
                      className={`flex-1 py-2 px-3 rounded-lg font-semibold flex items-center justify-center gap-1.5 cursor-pointer ${ownerView === 'preview' ? `${grad} text-white` : `${mut} hover:text-white`}`}
                    >
                      <Globe className="w-3.5 h-3.5" />
                      <span>👀 มุมมองผู้เยี่ยมชม</span>
                    </button>
                  </div>
                  {canManage && <OwnerStudio {...props} windowItem={w} onEditProfile={() => setEditingProfile(true)} />}
                </div>
              )}
              {(isForResale || !isOwner) && (
                <div className="order-3 lg:order-none space-y-2 empty:hidden">
                  {isForResale && <ResaleBanner windowItem={w} />}
                  {purchaseBar}
                </div>
              )}
              <div className="order-6 lg:order-none">
                <MoreInfo {...shared} onOpenWork={(index) => setDialog({ kind: 'work', index })} />
              </div>
              <div className="order-7 lg:order-none">
                <Updates {...shared} onWrite={(update) => setDialog({ kind: 'update', update })} />
              </div>
              <div className="order-8 lg:order-none">
                <ContactButtons profile={profile} onShare={open({ kind: 'share' })} />
              </div>
              {hasContacts(profile) && (
                <div className="order-9 lg:order-none">
                  <ContactPanel profile={profile} />
                </div>
              )}
              {(hasSocials(profile) || w.externalLink || profile.website) && (
                <div className="order-10 lg:order-none">
                  <Socials windowItem={w} profile={profile} />
                </div>
              )}
              <div className="order-11 lg:order-none">
                <Categories windowItem={w} profile={profile} onSearch={search} />
              </div>
              {!isForResale && !isOwner && <p className={`order-12 lg:order-none text-center text-xs ${mut}`}>หน้าต่างนี้มีเจ้าของแล้ว และไม่ได้เปิดขายต่อในขณะนี้</p>}
            </div>
          </div>
        )}
      </div>

      {dialog && <DialogView {...shared} dialog={dialog} onDialog={setDialog} />}

      {editingProfile && (
        <EditProfileModal
          windowItem={w}
          onClose={() => setEditingProfile(false)}
          onSaved={() => {
            setEditingProfile(false)
            props.onWindowChanged()
            props.onNotify('บันทึกโปรไฟล์บานเรียบร้อยแล้ว')
          }}
        />
      )}
    </div>
  )
}

function AvailableImage() {
  const { editPolicy } = useSettings()
  return (
    <div className={`relative aspect-[16/9] rounded-2xl overflow-hidden border ${LINE} bg-[#0A1330] flex items-center justify-center`}>
      <div className="text-center p-8">
        <div className="w-16 h-16 rounded-full bg-[#120a3a] border border-dashed border-[#FF4D94]/60 flex items-center justify-center mx-auto mb-3 text-[#FF4D94]">
          <Sparkles className="w-8 h-8" />
        </div>
        <h3 className="text-lg font-bold">บานหน้าต่างนี้พร้อมให้คุณเป็นเจ้าของ</h3>
        <p className={`text-xs ${mut} mt-1 max-w-sm mx-auto leading-relaxed`}>
          จับจองเพื่อลงรูปภาพส่วนตัว ธุรกิจ หรือเรื่องราวแห่งความทรงจำของคุณ {editPolicyLabel(editPolicy)}
          และขายต่อได้ทุกเวลา (โควตาผู้ใช้: ไทย 1 บาน + ภูมิภาค 1 บาน)
        </p>
      </div>
    </div>
  )
}

/** Who holds the window ("ยังไม่มีเจ้าของ" while it's free), its category and a follow button. */
function OwnerCard({ windowItem: w, currentUser, onToggleFollow }: Props) {
  const isFollowing = !!currentUser && !!w.followerIds?.includes(currentUser.id)
  const category = CATEGORIES[w.category]
  return (
    <div className={`p-3.5 rounded-2xl bg-[#0d1538] border ${LINE} flex items-center justify-between gap-3`}>
      <div className="flex items-center gap-3 min-w-0">
        <span className={`w-12 h-12 rounded-full ${grad} p-[2px] shrink-0`}>
          <span className="w-full h-full rounded-full bg-[#03091A] grid place-items-center text-base font-bold text-[#ffb3d0]">
            {w.status === 'available' ? '🇹🇭' : w.ownerName.charAt(0).toUpperCase()}
          </span>
        </span>
        <div className="min-w-0">
          <div className="flex items-center gap-1.5 flex-wrap">
            <span className="font-bold text-sm truncate">{w.ownerName}</span>
            <span className="text-[10px] px-1.5 rounded bg-[#120a3a] text-[#c79bff] border border-[#8B2CFF]/60">เจ้าของบาน</span>
          </div>
          <div className={`text-xs ${mut} mt-0.5`}>
            {category?.icon} {category?.label}
            {w.province && <span className="text-white/80"> · {w.province}</span>}
          </div>
        </div>
      </div>
      <button onClick={() => onToggleFollow(w.id)} className={`${btn} ${isFollowing ? '' : btnOn} !px-3 text-xs font-semibold flex items-center gap-1.5 shrink-0`}>
        <Users className="w-3.5 h-3.5" />
        {isFollowing ? 'กำลังติดตาม' : 'ติดตาม'}
      </button>
    </div>
  )
}

const CHEERS = [
  { emoji: '❤️', label: 'ถูกใจ' },
  { emoji: '👏', label: 'ชื่นชม' },
  { emoji: '☕', label: 'ส่งกาแฟ' },
  { emoji: '✨', label: 'ยอดเยี่ยม' },
]

/** Quick reactions; each one counts as the visitor's like for the day. */
function Cheers({ windowItem: w, onLike }: { windowItem: WindowItem; onLike: (id: number) => void }) {
  const [message, setMessage] = useState('')
  useEffect(() => setMessage(''), [w.id, w.region])
  useEffect(() => {
    if (!message) return
    const timer = setTimeout(() => setMessage(''), 3000)
    return () => clearTimeout(timer)
  }, [message])
  return (
    <div className={`p-3.5 rounded-2xl bg-[#0d1538] border ${LINE} space-y-3`}>
      <div className="flex items-center justify-between">
        <span className="text-xs font-bold">💬 ส่งกำลังใจให้เพื่อน</span>
        <span className="text-[11px] text-[#FF4D94] font-bold flex items-center gap-1">
          <Heart className="w-3 h-3 fill-[#FF4D94]" /> {w.likesCount.toLocaleString()} กำลังใจ
        </span>
      </div>
      {message && <div className="p-2 rounded-xl bg-[#1c1060] border border-[#8B2CFF] text-[#ffb3d0] text-xs text-center font-semibold">✨ {message}</div>}
      <div className="grid grid-cols-4 gap-2">
        {CHEERS.map((c) => (
          <button
            key={c.label}
            onClick={() => {
              onLike(w.id)
              setMessage(`ส่งกำลังใจ "${c.emoji} ${c.label}" ให้เพื่อนเรียบร้อยแล้ว!`)
            }}
            className={`py-2 px-1.5 rounded-xl bg-[#120a3a] border ${LINE} hover:border-[#FF4D94] flex flex-col items-center gap-0.5 cursor-pointer active:scale-95 transition group`}
          >
            <span className="text-base group-hover:scale-110 transition-transform">{c.emoji}</span>
            <span className={`text-[10px] ${mut} group-hover:text-white`}>{c.label}</span>
          </button>
        ))}
      </div>
    </div>
  )
}

/** Main window image followed by the owner's extra photos. */
function Hero({ windowItem: w, profile }: { windowItem: WindowItem; profile: WindowProfile }) {
  const images = [w.imageUrl, ...profile.gallery].filter(Boolean)
  const [index, setIndex] = useState(0)
  useEffect(() => setIndex(0), [w.id, w.region, images.length])
  const at = Math.min(index, Math.max(images.length - 1, 0))
  const go = (step: number) => setIndex((i) => (i + step + images.length) % images.length)
  const arrow = 'absolute top-1/2 -translate-y-1/2 w-9 h-9 rounded-full bg-black/60 grid place-items-center cursor-pointer hover:bg-black/80'

  return (
    <div className={`relative aspect-[16/9] rounded-2xl overflow-hidden border ${LINE} bg-[#0A1330]`}>
      {images[at] ? (
        <img src={images[at]} alt={w.title} className="w-full h-full object-cover" />
      ) : (
        <div className={`w-full h-full grid place-items-center ${mut}`}>
          <ImageIcon className="w-12 h-12" />
        </div>
      )}
      {w.status === 'for_resale' && (
        <span className="absolute left-3 top-3 rounded-lg bg-black/60 px-2.5 py-0.5 text-xs font-bold text-orange-300 flex items-center gap-1">
          <Tag className="w-3.5 h-3.5" /> เปิดขายต่อ ฿{w.resalePrice?.toLocaleString()}
        </span>
      )}
      {at === 0 && <span className="absolute left-3.5 bottom-3 max-w-[65%] truncate rounded-[10px] bg-black/65 px-2.5 py-0.5">{w.title}</span>}
      {images.length > 1 && (
        <>
          <button onClick={() => go(-1)} className={`${arrow} left-2.5`} aria-label="รูปก่อนหน้า">
            <ChevronLeft className="w-5 h-5" />
          </button>
          <button onClick={() => go(1)} className={`${arrow} right-2.5`} aria-label="รูปถัดไป">
            <ChevronRight className="w-5 h-5" />
          </button>
        </>
      )}
      <span className="absolute right-3 bottom-3 rounded-[10px] bg-black/60 px-2.5 py-0.5 text-xs flex items-center gap-1.5">
        <ImageIcon className="w-3.5 h-3.5" /> {at + 1}/{Math.max(images.length, 1)}
      </span>
    </div>
  )
}

function ProfilePanel({ windowItem: w, profile, isOwner, currentUser, onLike, onToggleFollow, onShowFollowing, onSearch }: Props & { onSearch: (q: string) => void }) {
  const isFollowing = !!currentUser && !!w.followerIds?.includes(currentUser.id)
  const note = todaysNote(w)
  return (
    <div className={panel}>
      <div className="flex gap-3.5 items-start flex-wrap">
        <Avatar user={{ name: w.title, avatarUrl: profile.logoUrl }} className="w-[68px] h-[68px] border-[3px] border-[#FF4D94] bg-white text-2xl shrink-0" />
        <div className="flex-1 min-w-[180px]">
          <h1 className="text-2xl font-bold leading-snug break-words">{w.title}</h1>
          <div className={`${mut} text-[13px]`}>
            📍 {w.code}
            {w.province && ` · ${w.province}`} · 👤 {w.ownerName}
          </div>
          {profile.tags.length > 0 && (
            <div className="flex flex-wrap gap-1.5 mt-1.5">
              {profile.tags.map((tag) => (
                <button key={tag} onClick={() => onSearch(tag)} className={chip}>
                  {tag}
                </button>
              ))}
            </div>
          )}
        </div>
        {!isOwner && (
          <button onClick={() => onToggleFollow(w.id)} className={`${btn} ${isFollowing ? btnOn : ''} flex items-center gap-1.5`}>
            {isFollowing ? '✓ กำลังติดตาม' : <><Users className="w-4 h-4" /> ติดตาม</>}
          </button>
        )}
      </div>

      {isFollowing && (
        <div className={`mt-2.5 flex items-center justify-between gap-2 rounded-xl border ${LINE} bg-[#120a3a] px-3 py-2 text-[11.5px]`}>
          <span>✓ ติดตามบานนี้แล้ว · ดูรวมทุกภูมิภาคได้ที่ตัวกรอง «กำลังติดตาม»</span>
          <button onClick={onShowFollowing} className={`${linkText} shrink-0 font-semibold`}>
            ดูบานที่ติดตาม ›
          </button>
        </div>
      )}

      {w.description && <p className="mt-2.5 mx-1 text-[#dbe0f0] whitespace-pre-line">“{w.description}”</p>}

      {note && (
        <div className="mt-2.5 p-2.5 rounded-xl bg-emerald-950/30 border border-emerald-500/40 flex gap-2 items-start">
          <span className="w-2 h-2 mt-1.5 rounded-full bg-emerald-400 animate-pulse shrink-0" />
          <p className="text-xs">
            <span className="font-bold text-emerald-300">สเตตัสวันนี้: </span>
            {note}
          </p>
        </div>
      )}

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-y-2.5 pt-2.5">
        <Stat icon={<Eye className="w-4 h-4" />} label="ผู้เข้าชม" value={`${compact(w.viewsCount)} ครั้ง`} edge="always" />
        <button onClick={() => onLike(w.id)} className="text-left cursor-pointer hover:opacity-80" title="กดถูกใจ (วันละ 1 ครั้ง)">
          <Stat icon={<Heart className="w-4 h-4 text-[#FF4D94]" />} label="ถูกใจ" value={w.likesCount.toLocaleString()} />
        </button>
        <Stat icon={<Sparkles className="w-4 h-4 text-[#FF8A00]" />} label="วันนี้" value={`+${likesToday(w)}`} edge="phone" />
        <Stat icon={<Users className="w-4 h-4" />} label="ติดตาม" value={followerCount(w).toLocaleString()} />
      </div>
    </div>
  )
}

/** `edge` drops the divider on the first stat, or where the stats wrap to a new row on phones. */
function Stat({ icon, label, value, edge }: { icon: React.ReactNode; label: string; value: string; edge?: 'always' | 'phone' }) {
  return (
    <div className={`px-3 border-l ${LINE} ${edge === 'always' ? 'border-l-0' : edge === 'phone' ? 'max-sm:border-l-0' : ''}`}>
      {icon}
      <small className={`block ${mut} text-xs`}>{label}</small>
      <b className="text-[17px]">{value}</b>
    </div>
  )
}

function OfferingImage({ offering, className = '' }: { offering: WindowOffering; className?: string }) {
  return (
    <div className={`aspect-[4/3] rounded-xl overflow-hidden border ${LINE} bg-[#0d1538] ${className}`}>
      {offering.imageUrl ? (
        <img src={offering.imageUrl} alt={offering.name} className="w-full h-full object-cover" />
      ) : (
        <div className={`w-full h-full grid place-items-center ${mut}`}>
          <Package className="w-8 h-8" />
        </div>
      )}
    </div>
  )
}

function Offerings({ profile, canManage, onOpen, onAll, onEditProfile }: Props & { onOpen: (o: WindowOffering) => void; onAll: () => void; onEditProfile: () => void }) {
  if (!profile.offerings.length && !canManage) return null
  return (
    <div className={`${panel} !border-[#8B2CFF]`}>
      <div className="flex items-center justify-between gap-2 mb-2.5">
        <div>
          <h2 className="text-lg font-bold">✨ สิ่งที่นำเสนอ</h2>
          <span className={`${mut} text-[13px]`}>สินค้าและบริการ</span>
        </div>
        {profile.offerings.length > 4 && (
          <button onClick={onAll} className={linkText}>
            ดูทั้งหมด ›
          </button>
        )}
      </div>
      {profile.offerings.length ? (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
          {profile.offerings.slice(0, 4).map((o, i) => (
            <button key={i} onClick={() => onOpen(o)} className="text-left min-w-0 group cursor-pointer">
              <OfferingImage offering={o} className="mb-1.5 group-hover:border-[#FF4D94]" />
              <b className="block text-[13.5px] truncate">{o.name}</b>
              {o.note && <span className={`block ${mut} text-xs truncate`}>{o.note}</span>}
            </button>
          ))}
        </div>
      ) : (
        <button onClick={onEditProfile} className={`w-full rounded-xl border border-dashed ${LINE} py-6 ${mut} text-[13px] hover:text-white cursor-pointer`}>
          + เพิ่มสินค้า บริการ หรือผลงาน ในโปรไฟล์บาน
        </button>
      )}
    </div>
  )
}

function FriendAndCo({ windowItem: w, currentUser, isOwner, canManage, onOpenAuth, onOpenWindow, onWindowChanged, onNotify, onRequest, onPending }: Props & { onRequest: () => void; onPending: () => void }) {
  const links = w.links ?? []
  const pending = w.linkRequests ?? []
  const [busy, setBusy] = useState(false)
  const open = (link: WindowLink) => {
    const found = loadBoard(link.window.region).find((x) => x.id === link.window.id)
    if (found) onOpenWindow(found)
  }
  const remove = async (link: WindowLink) => {
    if (!window.confirm(`ยกเลิกลิงก์ ${link.window.title}? ต้องขออนุมัติใหม่หากต้องการกลับมา`)) return
    setBusy(true)
    const result = await removeLink(w.region, w.id, link.id)
    setBusy(false)
    if (!result.success) return onNotify(result.error, 'error')
    onWindowChanged()
    onNotify('ยกเลิกลิงก์แล้ว')
  }

  return (
    <div className={panel}>
      <div className="flex items-start justify-between gap-2 mb-2.5 flex-wrap">
        <div>
          <h2 className="text-lg font-bold">🤝 Friend and Co</h2>
          <span className={`${mut} text-[13px]`}>หน้าต่างพันธมิตรที่เจ้าของอนุญาตให้เชื่อมลิงก์</span>
        </div>
        <div className="flex gap-2 flex-wrap">
          {canManage && (
            <button onClick={onPending} className={btn}>
              📋 คำขอรออนุมัติ ({pending.length})
            </button>
          )}
          {!isOwner && (
            <button onClick={currentUser ? onRequest : onOpenAuth} className={btn}>
              ➕ ขอเชื่อมลิงก์
            </button>
          )}
        </div>
      </div>
      <div className="grid grid-cols-3 gap-1.5 sm:gap-2.5">
        {Array.from({ length: PROFILE_LIMITS.links }, (_, i) => {
          const link = links[i]
          if (!link)
            return (
              <div key={i} className={`rounded-xl border border-dashed ${LINE} min-h-[84px] sm:min-h-[100px] p-2 grid place-items-center text-center ${mut} text-[11.5px] sm:text-[13px]`}>
                {canManage ? 'ช่องว่าง · รอคำขอที่คุณอนุมัติ' : 'ช่องว่าง'}
              </div>
            )
          return (
            <div key={link.id} className={`rounded-xl border ${LINE} bg-[#0d1538] p-2 sm:p-2.5 min-w-0 flex flex-col gap-1 break-words`}>
              <div className="flex items-center gap-1.5 min-w-0">
                <Avatar user={{ name: link.window.title, avatarUrl: link.window.logoUrl || link.window.imageUrl }} className="w-7 h-7 shrink-0 hidden sm:flex" />
                <b className="text-[12.5px] sm:text-sm leading-tight line-clamp-2">{link.window.title}</b>
              </div>
              <span className={`${mut} text-[11px] sm:text-xs`}>{link.window.code}</span>
              <button onClick={() => open(link)} className={`${btn} mt-auto !px-1.5 !py-1 text-xs sm:text-[13px]`}>
                เยี่ยมชม ›
              </button>
              {canManage && (
                <button onClick={() => remove(link)} disabled={busy} className={`${linkText} text-left text-xs`}>
                  ยกเลิกลิงก์
                </button>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}

type TabId = 'details' | 'works' | 'reviews'

function MoreInfo(props: Props & { onOpenWork: (index: number) => void }) {
  const { windowItem: w, profile, onOpenWork } = props
  const [tab, setTab] = useState<TabId>(() => (hasDetails(profile) ? 'details' : w.reviewStats?.count ? 'reviews' : 'details'))
  const [open, setOpen] = useState(true)
  const tabs: { id: TabId; label: string }[] = [
    { id: 'details', label: 'รายละเอียดเพิ่มเติม' },
    { id: 'works', label: `ผลงานเพิ่มเติม${w.imageUpdateHistory.length ? ` (${w.imageUpdateHistory.length})` : ''}` },
    { id: 'reviews', label: `★ รีวิว${w.reviewStats?.count ? ` (${w.reviewStats.count})` : ''}` },
  ]
  return (
    <div className={panel}>
      <div className="flex gap-1.5 items-center">
        <div className="flex gap-1.5 overflow-x-auto">
          {tabs.map(({ id, label }) => (
            <button
              key={id}
              onClick={() => {
                setTab(id)
                setOpen(true)
              }}
              className={`px-3.5 py-1 rounded-[10px] whitespace-nowrap border cursor-pointer ${tab === id ? 'bg-[#1c1060] border-[#8B2CFF]' : `border-transparent ${mut} hover:text-white`}`}
            >
              {label}
            </button>
          ))}
        </div>
        <span className="flex-1" />
        <button onClick={() => setOpen(!open)} className="w-9 h-9 rounded-[10px] grid place-items-center hover:bg-white/10 cursor-pointer shrink-0" aria-label="ยุบ/ขยาย">
          {open ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
        </button>
      </div>
      {open && (
        <div className="mt-3">
          {tab === 'details' && <Details profile={profile} />}
          {tab === 'works' && <Works windowItem={w} onOpen={onOpenWork} />}
          {tab === 'reviews' && <Reviews {...props} />}
        </div>
      )}
    </div>
  )
}

function Details({ profile }: { profile: WindowProfile }) {
  if (!hasDetails(profile)) return <p className={`${mut} text-[13px] text-center py-4`}>เจ้าของบานยังไม่ได้เพิ่มรายละเอียด</p>
  return (
    <div className="grid sm:grid-cols-2 gap-4">
      {(profile.about || profile.serviceArea || profile.shipping) && (
        <div>
          <h4 className="font-bold mb-1">ℹ️ เกี่ยวกับเรา</h4>
          {profile.about && <p className={`${mut} text-[13px] whitespace-pre-line`}>{profile.about}</p>}
          {(profile.serviceArea || profile.shipping) && (
            <p className={`${mut} text-[13px] mt-2`}>
              {profile.serviceArea && <>📍 พื้นที่ให้บริการ: {profile.serviceArea}<br /></>}
              {profile.shipping && <>🚚 จัดส่ง: {profile.shipping}</>}
            </p>
          )}
        </div>
      )}
      {profile.highlights.length > 0 && (
        <div>
          <h4 className="font-bold mb-1">★ จุดเด่นของเรา</h4>
          <ul className="space-y-0.5">
            {profile.highlights.map((h) => (
              <li key={h} className="text-[13px] text-[#cfd5ea]">
                <span className="text-[#FF4D94]">✓ </span>
                {h}
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  )
}

/** Earlier window images with their captions. */
function Works({ windowItem: w, onOpen }: { windowItem: WindowItem; onOpen: (index: number) => void }) {
  if (!w.imageUpdateHistory.length) return <p className={`${mut} text-[13px] text-center py-4`}>ยังไม่มีผลงานก่อนหน้า</p>
  return (
    <div className="grid grid-cols-3 gap-2">
      {w.imageUpdateHistory.map((entry, i) => (
        <button key={i} onClick={() => onOpen(i)} className={`aspect-[4/3] rounded-xl overflow-hidden border ${LINE} hover:border-[#FF4D94] cursor-pointer`} title={entry.caption || 'อัปเดตรูปภาพ'}>
          <img src={entry.imageUrl} alt="" className="w-full h-full object-cover" />
        </button>
      ))}
    </div>
  )
}

function Stars({ value, onPick, size = 'w-4 h-4' }: { value: number; onPick?: (n: number) => void; size?: string }) {
  return (
    <span className="inline-flex gap-0.5">
      {[1, 2, 3, 4, 5].map((n) => {
        const icon = <Star className={`${size} ${n <= value ? 'text-amber-400 fill-amber-400' : 'text-stone-600'}`} />
        return onPick ? (
          <button key={n} type="button" onClick={() => onPick(n)} className="cursor-pointer hover:scale-110 transition-transform" aria-label={`${n} ดาว`}>
            {icon}
          </button>
        ) : (
          <span key={n}>{icon}</span>
        )
      })}
    </span>
  )
}

/** Runs a window action, then reloads the board and tells the user. */
function useRunner({ onWindowChanged, onNotify }: Pick<WindowDetailModalProps, 'onWindowChanged' | 'onNotify'>) {
  const [busy, setBusy] = useState(false)
  const run = async (action: () => Promise<{ success: true } | { success: false; error: string }>, done: string) => {
    setBusy(true)
    const result = await action()
    setBusy(false)
    if (!result.success) {
      onNotify(result.error || 'ทำรายการไม่สำเร็จ', 'error')
      return false
    }
    onWindowChanged()
    onNotify(done)
    return true
  }
  return { busy, run }
}

/** Admin moderation answers with the window but doesn't update the store: fetch it again. */
const thenRefetch = (w: WindowItem, action: () => Promise<{ success: true } | { success: false; error: string }>) => async () => {
  const result = await action()
  if (result.success) await fetchWindow(w.region, w.id)
  return result
}

function Reviews(props: Props) {
  const { windowItem: w, isOwner, currentUser, onOpenAuth } = props
  const reviews = w.reviews ?? []
  const mine = currentUser ? reviews.find((r) => r.userId === currentUser.id) : undefined
  const [rating, setRating] = useState(mine?.rating ?? 0)
  const [text, setText] = useState(mine?.text ?? '')
  const [editing, setEditing] = useState(!mine)
  const { busy, run } = useRunner(props)
  useEffect(() => {
    setRating(mine?.rating ?? 0)
    setText(mine?.text ?? '')
    setEditing(!mine)
  }, [mine?.id, mine?.rating, mine?.text])

  const submit = (e: React.FormEvent) => {
    e.preventDefault()
    if (!rating) return props.onNotify('กรุณาให้คะแนน 1–5 ดาว', 'error')
    run(() => saveReview(w.region, w.id, rating, text.trim()), mine ? 'แก้ไขรีวิวเรียบร้อยแล้ว' : 'ขอบคุณสำหรับรีวิว!')
  }
  const isAdmin = currentUser?.role === 'admin'

  return (
    <div className="space-y-2.5 text-[13px]">
      {w.reviewStats && w.reviewStats.count > 0 && (
        <b className="block">
          ⭐ {w.reviewStats.average.toFixed(1)} / 5 · {w.reviewStats.count} รีวิว
        </b>
      )}

      {!currentUser ? (
        <button onClick={onOpenAuth} className={`${btn} w-full`}>
          เข้าสู่ระบบเพื่อเขียนรีวิว
        </button>
      ) : isOwner ? null : editing ? (
        <form onSubmit={submit} className={`p-3 rounded-xl bg-[#0d1538] border ${LINE} space-y-2`}>
          <div className="flex items-center justify-between">
            <span className="font-medium">{mine ? 'แก้ไขรีวิวของคุณ' : 'ให้คะแนนบานนี้'}</span>
            <Stars value={rating} onPick={setRating} size="w-5 h-5" />
          </div>
          <textarea
            value={text}
            onChange={(e) => setText(e.target.value)}
            maxLength={PROFILE_LIMITS.reviewText}
            rows={2}
            placeholder="เล่าประสบการณ์ของคุณ (ไม่บังคับ)"
            className={`${field} resize-none`}
          />
          <div className="flex gap-2 justify-end">
            {mine && (
              <button type="button" onClick={() => setEditing(false)} className={btn}>
                ยกเลิก
              </button>
            )}
            <button type="submit" disabled={busy} className={`${btn} ${btnOn} font-bold`}>
              {mine ? 'บันทึกรีวิว' : 'ส่งรีวิว'}
            </button>
          </div>
        </form>
      ) : (
        <div className="flex gap-3 text-xs">
          <button onClick={() => setEditing(true)} className={`${linkText} flex items-center gap-1`}>
            <Pencil className="w-3 h-3" /> แก้ไขรีวิวของคุณ
          </button>
          <button
            onClick={() => window.confirm('ลบรีวิวของคุณ?') && run(() => deleteReview(w.region, w.id), 'ลบรีวิวแล้ว')}
            className={`${mut} hover:text-[#FF4D94] flex items-center gap-1 cursor-pointer`}
          >
            <Trash2 className="w-3 h-3" /> ลบ
          </button>
        </div>
      )}

      {reviews.length === 0 ? (
        <p className={`${mut} text-center py-3`}>ยังไม่มีรีวิว{isOwner ? '' : ' — เป็นคนแรกที่รีวิวบานนี้'}</p>
      ) : (
        <ul className="space-y-2">
          {reviews.map((r) => (
            <li key={r.id} className="border-l-2 border-[#FF4D94] pl-2.5 text-[#cfd5ea]">
              <div className="flex items-center gap-2 flex-wrap">
                <Avatar user={{ name: r.userName, avatarUrl: r.userAvatarUrl }} className="w-6 h-6 text-[10px]" />
                <span className="font-semibold text-white">{r.userName}</span>
                <Stars value={r.rating} size="w-3 h-3" />
                <span className={`text-[11px] ${mut}`}>{new Date(r.createdAt).toLocaleDateString('th-TH')}</span>
                {isAdmin && r.userId !== currentUser?.id && (
                  <button
                    onClick={() => window.confirm(`ลบรีวิวของ ${r.userName}? (บันทึกใน audit log)`) && run(thenRefetch(w, () => deleteReviewAsAdmin(r.id)), 'ลบรีวิวแล้ว')}
                    className={`ml-auto ${mut} hover:text-[#FF4D94] cursor-pointer`}
                    title="ลบรีวิว (ผู้ดูแลระบบ)"
                  >
                    <Trash2 className="w-3 h-3" />
                  </button>
                )}
              </div>
              {r.text && <p className="leading-relaxed whitespace-pre-line break-words mt-0.5">“{r.text}”</p>}
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}

function Updates(props: Props & { onWrite: (update: WindowUpdate | null) => void }) {
  const { windowItem: w, currentUser, canManage, onWrite } = props
  const updates = w.updates ?? []
  const { busy, run } = useRunner(props)
  const isAdmin = currentUser?.role === 'admin'
  return (
    <div className={panel}>
      <div className="flex items-start justify-between gap-2 mb-2.5">
        <div>
          <h2 className="text-lg font-bold">📣 อัปเดตประจำวัน</h2>
          <span className={`${mut} text-[13px]`}>ข่าวสารและกิจกรรมล่าสุดจากเจ้าของบาน</span>
        </div>
        {canManage && (
          <button onClick={() => onWrite(null)} className={`${btn} ${btnOn} shrink-0`}>
            ✍️ เขียนอัปเดต
          </button>
        )}
      </div>
      {updates.length === 0 ? (
        <p className={`${mut} text-[13px]`}>ยังไม่มีอัปเดต</p>
      ) : (
        <div className="max-h-[340px] overflow-auto space-y-2 pr-1">
          {updates.map((u) => (
            <div key={u.id} className="border-l-2 border-[#FF4D94] bg-[#0d1538] rounded-r-[10px] px-2.5 py-1.5">
              <time className={`${mut} text-xs`}>
                {thaiDateTime(u.createdAt)}
                {u.editedAt && ' (แก้ไขแล้ว)'}
              </time>
              <p className="whitespace-pre-wrap break-words">{u.text}</p>
              {(canManage || isAdmin) && (
                <div className="flex gap-3 mt-1 text-[12.5px]">
                  {canManage && (
                    <button onClick={() => onWrite(u)} className={linkText}>
                      แก้ไข
                    </button>
                  )}
                  <button
                    disabled={busy}
                    onClick={() => {
                      if (!window.confirm(canManage ? 'ลบอัปเดตนี้? ลบแล้วกู้คืนไม่ได้' : 'ลบอัปเดตนี้? (ผู้ดูแลระบบ · บันทึกใน audit log)')) return
                      run(canManage ? () => deleteUpdate(w.region, w.id, u.id) : thenRefetch(w, () => deleteUpdateAsAdmin(u.id)), 'ลบแล้ว')
                    }}
                    className={linkText}
                  >
                    ลบ
                  </button>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

/** "Contact the owner" (LINE first, else jump to the contact list) and "Share". */
function ContactButtons({ profile, onShare }: { profile: WindowProfile; onShare: () => void }) {
  const line = lineUrl(profile.lineId)
  const contact = () => {
    if (line) window.open(line, '_blank', 'noopener')
    else document.getElementById('window-contacts')?.scrollIntoView({ behavior: 'smooth', block: 'center' })
  }
  const cta = 'flex items-center gap-2.5 p-3.5 rounded-2xl text-left min-w-0 cursor-pointer'
  return (
    <div className={`grid gap-2.5 ${hasContacts(profile) ? 'sm:grid-cols-[1.5fr_1fr]' : ''}`}>
      {hasContacts(profile) && (
        <button onClick={contact} className={`${cta} ${grad} font-bold shadow-[0_4px_18px_#ff4d9455] hover:opacity-95`}>
          <span className="text-2xl">💬</span>
          <span className="min-w-0">
            ติดต่อเจ้าของหน้าต่าง
            <small className="block font-normal text-xs opacity-90">พูดคุย สอบถาม หรือสร้างโอกาสร่วมกัน</small>
          </span>
          <ChevronRight className="w-5 h-5 ml-auto shrink-0" />
        </button>
      )}
      <button onClick={onShare} className={`${cta} bg-[#03091A] border border-[#6427FF] hover:bg-[#120a3a]`}>
        <Share2 className="w-6 h-6 shrink-0" />
        <span className="min-w-0 font-bold">
          แชร์หน้าต่าง
          <small className="block font-normal text-xs opacity-90">ให้คนอื่นได้พบเห็น</small>
        </span>
      </button>
    </div>
  )
}

function ContactPanel({ profile }: { profile: WindowProfile }) {
  const line = lineUrl(profile.lineId)
  const contacts = [
    profile.phone && { icon: Phone, label: 'เบอร์โทร', value: profile.phone, href: telHref(profile.phone), action: 'โทรเลย' },
    profile.lineId && { icon: MessageCircle, label: 'LINE', value: profile.lineId, href: line, action: 'แชท' },
    profile.email && { icon: Mail, label: 'อีเมล', value: profile.email, href: `mailto:${profile.email}`, action: 'ส่งอีเมล' },
    profile.website && { icon: Globe, label: 'เว็บไซต์', value: profile.website.replace(/^https:\/\/(www\.)?/, '').replace(/\/$/, ''), href: profile.website, action: 'เยี่ยมชม' },
  ].filter(Boolean) as { icon: typeof Phone; label: string; value: string; href: string; action: string }[]

  return (
    <div id="window-contacts" className={`${panel} grid gap-3 ${line ? 'xl:grid-cols-[1fr_150px]' : ''}`}>
      <div>
        {contacts.map(({ icon: Icon, label, value, href, action }) => (
          <div key={label} className={`flex items-center gap-2.5 py-2 border-b ${LINE} last:border-b-0`}>
            <span className={`w-9 h-9 rounded-full border ${LINE} grid place-items-center shrink-0`}>
              <Icon className="w-4 h-4" />
            </span>
            <div className="flex-1 min-w-0 text-[13px] break-words">
              <small className={`block ${mut}`}>{label}</small>
              {value}
            </div>
            <a href={href} target={href.startsWith('http') ? '_blank' : undefined} rel="noreferrer" className={`${btn} !px-3 !py-0.5 !rounded-[10px] text-[12.5px] shrink-0`}>
              {action}
            </a>
          </div>
        ))}
      </div>
      {line && <LineQr url={line} />}
    </div>
  )
}

function LineQr({ url }: { url: string }) {
  const [src, setSrc] = useState('')
  useEffect(() => {
    let live = true
    QRCode.toDataURL(url, { margin: 1, width: 220, errorCorrectionLevel: 'M' })
      .then((data) => live && setSrc(data))
      .catch(() => live && setSrc(''))
    return () => {
      live = false
    }
  }, [url])
  if (!src) return null
  return (
    <a href={url} target="_blank" rel="noreferrer" className={`rounded-xl border ${LINE} p-2.5 text-center text-xs flex xl:flex-col items-center justify-center gap-3 xl:gap-2`}>
      <b>สแกนเพื่อเพิ่มเพื่อน</b>
      <img src={src} alt="QR LINE" className="w-[140px] xl:w-full rounded-lg bg-white p-1.5" />
    </a>
  )
}

const SOCIAL_STYLE: Record<SocialKey, { className: string; glyph: React.ReactNode }> = {
  facebook: { className: 'bg-[#1877f2]', glyph: 'f' },
  instagram: { className: 'bg-gradient-to-tr from-[#f9a03f] via-[#e1306c] to-[#833ab4]', glyph: 'IG' },
  tiktok: { className: 'bg-[#111] border border-[#444]', glyph: '♪' },
  youtube: { className: 'bg-[#ff0000]', glyph: '▶' },
}

function Socials({ windowItem: w, profile }: { windowItem: WindowItem; profile: WindowProfile }) {
  const round = 'w-10 h-10 rounded-full grid place-items-center font-bold text-[13px] hover:scale-110 transition-transform'
  return (
    <div className={panel}>
      <b>🔗 ช่องทางอื่น ๆ</b>
      <div className="flex gap-2.5 mt-2 flex-wrap">
        {SOCIALS.filter((s) => profile[s.key]).map((s) => (
          <a key={s.key} href={profile[s.key]} target="_blank" rel="noreferrer" title={s.label} aria-label={s.label} className={`${round} ${SOCIAL_STYLE[s.key].className}`}>
            {SOCIAL_STYLE[s.key].glyph}
          </a>
        ))}
        {profile.website && (
          <a href={profile.website} target="_blank" rel="noreferrer" title="เว็บไซต์" aria-label="เว็บไซต์" className={`${round} bg-[#1c1060] border ${LINE}`}>
            <Globe className="w-4 h-4" />
          </a>
        )}
        {w.externalLink && w.externalLink !== profile.website && (
          <a href={w.externalLink} target="_blank" rel="noreferrer" title={w.externalLink} className={`${round} bg-[#1c1060] border ${LINE}`}>
            <ExternalLink className="w-4 h-4" />
          </a>
        )}
      </div>
    </div>
  )
}

function Categories({ windowItem: w, profile, onSearch }: { windowItem: WindowItem; profile: WindowProfile; onSearch: (q: string) => void }) {
  const category = CATEGORIES[w.category]
  return (
    <div className={panel}>
      <b>🏷 หมวดหมู่</b>
      <div className="flex flex-wrap gap-1.5 mt-1.5">
        {category && (
          <button onClick={() => onSearch(category.label)} className={chip}>
            {category.icon} {category.label}
          </button>
        )}
        {profile.tags.map((tag) => (
          <button key={tag} onClick={() => onSearch(tag)} className={chip}>
            #{tag}
          </button>
        ))}
      </div>
    </div>
  )
}

function ResaleBanner({ windowItem: w }: { windowItem: WindowItem }) {
  return (
    <div className="p-3 rounded-2xl bg-[#2a1a00] border border-[#FF8A00] flex items-center justify-between gap-3">
      <div>
        <span className="text-[11px] font-bold text-[#FF8A00] block">🏷️ หน้าต่างนี้เปิดขายต่อ (Resale)</span>
        <span className="text-xs text-[#ffd9a0]">รับช่วงต่อสิทธิ์หน้าต่างนี้ได้</span>
      </div>
      <span className="text-base font-bold font-mono text-orange-300 shrink-0">฿{w.resalePrice?.toLocaleString()}</span>
    </div>
  )
}

function QuotaReached({ message }: { message: string }) {
  return (
    <div className={`p-3 rounded-xl bg-[#120a3a] border ${LINE} text-center space-y-1`}>
      <span className="text-[#FF4D94] font-bold text-xs block">⚠️ {message}</span>
      <span className={`text-[11px] ${mut}`}>(โควตาผู้ใช้ 1 คน อ้างอิงเลขบัตรประชาชน: ไทย 1 บาน + ภูมิภาค 1 บาน)</span>
    </div>
  )
}

// ---------------------------------------------------------------- dialogs

function Dialog({ title, onClose, children }: { title: React.ReactNode; onClose: () => void; children: React.ReactNode }) {
  return (
    <div className="fixed inset-0 z-[60] bg-black/70 grid place-items-center p-4" onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div className="bg-[#0A1330] border border-[#6427FF] rounded-[20px] p-5 w-full max-w-[480px] max-h-[90vh] overflow-auto">
        <h3 className="text-lg font-bold mb-2.5">{title}</h3>
        {children}
        <p className="text-right mt-3">
          <button onClick={onClose} className={btn}>
            ปิด
          </button>
        </p>
      </div>
    </div>
  )
}

function DialogView(props: Props & { dialog: DialogState; onDialog: (d: DialogState | null) => void }) {
  const { windowItem: w, profile, dialog, onDialog } = props
  const close = () => onDialog(null)
  switch (dialog.kind) {
    case 'search':
      return <SearchDialog {...props} initial={dialog.query} onClose={close} />
    case 'share':
      return <ShareDialog windowItem={w} onClose={close} onNotify={props.onNotify} />
    case 'offering':
      return (
        <Dialog title={dialog.offering.name} onClose={close}>
          <OfferingImage offering={dialog.offering} className="mb-2" />
          {dialog.offering.note && <p>{dialog.offering.note}</p>}
          <p className={`${mut} text-[13px] mt-1`}>สอบถามราคาและรายละเอียดได้ที่เจ้าของหน้าต่าง</p>
        </Dialog>
      )
    case 'offerings':
      return (
        <Dialog title="สินค้าและบริการทั้งหมด" onClose={close}>
          <div className="space-y-1">
            {profile.offerings.map((o, i) => (
              <button key={i} onClick={() => onDialog({ kind: 'offering', offering: o })} className="w-full flex items-center gap-3 p-2 rounded-lg hover:bg-white/5 text-left cursor-pointer">
                <OfferingImage offering={o} className="w-16 shrink-0" />
                <span className="min-w-0">
                  <b className="block truncate">{o.name}</b>
                  <span className={`${mut} text-[13px]`}>{o.note}</span>
                </span>
              </button>
            ))}
          </div>
        </Dialog>
      )
    case 'work': {
      const entry = w.imageUpdateHistory[dialog.index]
      if (!entry) return null
      return (
        <Dialog title={entry.caption || 'อัปเดตรูปภาพ'} onClose={close}>
          <img src={entry.imageUrl} alt="" className="w-full rounded-xl" />
          <p className={`${mut} text-[13px] mt-2 flex items-center gap-1`}>
            <Calendar className="w-3.5 h-3.5" /> {new Date(entry.date).toLocaleDateString('th-TH')}
          </p>
        </Dialog>
      )
    }
    case 'update':
      return <UpdateDialog {...props} update={dialog.update} onClose={close} />
    case 'linkRequest':
      return <LinkRequestDialog {...props} onClose={close} />
    case 'linkPending':
      return <LinkPendingDialog {...props} onClose={close} />
  }
}

/** Searches every window loaded on the boards by name, code, category, province or owner. */
function SearchDialog({ initial, onClose, onOpenWindow }: Props & { initial: string; onClose: () => void }) {
  const [query, setQuery] = useState(initial)
  const all = useMemo(() => REGION_IDS.flatMap((r) => loadBoard(r)).filter((x) => x.status !== 'available'), [])
  const q = query.trim().toLowerCase()
  const results = all
    .filter((x) => !q || [x.title, x.description, x.code, x.province, x.ownerName, CATEGORIES[x.category]?.label].join(' ').toLowerCase().includes(q))
    .slice(0, 30)
  return (
    <Dialog title="🔍 ค้นหาหน้าต่าง" onClose={onClose}>
      <input autoFocus value={query} onChange={(e) => setQuery(e.target.value)} placeholder="ชื่อ รหัส หรือหมวดหมู่" className={`${field} mb-2`} />
      {results.length ? (
        results.map((x) => (
          <button key={`${x.region}-${x.id}`} onClick={() => onOpenWindow(x)} className="w-full text-left p-2 rounded-lg hover:bg-white/5 cursor-pointer">
            <b>{x.title}</b>{' '}
            <span className={`${mut} text-[13px]`}>
              {x.code} · {CATEGORIES[x.category]?.label}
            </span>
          </button>
        ))
      ) : (
        <p className={`${mut} text-[13px]`}>ไม่พบผลลัพธ์</p>
      )}
    </Dialog>
  )
}

function ShareDialog({ windowItem: w, onClose, onNotify }: { windowItem: WindowItem; onClose: () => void; onNotify: Props['onNotify'] }) {
  const url = windowUrl(w)
  const copy = async () => {
    if (await copyToClipboard(url)) onNotify('คัดลอกลิงก์แล้ว')
    else onNotify('คัดลอกอัตโนมัติไม่ได้ กรุณาคัดลอกจากช่องลิงก์', 'error')
  }
  return (
    <Dialog title="⤴ แชร์หน้าต่าง" onClose={onClose}>
      <input readOnly value={url} onFocus={(e) => e.target.select()} className={`${field} mb-2`} />
      <p className="flex gap-2 flex-wrap">
        <button onClick={copy} className={btn}>
          คัดลอกลิงก์
        </button>
        {'share' in navigator && (
          <button onClick={() => navigator.share({ title: `${w.title} ${w.code}`, url }).catch(() => {})} className={btn}>
            แชร์ไปแอปอื่น
          </button>
        )}
      </p>
    </Dialog>
  )
}

function UpdateDialog(props: Props & { update: WindowUpdate | null; onClose: () => void }) {
  const { windowItem: w, update, onClose } = props
  const [text, setText] = useState(update?.text ?? '')
  const { busy, run } = useRunner(props)
  const save = async () => {
    const value = text.trim()
    if (!value) return props.onNotify('กรุณาพิมพ์ข้อความ', 'error')
    const ok = await run(() => (update ? editUpdate(w.region, w.id, update.id, value) : postUpdate(w.region, w.id, value)), update ? 'บันทึกแล้ว' : 'โพสต์แล้ว')
    if (ok) onClose()
  }
  return (
    <Dialog title={update ? '✏️ แก้ไขอัปเดต' : '✍️ เขียนอัปเดตใหม่'} onClose={onClose}>
      <textarea autoFocus rows={5} maxLength={PROFILE_LIMITS.updateText} value={text} onChange={(e) => setText(e.target.value)} className={`${field} resize-y`} />
      <p className={`${mut} text-xs mt-1`}>
        {text.length}/{PROFILE_LIMITS.updateText} ตัวอักษร · ผู้เยี่ยมชมทุกคนเห็นอัปเดตนี้
      </p>
      <p className="mt-2">
        <button onClick={save} disabled={busy} className={`${btn} ${btnOn}`}>
          {update ? 'บันทึก' : 'โพสต์'}
        </button>
      </p>
    </Dialog>
  )
}

const LINK_STATUS: Record<WindowLink['status'], string> = {
  pending: 'กำลังรอเจ้าของหน้าต่างอนุมัติ',
  approved: 'เชื่อมลิงก์แล้ว',
  rejected: 'ไม่ได้รับการอนุมัติ (ส่งคำขอใหม่ได้)',
}

function LinkRequestDialog(props: Props & { onClose: () => void }) {
  const { windowItem: w, currentUser, onClose } = props
  const mine = useMemo(
    () => (currentUser ? REGION_IDS.flatMap((r) => loadBoard(r)).filter((x) => x.ownerId === currentUser.id && !(x.region === w.region && x.id === w.id)) : []),
    [currentUser, w.region, w.id],
  )
  const [pick, setPick] = useState(mine[0] ? `${mine[0].region}:${mine[0].id}` : '')
  const [message, setMessage] = useState('')
  const { busy, run } = useRunner(props)
  const requests = w.myLinkRequests ?? []
  const send = async () => {
    const from = mine.find((x) => `${x.region}:${x.id}` === pick)
    if (!from) return
    const ok = await run(() => requestLink(w.region, w.id, { region: from.region, id: from.id }, message.trim()), 'ส่งคำขอแล้ว รอเจ้าของหน้าต่างอนุมัติ')
    if (ok) onClose()
  }
  return (
    <Dialog title="➕ ขอเชื่อมลิงก์หน้าต่างของคุณ" onClose={onClose}>
      {requests.map((r) => (
        <div key={r.id} className="bg-[#2a1a00] border border-[#FF8A00] text-[#ffd9a0] rounded-[10px] px-3 py-1.5 text-xs mb-2.5">
          คำขอของคุณ ({r.window.title}) {LINK_STATUS[r.status]}
        </div>
      ))}
      {mine.length === 0 ? (
        <p className={`${mut} text-[13px]`}>ต้องเป็นเจ้าของหน้าต่างอย่างน้อย 1 บานจึงจะขอเชื่อมลิงก์ได้</p>
      ) : (
        <>
          <label className={`block ${mut} text-xs mb-1`}>หน้าต่างของคุณที่จะแสดงใน Friend and Co</label>
          <select value={pick} onChange={(e) => setPick(e.target.value)} className={`${field} mb-2`}>
            {mine.map((x) => (
              <option key={`${x.region}:${x.id}`} value={`${x.region}:${x.id}`}>
                {x.code} · {x.title}
              </option>
            ))}
          </select>
          <textarea
            rows={3}
            maxLength={PROFILE_LIMITS.linkMessage}
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            placeholder="ข้อความถึงเจ้าของหน้าต่าง (ไม่บังคับ)"
            className={`${field} resize-none`}
          />
          <p className={`${mut} text-xs mt-1`}>ลิงก์จะแสดงเมื่อเจ้าของหน้าต่างอนุมัติแล้วเท่านั้น ส่งซ้ำจะแทนที่ข้อความเดิม</p>
          <p className="mt-2">
            <button onClick={send} disabled={busy || !pick} className={`${btn} ${btnOn}`}>
              ส่งคำขอ
            </button>
          </p>
        </>
      )}
    </Dialog>
  )
}

function LinkPendingDialog(props: Props & { onClose: () => void }) {
  const { windowItem: w, onClose, onOpenWindow } = props
  const requests = w.linkRequests ?? []
  const { busy, run } = useRunner(props)
  const view = (link: WindowLink) => {
    const found = loadBoard(link.window.region).find((x) => x.id === link.window.id)
    if (found) onOpenWindow(found)
  }
  return (
    <Dialog title="📋 คำขอเชื่อมลิงก์" onClose={onClose}>
      <p className={`${mut} text-[13px] mb-2`}>
        ตรวจสอบหน้าต่างให้แน่ใจก่อนอนุมัติ · แสดงได้ {PROFILE_LIMITS.links} ช่อง (ใช้ไป {w.links?.length ?? 0})
      </p>
      {requests.length === 0 ? (
        <p className={`${mut} text-[13px]`}>ไม่มีคำขอรออนุมัติ</p>
      ) : (
        requests.map((r) => (
          <div key={r.id} className={`p-2.5 rounded-lg border ${LINE} mb-2`}>
            <b>{r.window.title}</b>
            <div className={`${mut} text-[13px]`}>
              {r.window.code} · ผู้ขอ: {r.requesterName}
            </div>
            {r.message && <p className="text-[13px] mt-1 whitespace-pre-line break-words">“{r.message}”</p>}
            <div className="flex gap-2 mt-2 flex-wrap">
              <button disabled={busy} onClick={() => run(() => decideLink(w.region, w.id, r.id, true), 'อนุมัติแล้ว')} className={`${btn} ${btnOn}`}>
                อนุมัติ
              </button>
              <button disabled={busy} onClick={() => run(() => decideLink(w.region, w.id, r.id, false), 'ปฏิเสธคำขอแล้ว')} className={btn}>
                ปฏิเสธ
              </button>
              <button onClick={() => view(r)} className={`${linkText} text-[13px] ml-auto`}>
                ดูหน้าต่าง ›
              </button>
            </div>
          </div>
        ))
      )}
    </Dialog>
  )
}

// ---------------------------------------------------------------- owner studio

/** Owner-only panel: private details, daily edit, resale listing. */
function OwnerStudio({
  windowItem: w,
  currentUser,
  onOpenEditor,
  onListForResale,
  onCancelResale,
  onSimulatePass24Hours,
  onSimulateHolding,
  onOpenKyc,
  onEditProfile,
}: WindowDetailModalProps & { windowItem: WindowItem; onEditProfile: () => void }) {
  const [showCitizenId, setShowCitizenId] = useState(false)
  const [showPhone, setShowPhone] = useState(false)
  const [resaleFormOpen, setResaleFormOpen] = useState(false)
  useEffect(() => {
    setShowCitizenId(false)
    setShowPhone(false)
  }, [w.id])

  const { editPolicy } = useSettings()
  const rules = useRules()
  const edit = getEditStatus(w, editPolicy)
  const holding = getHoldingPeriod(w, rules.minHoldingDays)
  const isForResale = w.status === 'for_resale'
  const citizenId = w.ownerCitizenId || currentUser?.citizenId
  const contact = w.ownerContact || currentUser?.phone
  const box = `p-3.5 rounded-xl bg-[#0A1330] border ${LINE} text-xs`

  return (
    <div className="space-y-3">
      <div className={`${box} space-y-1`}>
        <div className="flex items-center justify-between text-[#FF4D94] font-bold">
          <span className="flex items-center gap-1.5">
            <Lock className="w-3.5 h-3.5" />
            <span>โหมดข้อมูลส่วนตัว (เฉพาะคุณในฐานะเจ้าของบาน)</span>
          </span>
          <span className="text-[10px] px-1.5 rounded bg-emerald-950 text-emerald-300 border border-emerald-500/40 font-mono">Verified Owner</span>
        </div>
        <p className={`text-[11px] ${mut} leading-relaxed`}>
          ข้อมูลส่วนนี้เข้ารหัสและแสดงผลให้ <strong className="text-white">คุณ ({currentUser?.name})</strong> มองเห็นคนเดียวเท่านั้น
          บุคคลทั่วไปจะไม่สามารถดูเลขบัตร ปชช. หรือเบอร์ติดต่อจริงของคุณได้
        </p>
      </div>

      <div className={`${box} space-y-2`}>
        <SecretRow
          label="เลขบัตรประชาชนผู้ถือครอง:"
          visible={showCitizenId}
          onToggle={() => setShowCitizenId(!showCitizenId)}
          fullValue={citizenId || '-'}
          maskedValue={maskCitizenId(citizenId)}
          showTitle="แสดงเลขบัตรเต็ม"
          hideTitle="ซ่อนเลขบัตร"
        />
        <SecretRow
          label="เบอร์โทรศัพท์ติดต่อส่วนตัว:"
          visible={showPhone}
          onToggle={() => setShowPhone(!showPhone)}
          fullValue={contact || '-'}
          maskedValue={maskPhone(contact)}
          showTitle="แสดงเบอร์เต็ม"
          hideTitle="ซ่อนเบอร์โทร"
        />
        {w.claimedAt && (
          <div className="flex items-center justify-between">
            <span className={mut}>ครอบครองสิทธิ์เมื่อ:</span>
            <span className="font-mono">{new Date(w.claimedAt).toLocaleString('th-TH')}</span>
          </div>
        )}
        <div className="flex items-center justify-between">
          <span className={mut}>ต้นทุนสิทธิ์บานแรกเข้า:</span>
          <span className="font-mono text-emerald-400 font-bold">{w.claimPrice ? `${w.claimPrice.toLocaleString()} ฿` : rules.claimPriceLabel} (ตลอดชีพ)</span>
        </div>
      </div>

      {isForResale && w.resalePrice && (
        <div className={`${box} space-y-2 !border-[#FF4D94]/50`}>
          <div className="flex items-center justify-between text-[#FF4D94] font-bold">
            <span>💰 ประมาณการรายได้จากการขายต่อบานนี้:</span>
            <span className="font-mono text-[10px] px-1.5 py-0.5 rounded bg-[#120a3a]">หักค่าคอม {rules.commissionLabel}</span>
          </div>
          <div className="space-y-1 font-mono text-[11px]">
            <div className={`flex justify-between ${mut}`}>
              <span>ราคาขายต่อที่ตั้งไว้:</span>
              <span className="text-white font-bold">฿{w.resalePrice.toLocaleString()}</span>
            </div>
            <div className="flex justify-between text-[#FF4D94]">
              <span>ค่าคอมมิชชั่นระบบ ({rules.commissionLabel}):</span>
              <span>-฿{commissionOf(w.resalePrice).toLocaleString()}</span>
            </div>
            <div className={`flex justify-between text-emerald-300 font-bold pt-1 border-t ${LINE} text-xs`}>
              <span>ยอดเงินโอนเข้ากระเป๋าคุณสุทธิ ({rules.sellerLabel}):</span>
              <span>฿{(w.resalePrice - commissionOf(w.resalePrice)).toLocaleString()}</span>
            </div>
          </div>
        </div>
      )}

      <div className={`${box} space-y-2 !border-[#8B2CFF]`}>
        <div className="flex items-center gap-1.5 font-medium">
          <Store className="w-4 h-4 text-[#c79bff]" />
          <span>โปรไฟล์บาน (โลโก้ สินค้า ช่องทางติดต่อ รายละเอียด)</span>
        </div>
        <p className={`text-[11px] ${mut}`}>ข้อมูลที่ผู้เยี่ยมชมเห็นในหน้านี้ · แก้ไขได้ฟรีไม่จำกัด ไม่นับรวมสิทธิ์แก้ไขรายวัน</p>
        <button onClick={onEditProfile} className={`${btn} w-full flex items-center justify-center gap-2 font-semibold`}>
          <Pencil className="w-4 h-4" />
          <span>แก้ไขโปรไฟล์บาน</span>
        </button>
      </div>

      <div className={`${box} space-y-2.5`}>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-1.5 font-medium">
            <Calendar className="w-4 h-4 text-[#FF4D94]" />
            <span>สิทธิ์แก้ไขรูปภาพและข้อความ</span>
          </div>
          <span className={`text-[10px] ${mut} font-mono`}>(ฟรี {editPolicy.freeEditsPerDay} ครั้ง / วัน)</span>
        </div>
        {!edit.paid ? (
          <div className="flex items-center gap-2 p-2 rounded-lg bg-emerald-950/40 border border-emerald-800/40 text-emerald-300">
            <span className="text-[11px] leading-tight">
              ✓ แก้ไขฟรีได้อีก <strong className="font-mono">{edit.freeLeft}</strong> ครั้งในวันนี้
            </span>
          </div>
        ) : (
          <div className={`flex items-center gap-2 p-2 rounded-lg bg-[#120a3a] border ${LINE} text-[#ffb3d0]`}>
            <Clock className="w-4 h-4 shrink-0" />
            <span className="text-[11px] leading-tight">
              {edit.canEdit ? (
                <>
                  ใช้สิทธิ์ฟรีวันนี้ครบแล้ว แก้ไขเพิ่มได้ครั้งละ <strong className="font-mono text-amber-200">฿{edit.price.toLocaleString()}</strong> (หักจากกระเป๋า) ·{' '}
                </>
              ) : (
                'ใช้สิทธิ์แก้ไขของวันนี้ครบแล้ว · '
              )}
              สิทธิ์ฟรีกลับมาในอีก{' '}
              <strong className="font-mono">
                {edit.resetsIn.hours} ชม. {edit.resetsIn.minutes} นาที
              </strong>
            </span>
          </div>
        )}
        <button
          onClick={() => onOpenEditor(w)}
          disabled={!edit.canEdit}
          className={`${btn} ${edit.canEdit ? btnOn : ''} w-full py-2.5 flex items-center justify-center gap-2 font-semibold`}
        >
          <Camera className="w-4 h-4" />
          <span>แก้ไขรูปภาพ / ข้อความบานของคุณ</span>
        </button>
        {edit.paid && isDemo() && (
          <button
            onClick={() => onSimulatePass24Hours(w.id)}
            className={`w-full py-1.5 text-[10px] ${mut} hover:text-[#FF4D94] border border-dashed ${LINE} rounded-lg flex items-center justify-center gap-1.5 cursor-pointer`}
            title="คืนสิทธิ์แก้ไขฟรีของวันนี้เพื่อทดสอบระบบแก้ไข"
          >
            <FastForward className="w-3 h-3" />
            <span>ทดสอบ: คืนสิทธิ์แก้ไขฟรีของวันนี้</span>
          </button>
        )}
      </div>

      <div className="space-y-2">
        {!holding.isEligible && (
          <div className={`${box} space-y-1.5`}>
            <div className="flex items-center gap-1.5 font-bold text-[#FF4D94]">
              <Clock className="w-4 h-4 shrink-0" />
              <span>เงื่อนไขข้อ 1: ต้องถือครองไม่ต่ำกว่า {rules.minHoldingDays} วัน</span>
            </div>
            <p className={`text-[11px] leading-relaxed ${mut}`}>
              ปัจจุบันคุณถือครองมาแล้ว <strong className="font-mono text-white">{holding.daysHeld} วัน</strong> (ขาดอีก{' '}
              <strong className="font-mono text-white">{holding.daysRemaining} วัน</strong> จึงจะเปิดขายต่อได้)
            </p>
            <button type="button" onClick={() => onSimulateHolding(w.id, 35)} className={`text-[10px] ${linkText} underline flex items-center gap-1 font-mono`}>
              <FastForward className="w-3 h-3" />
              <span>[ทดสอบระบบ] เร่งเวลาจำลองถือครองครบ 35 วัน เพื่อปลดล็อกสิทธิ์ขายต่อ</span>
            </button>
          </div>
        )}

        {resaleFormOpen ? (
          <ResaleForm
            windowItem={w}
            isEligible={holding.isEligible}
            onCancel={() => setResaleFormOpen(false)}
            onSubmit={(price) => {
              onListForResale(w, price)
              setResaleFormOpen(false)
            }}
          />
        ) : isForResale ? (
          <button onClick={() => onCancelResale(w)} className={`${btn} w-full text-[#FF4D94] text-xs`}>
            ยกเลิกการเปิดขายต่อ
          </button>
        ) : (
          <button
            onClick={() => {
              if (!currentUser?.isVerified) {
                onOpenKyc()
                return
              }
              setResaleFormOpen(true)
            }}
            className={`${btn} w-full py-2.5 text-xs font-semibold text-[#ffb3d0] flex items-center justify-center gap-1.5`}
          >
            <Tag className="w-3.5 h-3.5" />
            <span>{holding.isEligible ? 'ตั้งราคาเปิดขายต่อให้ผู้อื่น' : `เปิดขายต่อ (ถือครอง ${holding.daysHeld}/${rules.minHoldingDays} วัน)`}</span>
          </button>
        )}
      </div>
    </div>
  )
}

function SecretRow(props: {
  label: string
  visible: boolean
  onToggle: () => void
  fullValue: string
  maskedValue: string
  showTitle: string
  hideTitle: string
}) {
  return (
    <div className="flex items-center justify-between">
      <span className={mut}>{props.label}</span>
      <div className="flex items-center gap-1.5 font-mono">
        <span>{props.visible ? props.fullValue : props.maskedValue}</span>
        <button type="button" onClick={props.onToggle} className={`p-1 ${mut} hover:text-white cursor-pointer`} title={props.visible ? props.hideTitle : props.showTitle}>
          {props.visible ? <EyeOff className="w-3.5 h-3.5 text-[#FF4D94]" /> : <Eye className="w-3.5 h-3.5" />}
        </button>
      </div>
    </div>
  )
}

function ResaleForm({
  windowItem,
  isEligible,
  onCancel,
  onSubmit,
}: {
  windowItem: WindowItem
  isEligible: boolean
  onCancel: () => void
  onSubmit: (price: number) => void
}) {
  const rules = useRules()
  const [priceInput, setPriceInput] = useState('1500')
  const cap = getPriceCap(windowItem)
  const price = parseFloat(priceInput) || 0
  const overCap = cap.maxAllowedPrice !== null && price > cap.maxAllowedPrice

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault()
        if (!isEligible) {
          alert(`ตามเงื่อนไขข้อ 1: เจ้าของจะต้องถือครองหน้าต่างบานนี้ไม่ต่ำกว่า ${rules.minHoldingDays} วัน จึงจะสามารถขายต่อได้`)
          return
        }
        const value = parseInt(priceInput, 10)
        if (isNaN(value) || value < rules.minResalePrice) return
        if (cap.maxAllowedPrice !== null && value > cap.maxAllowedPrice) {
          alert(`ไม่สามารถตั้งราคาเกิน ${cap.maxAllowedPrice.toLocaleString()} ฿ ได้ (${cap.ruleDescription})`)
          return
        }
        onSubmit(value)
      }}
      className="p-3.5 bg-[#0A1330] rounded-xl border border-[#FF4D94]/50 space-y-3 text-xs"
    >
      <div className="flex items-center justify-between">
        <span className="font-bold flex items-center gap-1">
          <Tag className="w-3.5 h-3.5 text-[#FF4D94]" />
          <span>ตั้งราคาขายต่อ (ตามกติกากำหนดเพดานราคา)</span>
        </span>
        <button type="button" onClick={onCancel} className={`${mut} hover:text-white text-[11px] cursor-pointer`}>
          ยกเลิก
        </button>
      </div>

      <div className={`p-2.5 rounded-lg bg-[#050c24] border ${LINE} space-y-1.5 font-mono`}>
        <div className="flex items-center justify-between text-[#FF4D94] font-sans font-bold">
          <span>เพดานราคาตามเงื่อนไข:</span>
          <span className="text-[10px] px-1.5 py-0.5 rounded bg-[#FF4D94]/20">{cap.tierLabel}</span>
        </div>
        <div className="text-[11px] space-y-1">
          <div className="flex justify-between">
            <span className={mut}>ราคาตั้งต้น:</span>
            <span>฿{cap.basePrice.toLocaleString()}</span>
          </div>
          <div className="flex justify-between">
            <span className={mut}>เพดานสูงสุด:</span>
            <span className="text-[#FF4D94] font-bold">{cap.maxAllowedPrice === null ? 'ตามความต้องการของตลาด' : `ไม่เกิน ฿${cap.maxAllowedPrice.toLocaleString()}`}</span>
          </div>
        </div>
      </div>

      <div>
        <label className={`block ${mut} text-[11px] font-medium mb-1`}>ระบุราคาขายต่อ (บาท):</label>
        <div className="flex items-center gap-2">
          <span className="font-mono text-[#FF4D94] font-bold text-sm">฿</span>
          <input
            type="number"
            min={rules.minResalePrice}
            max={cap.maxAllowedPrice || undefined}
            step="50"
            value={priceInput}
            onChange={(e) => setPriceInput(e.target.value)}
            className={`${field} !p-1.5 !text-xs font-mono`}
            required
          />
        </div>
      </div>

      {price > 0 && !overCap && (
        <div className={`p-2.5 rounded-lg bg-[#050c24] border ${LINE} text-[11px] space-y-1 font-mono`}>
          <div className="flex justify-between text-[#FF4D94] font-sans font-medium">
            <span>เงื่อนไขระบบหักค่าคอมมิชชั่น:</span>
            <span className="font-bold">{rules.commissionLabel}</span>
          </div>
          <div className={`flex justify-between ${mut}`}>
            <span>• ค่าคอมมิชชั่นเข้าระบบ ({rules.commissionLabel}):</span>
            <span className="text-[#FF4D94] font-bold">฿{commissionOf(price).toLocaleString()}</span>
          </div>
          <div className="flex justify-between font-medium">
            <span>• คุณจะได้รับเงินสุทธิ ({rules.sellerLabel}):</span>
            <span className="text-emerald-400 font-bold">฿{(price - commissionOf(price)).toLocaleString()}</span>
          </div>
        </div>
      )}

      <button type="submit" disabled={overCap || price < rules.minResalePrice || !isEligible} className={`${btn} ${btnOn} w-full py-2.5 font-semibold`}>
        ยืนยันเปิดขายต่อบานนี้
      </button>
    </form>
  )
}
