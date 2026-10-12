import { useEffect, useState } from 'react'
import {
  BarChart3,
  Calendar,
  Camera,
  Check,
  ChevronLeft,
  ChevronRight,
  Clock,
  ExternalLink,
  Eye,
  EyeOff,
  FastForward,
  Globe,
  Heart,
  Image as ImageIcon,
  Link2,
  Lock,
  Mail,
  MapPin,
  MessageCircle,
  MessagesSquare,
  Package,
  Pencil,
  Phone,
  Share2,
  ShoppingBag,
  Sparkles,
  Star,
  Store,
  Tag,
  Trash2,
  Truck,
  UserRound,
  Users,
  X,
} from 'lucide-react'
import QRCode from 'qrcode'
import type { Quota, User, WindowItem, WindowProfile } from '@shared/types'
import { REGIONS_BY_ID } from '@shared/regions'
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
import { deleteReview, isDemo, saveReview } from '@/lib/store'
import { deleteReviewAsAdmin } from '@/lib/adminApi'
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
  /** The window changed in the store (profile or reviews saved): reload the board. */
  onWindowChanged: () => void
  onNotify: (message: string, kind?: ToastKind) => void
}

const card = 'rounded-2xl bg-[#0d0a16] border border-purple-900/40'
const cta =
  'rounded-2xl bg-gradient-to-r from-orange-500 via-rose-500 to-purple-600 text-white hover:opacity-95 transition-all cursor-pointer shadow-lg shadow-rose-500/20'

export function WindowDetailModal(props: WindowDetailModalProps) {
  const { windowItem, currentUser, quota, onClose, onClaim, onBuyResale, onOpenKyc } = props
  const rules = useRules()
  const [linkCopied, setLinkCopied] = useState(false)
  const [ownerView, setOwnerView] = useState<'manage' | 'preview'>('manage')
  const [editingProfile, setEditingProfile] = useState(false)
  const isOwner = !!currentUser && !!windowItem && windowItem.ownerId === currentUser.id

  useEffect(() => {
    setOwnerView('manage')
    setEditingProfile(false)
  }, [windowItem?.id, isOwner])

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

  const canAcquireHere = isThailand ? quota.canAcquireThailand : quota.canAcquireRegional
  const quotaMessage = isThailand
    ? `คุณมีหน้าต่างบานประเทศไทยครบ 1 บานแล้ว (${quota.thailandWindow?.code}) ไม่สามารถจับจองเพิ่มได้`
    : `คุณมีหน้าต่างบานภูมิภาคครบ 1 บานแล้ว (${quota.regionalWindow?.code}) ไม่สามารถจับจองเพิ่มได้`

  const shareLink = async () => {
    const url = `${window.location.href.split('#')[0]}#window-${w.region}-${w.id}`
    if (navigator.share && window.matchMedia('(pointer: coarse)').matches) {
      try {
        await navigator.share({ title: w.title, url })
        return
      } catch {
        // Cancelled or not allowed: fall back to copying.
      }
    }
    if (await copyToClipboard(url)) {
      setLinkCopied(true)
      setTimeout(() => setLinkCopied(false), 2500)
    } else {
      window.prompt('คัดลอกลิงก์นี้', url)
    }
  }

  /** Runs `action` unless the signed-in user still has to complete KYC. */
  const requireKyc = (action: () => void) => () => {
    if (currentUser && !currentUser.isVerified) {
      onOpenKyc()
      return
    }
    action()
  }

  const purchaseBar = (
    <>
      {isAvailable &&
        (!canAcquireHere && currentUser ? (
          <QuotaReached message={quotaMessage} />
        ) : (
          <button onClick={requireKyc(() => onClaim(w))} className={`w-full py-3 px-4 text-sm font-bold flex items-center justify-center gap-2 ${cta}`}>
            <Sparkles className="w-4 h-4" />
            <span>จับจองเป็นเจ้าของบานนี้ ({rules.claimPriceLabel})</span>
          </button>
        ))}
      {isForResale &&
        !isOwner &&
        (!canAcquireHere && currentUser ? (
          <QuotaReached message={quotaMessage} />
        ) : (
          <button onClick={requireKyc(() => onBuyResale(w))} className={`w-full py-3 px-4 text-sm font-bold flex items-center justify-center gap-2 ${cta}`}>
            <ShoppingBag className="w-4 h-4" />
            <span>ซื้อต่อหน้าต่างนี้ในราคา ฿{w.resalePrice?.toLocaleString()}</span>
          </button>
        ))}
    </>
  )

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-2 sm:p-4 bg-black/85 backdrop-blur-sm overflow-y-auto font-['Plus_Jakarta_Sans','Prompt',sans-serif]">
      <div
        className="relative w-full max-w-6xl bg-[#0a0812] border border-purple-700/40 rounded-2xl sm:rounded-3xl shadow-2xl shadow-purple-900/30 overflow-hidden my-auto max-h-[94vh] flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between gap-2 px-3 sm:px-5 py-3 bg-[#09080e] border-b border-purple-900/30">
          <div className="flex items-center gap-2 sm:gap-3 flex-wrap min-w-0">
            <span className="w-8 h-8 rounded-full bg-gradient-to-br from-orange-500 via-rose-500 to-purple-600 p-[2px] shrink-0">
              <span className="w-full h-full rounded-full bg-[#120f1e] flex items-center justify-center text-sm">{region?.icon}</span>
            </span>
            <span className="font-['Outfit',sans-serif] font-bold text-lg sm:text-xl bg-gradient-to-r from-orange-400 via-rose-400 to-purple-400 bg-clip-text text-transparent">
              {code}
            </span>
            <span
              className="px-2.5 py-1 text-xs border border-purple-500/50 text-purple-200 rounded-lg font-['Prompt',sans-serif]"
              title="ตำแหน่งจัดวางบนหน้าต่างในรอบปัจจุบัน"
            >
              ตำแหน่ง #{w.slotPosition || w.id}
            </span>
            {region && (
              <span className="hidden sm:inline-flex px-2.5 py-1 text-xs border border-purple-500/50 rounded-lg text-stone-200 font-['Prompt',sans-serif]">
                {region.name}
              </span>
            )}
            <span className="hidden md:flex items-center gap-1.5 pl-3 border-l border-stone-800 text-sm text-stone-300 font-['Prompt',sans-serif]">
              <span>{category?.icon}</span>
              <span>{category?.label}</span>
              {w.province && <span className="text-stone-500">· {w.province}</span>}
            </span>
          </div>
          <div className="flex items-center gap-1 shrink-0">
            <button
              onClick={shareLink}
              className="px-2 py-1.5 text-stone-300 hover:text-rose-300 rounded-lg transition-colors cursor-pointer text-sm flex items-center gap-1.5 font-['Prompt',sans-serif]"
              title="แชร์ลิงก์บานนี้"
            >
              <Share2 className="w-4 h-4" />
              <span className="hidden sm:inline">{linkCopied ? 'คัดลอกแล้ว!' : 'แชร์'}</span>
            </button>
            <button onClick={onClose} className="p-1.5 text-stone-400 hover:text-stone-100 rounded-lg transition-colors cursor-pointer" aria-label="ปิด">
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        <div className="overflow-y-auto p-3 sm:p-5 flex-1">
          {(highlightText || stars > 0 || isOwner) && (
            <div className="flex flex-wrap items-center gap-2 mb-3 font-['Prompt',sans-serif]">
              {highlightText && (
                <span
                  className={`px-3 py-1 text-sm rounded-xl font-bold border flex items-center gap-1.5 ${highlight === 'hot' ? 'bg-orange-500/15 text-orange-300 border-orange-500/60' : highlight === 'fresh' ? 'bg-rose-500/15 text-rose-200 border-rose-500/70' : 'bg-emerald-500/15 text-emerald-300 border-emerald-500/60'}`}
                >
                  {highlight === 'hot' ? '🔥' : highlight === 'fresh' ? <Sparkles className="w-4 h-4 text-amber-300" /> : '🟢'} {highlightText}
                </span>
              )}
              {stars > 0 && (
                <span className="px-2.5 py-1 text-xs rounded-xl font-bold border bg-purple-500/15 text-purple-300 border-purple-500/50 flex items-center gap-1">
                  <span className="text-rose-400">⭐</span>
                  {STAR_LABELS[stars as 1 | 2 | 3]}
                </span>
              )}
              {isOwner && <span className="px-2.5 py-1 text-xs bg-purple-950 text-purple-300 border border-purple-600/70 rounded-xl font-bold">บานของฉัน</span>}
            </div>
          )}

          {isAvailable ? (
            <div className="grid grid-cols-1 md:grid-cols-12 gap-5">
              <div className="md:col-span-7">
                <AvailableImage />
              </div>
              <div className="md:col-span-5 flex flex-col justify-between gap-4">
                <div>
                  <h2 className="text-xl sm:text-2xl font-bold text-stone-100 leading-snug">{w.title}</h2>
                  <p className="mt-2 text-sm text-stone-300 leading-relaxed font-light">{w.description}</p>
                </div>
                {purchaseBar}
              </div>
            </div>
          ) : (
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 lg:gap-5">
              <div className="lg:col-span-7 space-y-4 min-w-0">
                <Gallery windowItem={w} profile={profile} />
                <ProfileHeader {...props} windowItem={w} profile={profile} isOwner={isOwner} />
                <Offerings profile={profile} />
                <InfoTabs {...props} windowItem={w} profile={profile} isOwner={isOwner} />
              </div>

              <div className="lg:col-span-5 space-y-4 min-w-0">
                {isOwner && (
                  <div className="flex items-center gap-1.5 p-1 bg-[#09080e] rounded-xl border border-purple-900/30 text-xs font-['Prompt',sans-serif]">
                    <button
                      type="button"
                      onClick={() => setOwnerView('manage')}
                      className={`flex-1 py-2 px-3 rounded-lg font-semibold flex items-center justify-center gap-1.5 transition-all cursor-pointer ${ownerView === 'manage' ? 'bg-gradient-to-r from-orange-500 via-rose-500 to-purple-600 text-white shadow-sm' : 'text-stone-400 hover:text-stone-200'}`}
                    >
                      <Lock className="w-3.5 h-3.5 text-rose-200" />
                      <span>🛠️ สตูดิโอจัดการบาน</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => setOwnerView('preview')}
                      className={`flex-1 py-2 px-3 rounded-lg font-semibold flex items-center justify-center gap-1.5 transition-all cursor-pointer ${ownerView === 'preview' ? 'bg-gradient-to-r from-purple-600 via-rose-500 to-orange-500 text-white shadow-sm' : 'text-stone-400 hover:text-stone-200'}`}
                    >
                      <Globe className="w-3.5 h-3.5" />
                      <span>👀 มุมมองผู้เยี่ยมชม</span>
                    </button>
                  </div>
                )}
                {isOwner && ownerView === 'manage' ? (
                  <OwnerStudio {...props} windowItem={w} onEditProfile={() => setEditingProfile(true)} />
                ) : (
                  <ContactColumn windowItem={w} profile={profile} linkCopied={linkCopied} onShare={shareLink} />
                )}
                {(isForResale || (!isOwner && !isForResale)) && (
                  <div className="space-y-2">
                    {isForResale && <ResaleBanner windowItem={w} />}
                    {purchaseBar}
                    {!isForResale && !isOwner && (
                      <div className="text-center py-2 text-xs text-stone-500 font-['Prompt',sans-serif]">หน้าต่างนี้มีเจ้าของแล้ว และไม่ได้เปิดขายต่อในขณะนี้</div>
                    )}
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      </div>

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
    <div className="relative aspect-[4/3] rounded-2xl overflow-hidden bg-stone-950 border-2 border-stone-800 shadow-inner flex items-center justify-center">
      <div className="text-center p-8">
        <div className="w-16 h-16 rounded-full bg-[#181326] border border-dashed border-rose-500/40 flex items-center justify-center mx-auto mb-3 text-rose-400">
          <Sparkles className="w-8 h-8" />
        </div>
        <h3 className="text-lg font-bold text-stone-200">บานหน้าต่างนี้พร้อมให้คุณเป็นเจ้าของ</h3>
        <p className="text-xs text-stone-400 mt-1 max-w-sm mx-auto leading-relaxed font-light">
          จับจองเพื่อลงรูปภาพส่วนตัว ธุรกิจ หรือเรื่องราวแห่งความทรงจำของคุณ {editPolicyLabel(editPolicy)}
          และขายต่อได้ทุกเวลา (โควตาผู้ใช้: ไทย 1 บาน + ภูมิภาค 1 บาน)
        </p>
      </div>
    </div>
  )
}

/** Main window image followed by the owner's extra photos. */
function Gallery({ windowItem: w, profile }: { windowItem: WindowItem; profile: WindowProfile }) {
  const images = [w.imageUrl, ...profile.gallery].filter(Boolean)
  const [index, setIndex] = useState(0)
  useEffect(() => setIndex(0), [w.id, w.region, images.length])
  const current = images[Math.min(index, images.length - 1)]
  const go = (step: number) => setIndex((i) => (i + step + images.length) % images.length)

  return (
    <div className="relative aspect-[16/9] rounded-2xl overflow-hidden bg-stone-950 border border-purple-900/40 group">
      {current ? <img src={current} alt={w.title} className="w-full h-full object-cover" /> : <div className="w-full h-full flex items-center justify-center text-stone-600"><ImageIcon className="w-10 h-10" /></div>}
      <div className="absolute inset-0 pointer-events-none shadow-[inset_0_0_20px_rgba(0,0,0,0.5)]" />
      {w.status === 'for_resale' && (
        <div className="absolute top-3 left-3 bg-[#0c0a12]/90 border border-orange-500/80 px-3 py-1 rounded-lg text-xs font-mono font-bold text-orange-300 flex items-center gap-1.5">
          <Tag className="w-3.5 h-3.5 text-orange-400" />
          <span>เปิดขายต่อ: ฿{w.resalePrice?.toLocaleString()}</span>
        </div>
      )}
      {images.length > 1 && (
        <>
          <button onClick={() => go(-1)} className="absolute left-2 top-1/2 -translate-y-1/2 p-1.5 rounded-full bg-black/55 text-white sm:opacity-0 group-hover:opacity-100 transition-opacity cursor-pointer" aria-label="รูปก่อนหน้า">
            <ChevronLeft className="w-5 h-5" />
          </button>
          <button onClick={() => go(1)} className="absolute right-2 top-1/2 -translate-y-1/2 p-1.5 rounded-full bg-black/55 text-white sm:opacity-0 group-hover:opacity-100 transition-opacity cursor-pointer" aria-label="รูปถัดไป">
            <ChevronRight className="w-5 h-5" />
          </button>
        </>
      )}
      <span className="absolute bottom-3 right-3 px-2.5 py-1 rounded-lg bg-black/65 text-white text-xs flex items-center gap-1.5 font-mono">
        <ImageIcon className="w-3.5 h-3.5" /> {Math.min(index, images.length - 1) + 1}/{Math.max(images.length, 1)}
      </span>
    </div>
  )
}

function ProfileHeader({
  windowItem: w,
  profile,
  isOwner,
  currentUser,
  onLike,
  onToggleFollow,
  onShowFollowing,
}: WindowDetailModalProps & { windowItem: WindowItem; profile: WindowProfile; isOwner: boolean }) {
  const isFollowing = !!currentUser && !!w.followerIds?.includes(currentUser.id)
  const note = todaysNote(w)
  const quote = w.description
  return (
    <div className="space-y-3 font-['Prompt',sans-serif]">
      <div className="flex items-start gap-3 sm:gap-4">
        <span className="w-16 h-16 sm:w-20 sm:h-20 rounded-full bg-gradient-to-br from-orange-400 via-rose-500 to-purple-600 p-[3px] shrink-0">
          <Avatar user={{ name: w.title, avatarUrl: profile.logoUrl }} className="w-full h-full bg-white border-2 border-[#0a0812]" />
        </span>
        <div className="flex-1 min-w-0 space-y-1.5">
          <div className="flex items-start justify-between gap-2">
            <h2 className="text-xl sm:text-2xl font-bold text-stone-50 leading-snug break-words">{w.title}</h2>
            {!isOwner && (
              <button
                onClick={() => onToggleFollow(w.id)}
                className={`shrink-0 px-3 sm:px-4 py-1.5 rounded-xl text-sm font-semibold flex items-center gap-1.5 transition-all cursor-pointer border ${isFollowing ? 'bg-purple-950 text-purple-200 border-purple-500/60' : 'border-purple-400/60 text-stone-100 hover:bg-purple-900/40'}`}
              >
                <Users className="w-4 h-4" />
                <span>{isFollowing ? 'กำลังติดตาม' : 'ติดตาม'}</span>
              </button>
            )}
          </div>
          <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-stone-400">
            <span className="flex items-center gap-1"><MapPin className="w-3.5 h-3.5 text-rose-400" />{w.code}</span>
            {w.province && <span>· {w.province}</span>}
            <span className="flex items-center gap-1">· <UserRound className="w-3.5 h-3.5" />{w.ownerName}</span>
          </div>
          {profile.tags.length > 0 && (
            <div className="flex flex-wrap gap-1.5 pt-0.5">
              {profile.tags.map((tag) => (
                <span key={tag} className="px-2.5 py-0.5 rounded-full border border-purple-500/50 text-purple-100 text-xs">{tag}</span>
              ))}
            </div>
          )}
        </div>
      </div>

      {isFollowing && (
        <div className="flex items-center justify-between gap-2 px-3 py-2 rounded-xl bg-purple-950/60 border border-purple-500/40 text-[11px] text-purple-200">
          <span>✓ ติดตามบานนี้แล้ว · ดูรวมทุกภูมิภาคได้ที่ตัวกรอง «กำลังติดตาม»</span>
          <button onClick={onShowFollowing} className="shrink-0 px-3 py-1 rounded-lg text-xs font-semibold bg-purple-700 text-white hover:bg-purple-600 cursor-pointer">
            ดูบานที่ติดตาม
          </button>
        </div>
      )}

      {quote && <p className="text-sm text-stone-200 leading-relaxed whitespace-pre-line">“{quote}”</p>}

      {note && (
        <div className="p-3 rounded-xl bg-emerald-950/30 border border-emerald-500/40 flex gap-2 items-start">
          <span className="w-2 h-2 mt-1.5 rounded-full bg-emerald-400 animate-pulse shrink-0" />
          <p className="text-xs text-stone-200"><span className="font-bold text-emerald-300">สเตตัสวันนี้: </span>{note}</p>
        </div>
      )}

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-y-3 py-3 border-y border-purple-900/40">
        <Stat icon={<Eye className="w-5 h-5 text-rose-400" />} label="ผู้เข้าชม" value={`${compact(w.viewsCount)} ครั้ง`} />
        <button onClick={() => onLike(w.id)} className="text-left cursor-pointer hover:opacity-80" title="กดถูกใจ (วันละ 1 ครั้ง)">
          <Stat icon={<Heart className="w-5 h-5 text-rose-400 fill-rose-500/20" />} label="ถูกใจ" value={w.likesCount.toLocaleString()} />
        </button>
        <Stat icon={<Sparkles className="w-5 h-5 text-purple-400" />} label="วันนี้" value={`+${likesToday(w)}`} />
        <Stat icon={<Users className="w-5 h-5 text-purple-400" />} label="ติดตาม" value={followerCount(w).toLocaleString()} />
      </div>
    </div>
  )
}

const compact = (n: number) => (n >= 1000 ? `${(n / 1000).toFixed(n >= 10000 ? 0 : 1).replace(/\.0$/, '')}K` : n.toLocaleString())

function Stat({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
  return (
    <div className="flex items-center gap-2.5 px-2 sm:border-r last:border-r-0 border-purple-900/40">
      {icon}
      <div className="leading-tight">
        <div className="text-[11px] text-stone-400">{label}</div>
        <div className="text-sm text-stone-100 font-semibold">{value}</div>
      </div>
    </div>
  )
}

function Offerings({ profile }: { profile: WindowProfile }) {
  const [all, setAll] = useState(false)
  if (!profile.offerings.length) return null
  const shown = all ? profile.offerings : profile.offerings.slice(0, 4)
  return (
    <div className={`${card} p-3 sm:p-4 space-y-3 font-['Prompt',sans-serif] bg-gradient-to-br from-purple-950/40 to-[#0d0a16]`}>
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2.5">
          <Sparkles className="w-6 h-6 text-amber-300" />
          <div className="leading-tight">
            <h3 className="font-bold text-stone-100">สิ่งที่นำเสนอ</h3>
            <p className="text-xs text-stone-400">สินค้าและบริการ</p>
          </div>
        </div>
        {profile.offerings.length > 4 && (
          <button onClick={() => setAll(!all)} className="text-xs text-purple-300 hover:text-purple-200 flex items-center gap-0.5 cursor-pointer">
            {all ? 'ย่อ' : 'ดูทั้งหมด'} <ChevronRight className={`w-3.5 h-3.5 transition-transform ${all ? '-rotate-90' : ''}`} />
          </button>
        )}
      </div>
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
        {shown.map((o, i) => (
          <div key={i} className="space-y-1.5 min-w-0">
            <div className="aspect-[4/3] rounded-xl overflow-hidden bg-stone-900 border border-stone-800">
              {o.imageUrl ? <img src={o.imageUrl} alt={o.name} className="w-full h-full object-cover" /> : <div className="w-full h-full flex items-center justify-center text-stone-600"><Package className="w-7 h-7" /></div>}
            </div>
            <div className="leading-tight">
              <div className="text-sm text-stone-100 font-medium truncate">{o.name}</div>
              {o.note && <div className="text-[11px] text-stone-400 truncate">{o.note}</div>}
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

type TabId = 'details' | 'works' | 'reviews'

function InfoTabs(props: WindowDetailModalProps & { windowItem: WindowItem; profile: WindowProfile; isOwner: boolean }) {
  const { windowItem: w, profile } = props
  const [tab, setTab] = useState<TabId>(() => (hasDetails(profile) ? 'details' : 'reviews'))
  const tabs: { id: TabId; label: string; icon: typeof Store }[] = [
    { id: 'details', label: 'รายละเอียดเพิ่มเติม', icon: Store },
    { id: 'works', label: `ผลงานเพิ่มเติม${w.imageUpdateHistory.length ? ` (${w.imageUpdateHistory.length})` : ''}`, icon: Camera },
    { id: 'reviews', label: `รีวิว${w.reviewStats?.count ? ` (${w.reviewStats.count})` : ''}`, icon: Star },
  ]
  return (
    <div className={`${card} overflow-hidden font-['Prompt',sans-serif]`}>
      <div className="flex gap-1.5 p-2 border-b border-purple-900/40 overflow-x-auto">
        {tabs.map(({ id, label, icon: Icon }) => (
          <button
            key={id}
            onClick={() => setTab(id)}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1.5 whitespace-nowrap cursor-pointer transition-colors ${tab === id ? 'bg-purple-600/80 text-white' : 'text-stone-400 hover:text-stone-200 border border-purple-900/50'}`}
          >
            <Icon className="w-3.5 h-3.5" /> {label}
          </button>
        ))}
      </div>
      <div className="p-3 sm:p-4">
        {tab === 'details' && <Details profile={profile} />}
        {tab === 'works' && <Works windowItem={w} />}
        {tab === 'reviews' && <Reviews {...props} />}
      </div>
    </div>
  )
}

function Details({ profile }: { profile: WindowProfile }) {
  if (!hasDetails(profile)) return <p className="text-xs text-stone-500 text-center py-4">เจ้าของบานยังไม่ได้เพิ่มรายละเอียด</p>
  return (
    <div className="space-y-3 text-xs">
      <div className="grid sm:grid-cols-2 gap-4">
        {profile.about && (
          <div className="flex gap-2.5">
            <UserRound className="w-4 h-4 text-purple-400 shrink-0 mt-0.5" />
            <div>
              <div className="font-bold text-stone-200 mb-0.5">เกี่ยวกับเรา</div>
              <p className="text-stone-400 leading-relaxed whitespace-pre-line">{profile.about}</p>
            </div>
          </div>
        )}
        {profile.highlights.length > 0 && (
          <div className="flex gap-2.5 sm:border-l sm:pl-4 border-purple-900/40">
            <Star className="w-4 h-4 text-stone-200 fill-stone-200 shrink-0 mt-0.5" />
            <div>
              <div className="font-bold text-stone-200 mb-1">จุดเด่นของเรา</div>
              <ul className="space-y-1">
                {profile.highlights.map((h) => (
                  <li key={h} className="flex gap-1.5 text-stone-400">
                    <Check className="w-3.5 h-3.5 text-stone-300 shrink-0" /> {h}
                  </li>
                ))}
              </ul>
            </div>
          </div>
        )}
      </div>
      {(profile.serviceArea || profile.shipping) && (
        <div className="flex flex-wrap gap-x-6 gap-y-1.5 pt-2 border-t border-purple-900/30 text-stone-400">
          {profile.serviceArea && <span className="flex items-center gap-1.5"><MapPin className="w-3.5 h-3.5 text-purple-400" />พื้นที่ให้บริการ: {profile.serviceArea}</span>}
          {profile.shipping && <span className="flex items-center gap-1.5"><Truck className="w-3.5 h-3.5 text-purple-400" />จัดส่ง: {profile.shipping}</span>}
        </div>
      )}
    </div>
  )
}

/** Earlier window images with their captions. */
function Works({ windowItem: w }: { windowItem: WindowItem }) {
  if (!w.imageUpdateHistory.length) return <p className="text-xs text-stone-500 text-center py-4">ยังไม่มีผลงานก่อนหน้า</p>
  return (
    <div className="grid grid-cols-3 sm:grid-cols-4 gap-2">
      {w.imageUpdateHistory.map((entry, i) => (
        <a key={i} href={entry.imageUrl} target="_blank" rel="noreferrer" className="space-y-1 group">
          <div className="aspect-square rounded-lg overflow-hidden border border-stone-800">
            <img src={entry.imageUrl} alt="" className="w-full h-full object-cover group-hover:scale-105 transition-transform" />
          </div>
          <div className="text-[10px] text-stone-400 truncate">{entry.caption || 'อัปเดตรูปภาพ'}</div>
          <div className="text-[10px] text-stone-600 flex items-center gap-1"><Calendar className="w-3 h-3" />{new Date(entry.date).toLocaleDateString('th-TH')}</div>
        </a>
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

function Reviews({ windowItem: w, isOwner, currentUser, onOpenAuth, onWindowChanged, onNotify }: WindowDetailModalProps & { windowItem: WindowItem; isOwner: boolean }) {
  const reviews = w.reviews ?? []
  const mine = currentUser ? reviews.find((r) => r.userId === currentUser.id) : undefined
  const [rating, setRating] = useState(mine?.rating ?? 0)
  const [text, setText] = useState(mine?.text ?? '')
  const [editing, setEditing] = useState(!mine)
  const [busy, setBusy] = useState(false)
  useEffect(() => {
    setRating(mine?.rating ?? 0)
    setText(mine?.text ?? '')
    setEditing(!mine)
  }, [mine?.id, mine?.rating, mine?.text])

  const run = async (action: () => Promise<{ success: boolean; error?: string }>, done: string) => {
    setBusy(true)
    const result = await action()
    setBusy(false)
    if (!result.success) return onNotify(result.error || 'ทำรายการไม่สำเร็จ', 'error')
    onWindowChanged()
    onNotify(done)
  }
  const submit = (e: React.FormEvent) => {
    e.preventDefault()
    if (!rating) return onNotify('กรุณาให้คะแนน 1–5 ดาว', 'error')
    run(() => saveReview(w.region, w.id, rating, text.trim()), mine ? 'แก้ไขรีวิวเรียบร้อยแล้ว' : 'ขอบคุณสำหรับรีวิว!')
  }
  const isAdmin = currentUser?.role === 'admin'

  return (
    <div className="space-y-3 text-xs">
      {w.reviewStats && w.reviewStats.count > 0 && (
        <div className="flex items-center gap-2">
          <span className="text-2xl font-bold text-stone-100">{w.reviewStats.average.toFixed(1)}</span>
          <Stars value={Math.round(w.reviewStats.average)} />
          <span className="text-stone-400">จาก {w.reviewStats.count} รีวิว</span>
        </div>
      )}

      {!currentUser ? (
        <button onClick={onOpenAuth} className="w-full py-2 rounded-lg border border-purple-700/60 text-purple-200 hover:bg-purple-950/50 cursor-pointer">
          เข้าสู่ระบบเพื่อเขียนรีวิว
        </button>
      ) : isOwner ? null : editing ? (
        <form onSubmit={submit} className="p-3 rounded-xl bg-stone-950/60 border border-stone-800 space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-stone-300 font-medium">{mine ? 'แก้ไขรีวิวของคุณ' : 'ให้คะแนนบานนี้'}</span>
            <Stars value={rating} onPick={setRating} size="w-5 h-5" />
          </div>
          <textarea
            value={text}
            onChange={(e) => setText(e.target.value)}
            maxLength={PROFILE_LIMITS.reviewText}
            rows={2}
            placeholder="เล่าประสบการณ์ของคุณ (ไม่บังคับ)"
            className="w-full bg-stone-950 border border-stone-700 text-stone-100 rounded-lg focus:outline-none focus:border-rose-400 text-xs px-3 py-2 resize-none"
          />
          <div className="flex gap-2 justify-end">
            {mine && (
              <button type="button" onClick={() => setEditing(false)} className="px-3 py-1.5 rounded-lg bg-stone-800 text-stone-300 cursor-pointer">
                ยกเลิก
              </button>
            )}
            <button type="submit" disabled={busy} className="px-4 py-1.5 rounded-lg bg-gradient-to-r from-orange-500 to-rose-500 text-white font-bold cursor-pointer disabled:opacity-60">
              {mine ? 'บันทึกรีวิว' : 'ส่งรีวิว'}
            </button>
          </div>
        </form>
      ) : (
        <div className="flex gap-3 text-[11px]">
          <button onClick={() => setEditing(true)} className="text-purple-300 hover:text-purple-200 flex items-center gap-1 cursor-pointer">
            <Pencil className="w-3 h-3" /> แก้ไขรีวิวของคุณ
          </button>
          <button
            onClick={() => window.confirm('ลบรีวิวของคุณ?') && run(() => deleteReview(w.region, w.id), 'ลบรีวิวแล้ว')}
            className="text-stone-500 hover:text-rose-400 flex items-center gap-1 cursor-pointer"
          >
            <Trash2 className="w-3 h-3" /> ลบ
          </button>
        </div>
      )}

      {reviews.length === 0 ? (
        <p className="text-stone-500 text-center py-3">ยังไม่มีรีวิว{isOwner ? '' : ' — เป็นคนแรกที่รีวิวบานนี้'}</p>
      ) : (
        <ul className="space-y-2.5">
          {reviews.map((r) => (
            <li key={r.id} className="flex gap-2.5">
              <Avatar user={{ name: r.userName, avatarUrl: r.userAvatarUrl }} className="w-8 h-8" />
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="font-semibold text-stone-200">{r.userName}</span>
                  <Stars value={r.rating} size="w-3 h-3" />
                  <span className="text-[10px] text-stone-500">{new Date(r.createdAt).toLocaleDateString('th-TH')}</span>
                  {isAdmin && r.userId !== currentUser?.id && (
                    <button
                      onClick={() => window.confirm(`ลบรีวิวของ ${r.userName}? (บันทึกใน audit log)`) && run(() => deleteReviewAsAdmin(r.id), 'ลบรีวิวแล้ว')}
                      className="ml-auto text-stone-500 hover:text-rose-400 flex items-center gap-1 cursor-pointer"
                      title="ลบรีวิว (ผู้ดูแลระบบ)"
                    >
                      <Trash2 className="w-3 h-3" />
                    </button>
                  )}
                </div>
                {r.text && <p className="text-stone-400 leading-relaxed whitespace-pre-line break-words">{r.text}</p>}
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}

const SOCIAL_STYLE: Record<SocialKey, { className: string; glyph: React.ReactNode }> = {
  facebook: { className: 'bg-[#1877f2] text-white', glyph: <span className="font-bold text-base leading-none">f</span> },
  instagram: { className: 'bg-gradient-to-tr from-amber-400 via-rose-500 to-purple-600 text-white', glyph: <Camera className="w-4 h-4" /> },
  tiktok: { className: 'bg-black text-white border border-stone-700', glyph: <span className="font-bold text-sm leading-none">♪</span> },
  youtube: { className: 'bg-[#ff0000] text-white', glyph: <span className="text-xs leading-none">▶</span> },
}

/** Right column for visitors: pitch, contact buttons, contact list with LINE QR, socials, categories. */
function ContactColumn({ windowItem: w, profile, linkCopied, onShare }: { windowItem: WindowItem; profile: WindowProfile; linkCopied: boolean; onShare: () => void }) {
  const line = lineUrl(profile.lineId)
  const primary = line || (profile.phone && telHref(profile.phone)) || (profile.email && `mailto:${profile.email}`) || profile.website
  const category = CATEGORIES[w.category]
  const contacts = [
    profile.phone && { icon: Phone, label: 'เบอร์โทร', value: profile.phone, href: telHref(profile.phone), action: 'โทรเลย' },
    profile.lineId && { icon: MessageCircle, label: 'LINE', value: profile.lineId, href: line, action: 'แชท' },
    profile.email && { icon: Mail, label: 'อีเมล', value: profile.email, href: `mailto:${profile.email}`, action: 'ส่งอีเมล' },
    profile.website && { icon: Globe, label: 'เว็บไซต์', value: profile.website.replace(/^https:\/\/(www\.)?/, '').replace(/\/$/, ''), href: profile.website, action: 'เยี่ยมชม' },
  ].filter(Boolean) as { icon: typeof Phone; label: string; value: string; href: string; action: string }[]

  return (
    <div className="space-y-4 font-['Prompt',sans-serif]">
      <div className={`${card} overflow-hidden`}>
        <div className="relative p-4 sm:p-5 overflow-hidden">
          <div className="absolute -right-10 -top-10 w-48 h-48 rounded-full bg-gradient-to-br from-amber-300 via-rose-500 to-purple-600 opacity-80 blur-[2px]" />
          <div className="absolute right-4 top-6 flex gap-2">
            <span className="w-10 h-10 rounded-full bg-[#1b1530] flex items-center justify-center text-white shadow-lg"><Store className="w-5 h-5" /></span>
            <span className="w-10 h-10 rounded-full bg-blue-600 flex items-center justify-center text-white shadow-lg mt-6"><UserRound className="w-5 h-5" /></span>
            <span className="w-10 h-10 rounded-full bg-[#1b1530] flex items-center justify-center text-white shadow-lg"><BarChart3 className="w-5 h-5" /></span>
          </div>
          <div className="relative max-w-[62%] space-y-2">
            <p className="text-lg sm:text-2xl font-bold text-stone-50 leading-snug">ให้คนเห็นสิ่งที่คุณเป็น<br />ให้คนพบสิ่งที่คุณทำ</p>
            <p className="text-[11px] sm:text-xs text-stone-300 leading-relaxed">พื้นที่นำเสนอตัวตน สินค้า บริการ และผลงานของคุณ ให้ผู้คนค้นพบและติดต่อได้ง่ายขึ้น</p>
          </div>
        </div>
        <div className="grid grid-cols-3 border-t border-purple-900/40 divide-x divide-purple-900/40">
          {[
            { icon: UserRound, color: 'bg-purple-600', title: 'แนะนำตัวตน', sub: 'บอกว่าคุณเป็นใคร' },
            { icon: Package, color: 'bg-rose-500', title: 'นำเสนอสินค้า/บริการ', sub: 'สินค้า บริการ หรือผลงาน' },
            { icon: Users, color: 'bg-orange-500', title: 'เปิดรับโอกาส', sub: 'ลูกค้า คู่ค้า และผู้ร่วมงาน' },
          ].map(({ icon: Icon, color, title, sub }) => (
            <div key={title} className="flex flex-col sm:flex-row items-center sm:items-start gap-1.5 sm:gap-2 p-2.5 text-center sm:text-left">
              <span className={`w-8 h-8 rounded-full ${color} flex items-center justify-center text-white shrink-0`}><Icon className="w-4 h-4" /></span>
              <div className="leading-tight min-w-0">
                <div className="text-[11px] font-bold text-stone-100">{title}</div>
                <div className="text-[10px] text-stone-400 hidden sm:block">{sub}</div>
              </div>
            </div>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-5 gap-2.5">
        {primary ? (
          <a href={primary} target={primary.startsWith('http') ? '_blank' : undefined} rel="noreferrer" className={`col-span-3 p-3 flex items-center gap-2.5 ${cta}`}>
            <MessagesSquare className="w-7 h-7 shrink-0" />
            <div className="leading-tight min-w-0 flex-1">
              <div className="font-bold text-sm">ติดต่อเจ้าของหน้าต่าง</div>
              <div className="text-[10px] opacity-90 truncate">พูดคุย สอบถาม หรือสร้างโอกาสร่วมกัน</div>
            </div>
            <ChevronRight className="w-5 h-5 shrink-0" />
          </a>
        ) : null}
        <button onClick={onShare} className={`${primary ? 'col-span-2' : 'col-span-5'} p-3 rounded-2xl border border-purple-500/50 text-stone-100 hover:bg-purple-950/50 flex items-center gap-2.5 cursor-pointer text-left`}>
          <Share2 className="w-6 h-6 shrink-0" />
          <div className="leading-tight min-w-0">
            <div className="font-bold text-sm">{linkCopied ? 'คัดลอกแล้ว!' : 'แชร์หน้าต่าง'}</div>
            <div className="text-[10px] text-stone-400 truncate">ให้คนอื่นได้พบเห็น</div>
          </div>
        </button>
      </div>

      {hasContacts(profile) && (
        <div className={`${card} p-2.5 flex gap-2.5`}>
          <ul className="flex-1 min-w-0 divide-y divide-purple-900/40">
            {contacts.map(({ icon: Icon, label, value, href, action }) => (
              <li key={label} className="flex items-center gap-2.5 py-2 px-1">
                <span className="w-8 h-8 rounded-full border border-purple-700/60 flex items-center justify-center text-stone-200 shrink-0"><Icon className="w-4 h-4" /></span>
                <div className="flex-1 min-w-0 leading-tight">
                  <div className="text-[10px] text-stone-400">{label}</div>
                  <div className="text-xs text-stone-100 truncate">{value}</div>
                </div>
                <a href={href} target={href.startsWith('http') ? '_blank' : undefined} rel="noreferrer" className="px-3 py-1 rounded-lg border border-purple-500/50 text-[11px] text-stone-100 hover:bg-purple-900/50 shrink-0">
                  {action}
                </a>
              </li>
            ))}
          </ul>
          {line && <LineQr url={line} />}
        </div>
      )}

      {(hasSocials(profile) || w.externalLink) && (
        <div className={`${card} p-3 flex gap-3 items-start`}>
          <span className="w-9 h-9 rounded-full border border-purple-700/60 flex items-center justify-center text-stone-200 shrink-0"><Link2 className="w-4 h-4" /></span>
          <div className="space-y-2 min-w-0">
            <div className="font-bold text-sm text-stone-100">ช่องทางอื่น ๆ</div>
            <div className="flex flex-wrap gap-2.5">
              {SOCIALS.filter((s) => profile[s.key]).map((s) => (
                <a key={s.key} href={profile[s.key]} target="_blank" rel="noreferrer" title={s.label} className={`w-9 h-9 rounded-full flex items-center justify-center hover:scale-110 transition-transform ${SOCIAL_STYLE[s.key].className}`}>
                  {SOCIAL_STYLE[s.key].glyph}
                </a>
              ))}
              {w.externalLink && (
                <a href={w.externalLink} target="_blank" rel="noreferrer" title={w.externalLink} className="w-9 h-9 rounded-full border border-purple-700/60 flex items-center justify-center text-stone-200 hover:scale-110 transition-transform">
                  <ExternalLink className="w-4 h-4" />
                </a>
              )}
            </div>
          </div>
        </div>
      )}

      <div className={`${card} p-3 flex gap-3 items-start`}>
        <span className="w-9 h-9 rounded-full border border-purple-700/60 flex items-center justify-center text-stone-200 shrink-0"><Tag className="w-4 h-4" /></span>
        <div className="space-y-2 min-w-0">
          <div className="font-bold text-sm text-stone-100">หมวดหมู่</div>
          <div className="flex flex-wrap gap-1.5">
            <span className="px-2.5 py-1 rounded-lg bg-purple-950/70 border border-purple-800/60 text-xs text-stone-200">
              {category?.icon} {category?.label}
            </span>
            {profile.tags.map((tag) => (
              <span key={tag} className="px-2.5 py-1 rounded-lg bg-purple-950/70 border border-purple-800/60 text-xs text-stone-200">#{tag}</span>
            ))}
          </div>
        </div>
      </div>
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
    <a href={url} target="_blank" rel="noreferrer" className="hidden sm:flex flex-col items-center justify-center gap-1.5 px-3 rounded-xl border border-purple-900/50 shrink-0">
      <span className="text-[10px] text-stone-300">สแกนเพื่อเพิ่มเพื่อน</span>
      <img src={src} alt="QR LINE" className="w-24 h-24 rounded-lg bg-white p-1" />
    </a>
  )
}

function ResaleBanner({ windowItem: w }: { windowItem: WindowItem }) {
  return (
    <div className="p-3 rounded-2xl bg-gradient-to-r from-orange-950/40 to-[#0e0b18] border border-orange-500/40 flex items-center justify-between gap-3 font-['Prompt',sans-serif]">
      <div>
        <span className="text-[10px] uppercase font-bold text-orange-400 block tracking-wider">🏷️ หน้าต่างนี้เปิดขายต่อ (Resale)</span>
        <span className="text-xs text-stone-300 font-light">รับช่วงต่อสิทธิ์หน้าต่างนี้ได้</span>
      </div>
      <span className="text-base font-bold font-mono text-orange-300 shrink-0">฿{w.resalePrice?.toLocaleString()}</span>
    </div>
  )
}

function QuotaReached({ message }: { message: string }) {
  return (
    <div className="p-3 rounded-xl bg-purple-950/40 border border-purple-500/40 text-center space-y-1">
      <span className="text-rose-300 font-bold text-xs block">⚠️ {message}</span>
      <span className="text-[11px] text-stone-400">(โควตาผู้ใช้ 1 คน อ้างอิงเลขบัตรประชาชน: ไทย 1 บาน + ภูมิภาค 1 บาน)</span>
    </div>
  )
}

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

  return (
    <div className="space-y-3 font-['Prompt',sans-serif] animate-in fade-in duration-150">
      <div className="p-3 rounded-xl bg-gradient-to-r from-purple-950/40 via-[#151025] to-rose-950/30 border border-purple-500/40 text-xs space-y-1">
        <div className="flex items-center justify-between text-rose-300 font-bold">
          <span className="flex items-center gap-1.5">
            <Lock className="w-3.5 h-3.5 text-rose-400" />
            <span>โหมดข้อมูลส่วนตัว (เฉพาะคุณในฐานะเจ้าของบาน)</span>
          </span>
          <span className="text-[10px] px-1.5 py-0.2 rounded bg-emerald-950 text-emerald-300 border border-emerald-500/40 font-mono">
            Verified Owner
          </span>
        </div>
        <p className="text-[11px] text-stone-300 font-light leading-relaxed">
          ข้อมูลส่วนนี้เข้ารหัสและแสดงผลให้ <strong>คุณ ({currentUser?.name})</strong> มองเห็นคนเดียวเท่านั้น
          บุคคลทั่วไปจะไม่สามารถดูเลขบัตร ปชช. หรือเบอร์ติดต่อจริงของคุณได้
        </p>
      </div>

      <div className="p-3.5 rounded-xl bg-[#09080e] border border-purple-900/30 space-y-2 text-xs">
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
            <span className="text-stone-400">ครอบครองสิทธิ์เมื่อ:</span>
            <span className="font-mono text-stone-300">{new Date(w.claimedAt).toLocaleString('th-TH')}</span>
          </div>
        )}
        <div className="flex items-center justify-between">
          <span className="text-stone-400">ต้นทุนสิทธิ์บานแรกเข้า:</span>
          <span className="font-mono text-emerald-400 font-bold">{w.claimPrice ? `${w.claimPrice.toLocaleString()} ฿` : rules.claimPriceLabel} (ตลอดชีพ)</span>
        </div>
      </div>

      {isForResale && w.resalePrice && (
        <div className="p-3.5 rounded-xl bg-gradient-to-r from-orange-950/30 via-[#151025] to-purple-950/30 border border-rose-500/30 space-y-2 text-xs">
          <div className="flex items-center justify-between text-rose-300 font-bold">
            <span>💰 ประมาณการรายได้จากการขายต่อบานนี้:</span>
            <span className="font-mono text-[10px] px-1.5 py-0.5 rounded bg-purple-950 text-purple-200">หักค่าคอม {rules.commissionLabel}</span>
          </div>
          <div className="space-y-1 font-mono text-[11px]">
            <div className="flex justify-between text-stone-400">
              <span>ราคาขายต่อที่ตั้งไว้:</span>
              <span className="text-stone-200 font-bold">฿{w.resalePrice.toLocaleString()}</span>
            </div>
            <div className="flex justify-between text-rose-400">
              <span>ค่าคอมมิชชั่นระบบ ({rules.commissionLabel}):</span>
              <span>-฿{commissionOf(w.resalePrice).toLocaleString()}</span>
            </div>
            <div className="flex justify-between text-emerald-300 font-bold pt-1 border-t border-purple-900/30 text-xs">
              <span>ยอดเงินโอนเข้ากระเป๋าคุณสุทธิ ({rules.sellerLabel}):</span>
              <span>฿{(w.resalePrice - commissionOf(w.resalePrice)).toLocaleString()}</span>
            </div>
          </div>
        </div>
      )}

      <div className="p-3.5 rounded-xl bg-gradient-to-br from-purple-950/50 to-[#09080e] border border-purple-500/40 text-xs space-y-2">
        <div className="flex items-center gap-1.5 font-medium text-stone-200">
          <Store className="w-4 h-4 text-purple-300" />
          <span>โปรไฟล์บาน (โลโก้ สินค้า ช่องทางติดต่อ รายละเอียด)</span>
        </div>
        <p className="text-[11px] text-stone-400 font-light">ข้อมูลที่ผู้เยี่ยมชมเห็นในหน้านี้ · แก้ไขได้ฟรีไม่จำกัด ไม่นับรวมสิทธิ์แก้ไขรายวัน</p>
        <button
          onClick={onEditProfile}
          className="w-full py-2.5 px-3 text-xs font-semibold rounded-xl flex items-center justify-center gap-2 border border-purple-400/60 text-purple-100 hover:bg-purple-900/40 cursor-pointer"
        >
          <Pencil className="w-4 h-4" />
          <span>แก้ไขโปรไฟล์บาน</span>
        </button>
      </div>

      <div className="p-3.5 rounded-xl bg-[#09080e] border border-purple-900/30 text-xs space-y-2.5">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-1.5 font-medium text-stone-200">
            <Calendar className="w-4 h-4 text-rose-400" />
            <span>สิทธิ์แก้ไขรูปภาพและข้อความ</span>
          </div>
          <span className="text-[10px] text-stone-400 font-mono">(ฟรี {editPolicy.freeEditsPerDay} ครั้ง / วัน)</span>
        </div>
        {!edit.paid ? (
          <div className="flex items-center gap-2 p-2 rounded-lg bg-emerald-950/40 border border-emerald-800/40 text-emerald-300">
            <Check className="w-4 h-4 shrink-0 text-emerald-400" />
            <span className="text-[11px] leading-tight font-light">
              แก้ไขฟรีได้อีก <strong className="font-mono">{edit.freeLeft}</strong> ครั้งในวันนี้
            </span>
          </div>
        ) : (
          <div className="flex items-center gap-2 p-2 rounded-lg bg-purple-950/30 border border-purple-800/30 text-rose-300">
            <Clock className="w-4 h-4 shrink-0 text-rose-400" />
            <span className="text-[11px] leading-tight font-light">
              {edit.canEdit ? (
                <>
                  ใช้สิทธิ์ฟรีวันนี้ครบแล้ว แก้ไขเพิ่มได้ครั้งละ{' '}
                  <strong className="font-mono text-amber-200 font-bold">฿{edit.price.toLocaleString()}</strong> (หักจากกระเป๋า) ·{' '}
                </>
              ) : (
                'ใช้สิทธิ์แก้ไขของวันนี้ครบแล้ว · '
              )}
              สิทธิ์ฟรีกลับมาในอีก{' '}
              <strong className="font-mono text-rose-200 font-bold">
                {edit.resetsIn.hours} ชม. {edit.resetsIn.minutes} นาที
              </strong>
            </span>
          </div>
        )}
        <div className="pt-1 flex flex-col gap-2">
          <button
            onClick={() => onOpenEditor(w)}
            disabled={!edit.canEdit}
            className={`w-full py-2.5 px-3 text-xs font-semibold rounded-xl flex items-center justify-center gap-2 transition-all cursor-pointer ${edit.canEdit ? 'bg-gradient-to-r from-orange-500 via-rose-500 to-purple-600 text-white shadow-md hover:opacity-95' : 'bg-[#140f21] text-stone-500 cursor-not-allowed border border-purple-900/30'}`}
          >
            <Camera className="w-4 h-4" />
            <span>แก้ไขรูปภาพ / ข้อความบานของคุณ</span>
          </button>
          {edit.paid && isDemo() && (
            <button
              onClick={() => onSimulatePass24Hours(w.id)}
              className="w-full py-1.5 px-2.5 text-[10px] text-stone-400 hover:text-rose-300 bg-[#120f1e] hover:bg-[#181329] border border-dashed border-purple-900/40 rounded-lg flex items-center justify-center gap-1.5 transition-colors cursor-pointer"
              title="คืนสิทธิ์แก้ไขฟรีของวันนี้เพื่อทดสอบระบบแก้ไข"
            >
              <FastForward className="w-3 h-3 text-rose-400" />
              <span>ทดสอบ: คืนสิทธิ์แก้ไขฟรีของวันนี้</span>
            </button>
          )}
        </div>
      </div>

      <div className="space-y-2">
        {!holding.isEligible && (
          <div className="p-3 rounded-xl bg-purple-950/40 border border-purple-500/50 text-rose-200 text-xs space-y-1.5">
            <div className="flex items-center gap-1.5 font-bold text-rose-300">
              <Clock className="w-4 h-4 text-rose-400 shrink-0" />
              <span>เงื่อนไขข้อ 1: ต้องถือครองไม่ต่ำกว่า {rules.minHoldingDays} วัน</span>
            </div>
            <p className="text-[11px] leading-relaxed text-stone-300 font-light">
              ปัจจุบันคุณถือครองมาแล้ว <strong className="font-mono text-rose-300 font-bold">{holding.daysHeld} วัน</strong> (ขาดอีก{' '}
              <strong className="font-mono text-rose-300 font-bold">{holding.daysRemaining} วัน</strong> จึงจะเปิดขายต่อได้)
            </p>
            <button
              type="button"
              onClick={() => onSimulateHolding(w.id, 35)}
              className="text-[10px] text-rose-300 hover:text-rose-200 underline flex items-center gap-1 font-mono pt-0.5 cursor-pointer"
            >
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
        ) : (
          <div className="flex gap-2">
            {isForResale ? (
              <button
                onClick={() => onCancelResale(w)}
                className="flex-1 py-2 px-3 text-xs font-medium text-rose-300 bg-[#120f1e] hover:bg-[#181329] border border-rose-700/50 rounded-xl transition-colors cursor-pointer"
              >
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
                className="flex-1 py-2.5 px-3 text-xs font-semibold rounded-xl text-rose-300 bg-[#120f1e] hover:bg-[#181329] border border-rose-500/40 cursor-pointer transition-colors flex items-center justify-center gap-1.5"
              >
                <Tag className="w-3.5 h-3.5" />
                <span>
                  {holding.isEligible ? 'ตั้งราคาเปิดขายต่อให้ผู้อื่น' : `เปิดขายต่อ (ถือครอง ${holding.daysHeld}/${rules.minHoldingDays} วัน)`}
                </span>
              </button>
            )}
          </div>
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
      <span className="text-stone-400">{props.label}</span>
      <div className="flex items-center gap-1.5 font-mono text-stone-200">
        <span>{props.visible ? props.fullValue : props.maskedValue}</span>
        <button
          type="button"
          onClick={props.onToggle}
          className="p-1 text-stone-400 hover:text-stone-200 cursor-pointer"
          title={props.visible ? props.hideTitle : props.showTitle}
        >
          {props.visible ? (
            <EyeOff className="w-3.5 h-3.5 text-rose-400" />
          ) : (
            <Eye className="w-3.5 h-3.5 text-stone-400" />
          )}
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
      className="p-3.5 bg-[#09080e] rounded-xl border border-rose-500/50 space-y-3"
    >
      <div className="flex items-center justify-between text-xs">
        <span className="text-stone-200 font-bold flex items-center gap-1">
          <Tag className="w-3.5 h-3.5 text-rose-400" />
          <span>ตั้งราคาขายต่อ (ตามกติกากำหนดเพดานราคา)</span>
        </span>
        <button type="button" onClick={onCancel} className="text-stone-400 hover:text-stone-200 text-[11px] cursor-pointer">
          ยกเลิก
        </button>
      </div>

      <div className="p-2.5 rounded-lg bg-[#140f21] border border-purple-500/30 text-xs space-y-1.5 font-mono">
        <div className="flex items-center justify-between text-rose-300 font-sans font-bold">
          <span>เพดานราคาตามเงื่อนไข:</span>
          <span className="text-[10px] px-1.5 py-0.5 rounded bg-rose-500/20 text-rose-200">{cap.tierLabel}</span>
        </div>
        <div className="text-[11px] text-stone-300 space-y-1">
          <div className="flex justify-between">
            <span className="text-stone-400">ราคาตั้งต้น:</span>
            <span>฿{cap.basePrice.toLocaleString()}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-stone-400">เพดานสูงสุด:</span>
            <span className="text-rose-300 font-bold">
              {cap.maxAllowedPrice === null ? 'ตามความต้องการของตลาด' : `ไม่เกิน ฿${cap.maxAllowedPrice.toLocaleString()}`}
            </span>
          </div>
        </div>
      </div>

      <div>
        <label className="block text-stone-300 text-[11px] font-medium mb-1">ระบุราคาขายต่อ (บาท):</label>
        <div className="flex items-center gap-2">
          <span className="font-mono text-rose-400 font-bold text-sm">฿</span>
          <input
            type="number"
            min={rules.minResalePrice}
            max={cap.maxAllowedPrice || undefined}
            step="50"
            value={priceInput}
            onChange={(e) => setPriceInput(e.target.value)}
            className="w-full bg-[#140f21] border border-purple-900/40 text-stone-100 text-xs px-2.5 py-1.5 rounded-lg focus:outline-none focus:border-rose-400 font-mono"
            required
          />
        </div>
      </div>

      {price > 0 && !overCap && (
        <div className="p-2.5 rounded-lg bg-[#140f21] border border-purple-500/30 text-[11px] space-y-1 font-mono">
          <div className="flex justify-between text-rose-300 font-sans font-medium">
            <span>เงื่อนไขระบบหักค่าคอมมิชชั่น:</span>
            <span className="font-bold">{rules.commissionLabel}</span>
          </div>
          <div className="flex justify-between text-stone-400">
            <span>• ค่าคอมมิชชั่นเข้าระบบ ({rules.commissionLabel}):</span>
            <span className="text-rose-400 font-bold">฿{commissionOf(price).toLocaleString()}</span>
          </div>
          <div className="flex justify-between text-stone-300 font-medium">
            <span>• คุณจะได้รับเงินสุทธิ ({rules.sellerLabel}):</span>
            <span className="text-emerald-400 font-bold">฿{(price - commissionOf(price)).toLocaleString()}</span>
          </div>
        </div>
      )}

      <button
        type="submit"
        disabled={overCap || price < rules.minResalePrice || !isEligible}
        className="w-full py-2.5 px-3 text-xs font-semibold rounded-xl bg-gradient-to-r from-orange-500 via-rose-500 to-purple-600 hover:opacity-95 text-white cursor-pointer shadow-md transition-all"
      >
        ยืนยันเปิดขายต่อบานนี้
      </button>
    </form>
  )
}
