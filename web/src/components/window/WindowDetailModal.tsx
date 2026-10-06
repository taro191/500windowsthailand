import { useEffect, useState } from 'react'
import {
  Calendar,
  Camera,
  Check,
  Clock,
  ExternalLink,
  Eye,
  EyeOff,
  FastForward,
  Globe,
  Heart,
  Lock,
  Share2,
  ShoppingBag,
  Sparkles,
  Tag,
  Users,
  X,
} from 'lucide-react'
import type { Quota, User, WindowItem } from '@/types'
import { REGIONS_BY_ID } from '@/data/regions'
import { CATEGORIES } from '@/data/categories'
import { followerCount, highlightKind, highlightLabel, likesToday, starLevel, todaysNote } from '@/lib/windowBadges'
import {
  getEditAvailability,
  getHoldingPeriod,
  getPriceCap,
  MIN_RESALE_PRICE,
  RESALE_COMMISSION_RATE,
} from '@/lib/ownershipRules'
import { maskCitizenId, maskPhone } from '@/lib/identity'
import { copyToClipboard } from '@/lib/browser'
import { KapsulepLogo } from '../KapsulepLogo'
import { STAR_LABELS } from '../board/WindowBadges'

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
  /** Demo: unlock editing now instead of waiting 24 hours. */
  onSimulatePass24Hours: (windowId: number) => void
  /** Demo: pretend the window has been held for `days` days. */
  onSimulateHolding: (windowId: number, days: number) => void
  onLike: (windowId: number) => void
  onToggleFollow: (windowId: number) => void
  onShowFollowing: () => void
  onOpenKyc: () => void
}

const CHEERS = [
  { emoji: '❤️', label: 'ถูกใจ' },
  { emoji: '👏', label: 'ชื่นชม' },
  { emoji: '☕', label: 'ส่งกาแฟ' },
  { emoji: '✨', label: 'ยอดเยี่ยม' },
]

const commissionOf = (price: number) => Math.round(price * RESALE_COMMISSION_RATE)

export function WindowDetailModal(props: WindowDetailModalProps) {
  const { windowItem, currentUser, quota, onClose, onClaim, onBuyResale, onLike, onToggleFollow, onOpenKyc } = props
  const [linkCopied, setLinkCopied] = useState(false)
  const [ownerView, setOwnerView] = useState<'manage' | 'preview'>('manage')
  const isOwner = !!currentUser && !!windowItem && windowItem.ownerId === currentUser.id

  useEffect(() => {
    setOwnerView('manage')
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
  const isFollowing = !!currentUser && !!w.followerIds?.includes(currentUser.id)

  const canAcquireHere = isThailand ? quota.canAcquireThailand : quota.canAcquireRegional
  const quotaMessage = isThailand
    ? `คุณมีหน้าต่างบานประเทศไทยครบ 1 บานแล้ว (${quota.thailandWindow?.code}) ไม่สามารถจับจองเพิ่มได้`
    : `คุณมีหน้าต่างบานภูมิภาคครบ 1 บานแล้ว (${quota.regionalWindow?.code}) ไม่สามารถจับจองเพิ่มได้`

  const shareLink = async () => {
    const url = `${window.location.href.split('#')[0]}#window-${w.region}-${w.id}`
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

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/85 backdrop-blur-sm overflow-y-auto font-['Plus_Jakarta_Sans','Prompt',sans-serif]">
      <div
        className="relative w-full max-w-4xl bg-[#110e1a] border border-purple-900/50 rounded-2xl shadow-2xl overflow-hidden my-auto max-h-[92vh] flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between px-4 sm:px-6 py-3.5 bg-[#09080e] border-b border-purple-900/30">
          <div className="flex items-center gap-2.5 flex-wrap">
            <KapsulepLogo size={26} showGlow />
            <span className="font-['Outfit',sans-serif] font-bold text-base bg-gradient-to-r from-orange-400 via-rose-400 to-purple-400 bg-clip-text text-transparent">
              {code}
            </span>
            <span
              className="px-2 py-0.5 text-xs bg-[#140f21] border border-purple-500/40 text-purple-300 font-mono rounded-md"
              title="ตำแหน่งจัดวางบนหน้าต่างในรอบปัจจุบัน"
            >
              ช่อง #{w.slotPosition || w.id}
            </span>
            {region && (
              <span className="px-2 py-0.5 text-xs bg-[#140f21] border border-purple-900/40 rounded-md text-stone-200 flex items-center gap-1 font-['Prompt',sans-serif]">
                <span>{region.icon}</span>
                <span>{region.name}</span>
              </span>
            )}
            <div className="h-4 w-px bg-stone-800 hidden sm:block" />
            <span className="text-xs text-stone-300 flex items-center gap-1.5">
              <span>{category?.icon}</span>
              <span>{category?.label}</span>
              {w.province && (
                <>
                  <span className="text-stone-600">·</span>
                  <span className="text-stone-400">{w.province}</span>
                </>
              )}
            </span>
            {isOwner && (
              <span className="px-2 py-0.5 text-xs bg-purple-950 text-purple-300 border border-purple-600/70 rounded-md font-bold">
                บานของฉัน
              </span>
            )}
            {highlightText && (
              <span
                className={`px-2 py-0.5 text-xs rounded-md font-bold border ${highlight === 'hot' ? 'bg-orange-500/20 text-orange-300 border-orange-500/60' : highlight === 'fresh' ? 'bg-rose-500/20 text-rose-300 border-rose-500/60' : 'bg-emerald-500/20 text-emerald-300 border-emerald-500/60'}`}
              >
                {highlight === 'hot' ? '🔥' : highlight === 'fresh' ? '✨' : '🟢'} {highlightText}
              </span>
            )}
            {stars > 0 && (
              <span className="px-2 py-0.5 text-xs rounded-md font-bold border bg-purple-500/15 text-purple-300 border-purple-500/50 flex items-center gap-1">
                <span className="text-rose-400">⭐</span>
                {STAR_LABELS[stars as 1 | 2 | 3]}
              </span>
            )}
          </div>
          <div className="flex items-center gap-1.5 sm:gap-2">
            <button
              onClick={shareLink}
              className="p-1.5 text-stone-400 hover:text-rose-300 hover:bg-stone-850 rounded-lg transition-colors cursor-pointer text-xs flex items-center gap-1"
              title="คัดลอกลิงก์แชร์"
            >
              <Share2 className="w-4 h-4" />
              <span className="hidden sm:inline">{linkCopied ? 'คัดลอกแล้ว!' : 'แชร์'}</span>
            </button>
            <button
              onClick={onClose}
              className="p-1.5 text-stone-400 hover:text-stone-200 hover:bg-stone-850 rounded-lg transition-colors cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        <div className="overflow-y-auto p-4 sm:p-6 lg:p-7 flex-1">
          <div className="grid grid-cols-1 md:grid-cols-12 gap-6 lg:gap-8">
            <div className="md:col-span-7 flex flex-col gap-3">
              <WindowImage windowItem={w} />
              {!isAvailable && (
                <div className="flex items-center justify-between text-xs text-stone-400 px-1">
                  <div className="flex items-center gap-3 flex-wrap">
                    <span>ผู้เข้าชม {w.viewsCount.toLocaleString()} ครั้ง</span>
                    <span>·</span>
                    <button
                      onClick={() => onLike(w.id)}
                      className="flex items-center gap-1 text-rose-400 hover:text-rose-300 transition-colors cursor-pointer"
                    >
                      <Heart className="w-3.5 h-3.5 fill-rose-500/20" />
                      <span>{w.likesCount.toLocaleString()} ถูกใจ</span>
                    </button>
                    <span className="text-stone-500" title="ไลค์ในวันนี้ (เวลาไทย)">
                      วันนี้ +{likesToday(w)}
                    </span>
                    <span>·</span>
                    <button
                      onClick={() => onToggleFollow(w.id)}
                      className={`flex items-center gap-1 transition-colors cursor-pointer ${isFollowing ? 'text-purple-300' : 'text-purple-400 hover:text-purple-300'}`}
                    >
                      <Users className="w-3.5 h-3.5" />
                      <span>
                        {isFollowing ? 'กำลังติดตาม' : 'ติดตาม'} · {followerCount(w).toLocaleString()}
                      </span>
                    </button>
                  </div>
                </div>
              )}
              {w.imageUpdateHistory?.length > 0 && <ImageHistory windowItem={w} />}
            </div>

            <div className="md:col-span-5 flex flex-col justify-between gap-5">
              <div className="space-y-4">
                <div>
                  <h2 className="text-xl sm:text-2xl font-bold text-stone-100 leading-snug">{w.title}</h2>
                  <p className="mt-2 text-xs sm:text-sm text-stone-300 leading-relaxed font-light">{w.description}</p>
                </div>

                {isOwner && (
                  <div className="flex items-center gap-1.5 p-1 bg-[#09080e] rounded-xl border border-purple-900/30 text-xs font-['Prompt',sans-serif]">
                    <button
                      type="button"
                      onClick={() => setOwnerView('manage')}
                      className={`flex-1 py-2 px-3 rounded-lg font-semibold flex items-center justify-center gap-1.5 transition-all cursor-pointer ${ownerView === 'manage' ? 'bg-gradient-to-r from-orange-500 via-rose-500 to-purple-600 text-white shadow-sm' : 'text-stone-400 hover:text-stone-200'}`}
                    >
                      <Lock className="w-3.5 h-3.5 text-rose-300" />
                      <span>🛠️ สตูดิโอจัดการบาน (เจ้าของ)</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => setOwnerView('preview')}
                      className={`flex-1 py-2 px-3 rounded-lg font-semibold flex items-center justify-center gap-1.5 transition-all cursor-pointer ${ownerView === 'preview' ? 'bg-gradient-to-r from-purple-600 via-rose-500 to-orange-500 text-white shadow-sm' : 'text-stone-400 hover:text-stone-200'}`}
                    >
                      <Globe className="w-3.5 h-3.5" />
                      <span>👀 พรีวิวมุมมองที่เพื่อนเห็น</span>
                    </button>
                  </div>
                )}

                {(!isOwner || ownerView === 'preview') && (
                  <VisitorView
                    {...props}
                    windowItem={w}
                    isOwner={isOwner}
                    isFollowing={isFollowing}
                    onBackToManage={() => setOwnerView('manage')}
                  />
                )}
                {isOwner && ownerView === 'manage' && <OwnerStudio {...props} windowItem={w} />}
              </div>

              <div className="pt-2 border-t border-stone-800">
                {isAvailable &&
                  (!canAcquireHere && currentUser ? (
                    <QuotaReached message={quotaMessage} />
                  ) : (
                    <button
                      onClick={requireKyc(() => onClaim(w))}
                      className="w-full py-3 px-4 text-sm font-bold text-white bg-gradient-to-r from-orange-500 via-rose-500 to-purple-600 hover:opacity-95 rounded-xl shadow-lg shadow-rose-500/20 transition-all flex items-center justify-center gap-2 cursor-pointer"
                    >
                      <Sparkles className="w-4 h-4" />
                      <span>จับจองเป็นเจ้าของบานนี้ (500 ฿)</span>
                    </button>
                  ))}
                {isForResale &&
                  !isOwner &&
                  (!canAcquireHere && currentUser ? (
                    <QuotaReached message={quotaMessage} />
                  ) : (
                    <button
                      onClick={requireKyc(() => onBuyResale(w))}
                      className="w-full py-3 px-4 text-sm font-bold text-white bg-gradient-to-r from-orange-500 via-rose-500 to-purple-600 hover:opacity-95 rounded-xl shadow-lg shadow-rose-500/20 transition-all flex items-center justify-center gap-2 cursor-pointer"
                    >
                      <ShoppingBag className="w-4 h-4" />
                      <span>ซื้อต่อหน้าต่างนี้ในราคา ฿{w.resalePrice?.toLocaleString()}</span>
                    </button>
                  ))}
                {!isAvailable && !isForResale && !isOwner && (
                  <div className="text-center py-2 text-xs text-stone-400 bg-stone-950/60 rounded-xl border border-stone-800/80">
                    หน้าต่างนี้มีเจ้าของแล้ว และไม่ได้เปิดขายต่อในขณะนี้
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

function WindowImage({ windowItem: w }: { windowItem: WindowItem }) {
  return (
    <div className="relative aspect-[4/3] rounded-xl overflow-hidden bg-stone-950 border-2 border-stone-800 shadow-inner flex items-center justify-center">
      {w.status === 'available' ? (
        <div className="text-center p-8">
          <div className="w-16 h-16 rounded-full bg-[#181326] border border-dashed border-rose-500/40 flex items-center justify-center mx-auto mb-3 text-rose-400">
            <Sparkles className="w-8 h-8" />
          </div>
          <h3 className="text-lg font-bold text-stone-200">บานหน้าต่างนี้พร้อมให้คุณเป็นเจ้าของ</h3>
          <p className="text-xs text-stone-400 mt-1 max-w-sm mx-auto leading-relaxed font-light">
            จับจองเพื่อลงรูปภาพส่วนตัว ธุรกิจ หรือเรื่องราวแห่งความทรงจำของคุณ แก้ไขรูปภาพและข้อความได้วันละ 1 ครั้ง
            และขายต่อได้ทุกเวลา (โควตาผู้ใช้: ไทย 1 บาน + ภูมิภาค 1 บาน)
          </p>
        </div>
      ) : (
        <>
          <img src={w.imageUrl} alt={w.title} className="w-full h-full object-cover" />
          <div className="absolute inset-0 pointer-events-none border border-black/30 shadow-[inset_0_0_15px_rgba(0,0,0,0.6)]" />
          {w.status === 'for_resale' && (
            <div className="absolute top-3 left-3 bg-[#0c0a12]/95 border border-orange-500/80 px-3 py-1 rounded-lg text-xs font-mono font-bold text-orange-300 shadow-lg flex items-center gap-1.5">
              <Tag className="w-3.5 h-3.5 text-orange-400" />
              <span>เปิดขายต่อ: ฿{w.resalePrice?.toLocaleString()}</span>
            </div>
          )}
        </>
      )}
    </div>
  )
}

function ImageHistory({ windowItem: w }: { windowItem: WindowItem }) {
  return (
    <div className="mt-3 p-3.5 bg-stone-950/60 rounded-xl border border-stone-800/80">
      <div className="flex items-center gap-2 text-xs font-medium text-stone-300 mb-2">
        <Calendar className="w-3.5 h-3.5 text-rose-400" />
        <span>ประวัติการลงภาพถ่าย ({w.imageUpdateHistory.length} ครั้ง)</span>
      </div>
      <div className="space-y-2">
        {w.imageUpdateHistory.map((entry, index) => (
          <div
            key={index}
            className="flex items-center justify-between text-xs text-stone-400 bg-stone-900/60 p-2 rounded-lg border border-stone-800/60"
          >
            <div className="flex items-center gap-2 min-w-0">
              <img src={entry.imageUrl} alt="" className="w-7 h-7 rounded object-cover border border-stone-700 shrink-0" />
              <span className="text-stone-300 text-[11px] truncate max-w-[200px]">{entry.caption || 'อัปเดตรูปภาพ'}</span>
            </div>
            <span className="text-[10px] font-mono text-stone-500 shrink-0">
              {new Date(entry.date).toLocaleDateString('th-TH')}
            </span>
          </div>
        ))}
      </div>
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

/** What everyone sees: owner card, today's note, cheers, external link and resale price. */
function VisitorView({
  windowItem: w,
  isOwner,
  isFollowing,
  onBackToManage,
  onLike,
  onToggleFollow,
  onShowFollowing,
}: WindowDetailModalProps & {
  windowItem: WindowItem
  isOwner: boolean
  isFollowing: boolean
  onBackToManage: () => void
}) {
  const [cheerMessage, setCheerMessage] = useState<string | null>(null)
  useEffect(() => setCheerMessage(null), [w.id])

  const category = CATEGORIES[w.category]
  const note = todaysNote(w)

  const sendCheer = (emoji: string, label: string) => {
    onLike(w.id)
    setCheerMessage(`ส่งกำลังใจ "${emoji} ${label}" ให้เพื่อนเรียบร้อยแล้ว!`)
    setTimeout(() => setCheerMessage(null), 3000)
  }

  return (
    <div className="space-y-3.5 font-['Prompt',sans-serif] animate-in fade-in duration-200">
      {isOwner && (
        <div className="p-2.5 rounded-xl bg-purple-950/50 border border-purple-500/40 text-rose-200 text-xs flex items-center justify-between">
          <span className="flex items-center gap-1.5">
            <span>👀</span>
            <span>นี่คือหน้าต่างที่เพื่อนๆ และทุกคนจะได้เห็นเมื่อเข้ามาเยี่ยมชมบานของคุณ</span>
          </span>
          <button
            type="button"
            onClick={onBackToManage}
            className="text-[11px] underline text-rose-300 hover:text-white font-medium cursor-pointer"
          >
            กลับไปแก้ไข
          </button>
        </div>
      )}

      <div className="p-4 rounded-2xl bg-gradient-to-br from-[#151025] to-[#09080e] border border-purple-500/30 flex items-center justify-between gap-3 shadow-lg">
        <div className="flex items-center gap-3 min-w-0">
          <div className="w-12 h-12 rounded-full bg-gradient-to-tr from-orange-500 via-rose-500 to-purple-600 p-[2px] shrink-0 shadow-md">
            <div className="w-full h-full rounded-full bg-[#120f1e] flex items-center justify-center text-rose-300 font-bold font-['Outfit',sans-serif] text-base">
              {w.ownerName ? w.ownerName.charAt(0).toUpperCase() : '🇹🇭'}
            </div>
          </div>
          <div className="min-w-0">
            <div className="flex items-center gap-1.5 flex-wrap">
              <span className="font-bold text-stone-100 text-sm truncate">{w.ownerName}</span>
              <span className="text-[10px] px-1.5 py-0.2 rounded bg-purple-950 text-purple-300 border border-purple-500/40 font-mono">
                เจ้าของบาน
              </span>
            </div>
            <div className="text-xs text-stone-400 flex items-center gap-1.5 mt-0.5">
              <span>
                {category?.icon} {category?.label}
              </span>
              {w.province && (
                <>
                  <span>·</span>
                  <span className="text-stone-300">{w.province}</span>
                </>
              )}
            </div>
          </div>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <button
            onClick={() => onToggleFollow(w.id)}
            className={`px-3 py-1.5 rounded-xl text-xs font-semibold flex items-center gap-1.5 transition-all cursor-pointer shadow-sm ${isFollowing ? 'bg-purple-950 text-purple-300 border border-purple-500/50' : 'bg-gradient-to-r from-orange-500 via-rose-500 to-purple-600 text-white hover:opacity-95'}`}
          >
            <Users className="w-3.5 h-3.5" />
            <span>{isFollowing ? 'กำลังติดตาม' : 'ติดตาม'}</span>
          </button>
        </div>
      </div>

      {isFollowing && (
        <div className="flex items-center justify-between gap-2 px-3 py-2 rounded-xl bg-purple-950/60 border border-purple-500/40 text-[11px] text-purple-200 font-['Prompt',sans-serif]">
          <span>✓ ติดตามบานนี้แล้ว · ดูรวมทุกภูมิภาคได้ที่ตัวกรอง «กำลังติดตาม»</span>
          <button
            onClick={onShowFollowing}
            className="shrink-0 px-3 py-1.5 rounded-xl text-xs font-semibold bg-gradient-to-r from-orange-500 via-rose-500 to-purple-600 text-white hover:opacity-95 cursor-pointer"
          >
            ดูบานที่ติดตาม
          </button>
        </div>
      )}

      {note && (
        <div className="p-3.5 rounded-2xl bg-gradient-to-r from-emerald-950/40 via-[#131b1c] to-[#09080e] border border-emerald-500/40 space-y-1.5">
          <div className="flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
            <span className="text-[11px] font-bold text-emerald-300 uppercase tracking-wider font-['Outfit',sans-serif]">
              สเตตัสวันนี้จากเพื่อน (Daily Note)
            </span>
          </div>
          <p className="text-xs text-stone-200 leading-relaxed font-light pl-3.5 border-l-2 border-emerald-500/50 italic">
            "{note}"
          </p>
        </div>
      )}

      <div className="p-4 rounded-2xl bg-[#09080e] border border-purple-900/30 space-y-3">
        <div className="flex items-center justify-between">
          <span className="text-xs font-bold text-stone-200 flex items-center gap-1.5 font-['Outfit',sans-serif]">
            <span>💬 ส่งกำลังใจให้เพื่อน</span>
          </span>
          <span className="text-[11px] text-rose-300 font-mono font-bold flex items-center gap-1">
            <Heart className="w-3 h-3 fill-rose-500 text-rose-500" />
            <span>{w.likesCount.toLocaleString()} กำลังใจ</span>
          </span>
        </div>
        {cheerMessage && (
          <div className="p-2 rounded-xl bg-purple-950/80 border border-purple-500/40 text-rose-300 text-xs text-center animate-in fade-in duration-200 flex items-center justify-center gap-1.5 font-semibold">
            <span>✨</span>
            <span>{cheerMessage}</span>
          </div>
        )}
        <div className="grid grid-cols-4 gap-2">
          {CHEERS.map((cheer) => (
            <button
              key={cheer.label}
              onClick={() => sendCheer(cheer.emoji, cheer.label)}
              className="py-2 px-1.5 rounded-xl bg-[#140f21] hover:bg-gradient-to-r hover:from-orange-500/20 hover:to-rose-500/20 border border-purple-900/30 hover:border-rose-500/40 text-stone-300 hover:text-white transition-all cursor-pointer flex flex-col items-center gap-0.5 text-center group active:scale-95"
            >
              <span className="text-base group-hover:scale-110 transition-transform">{cheer.emoji}</span>
              <span className="text-[10px] text-stone-400 group-hover:text-rose-200">{cheer.label}</span>
            </button>
          ))}
        </div>
      </div>

      {w.externalLink && (
        <a
          href={w.externalLink}
          target="_blank"
          rel="noreferrer"
          className="p-3.5 rounded-2xl bg-gradient-to-r from-orange-950/30 via-[#151025] to-purple-950/30 border border-rose-500/30 text-rose-300 hover:border-rose-400/50 flex items-center justify-between transition-all cursor-pointer group"
        >
          <div className="flex items-center gap-2.5">
            <span className="w-8 h-8 rounded-xl bg-[#09080e] border border-rose-500/30 flex items-center justify-center text-sm">🔗</span>
            <div>
              <div className="text-xs font-bold text-stone-200 group-hover:text-rose-200 transition-colors">
                เยี่ยมชมเว็บไซต์ / โซเชียลมีเดียของเพื่อน
              </div>
              <div className="text-[10px] text-stone-400 truncate max-w-[220px]">{w.externalLink}</div>
            </div>
          </div>
          <ExternalLink className="w-4 h-4 text-rose-400 group-hover:translate-x-0.5 transition-transform" />
        </a>
      )}

      {w.status === 'for_resale' && (
        <div className="p-3.5 rounded-2xl bg-gradient-to-r from-orange-950/40 to-[#0e0b18] border border-orange-500/40 flex items-center justify-between gap-3">
          <div>
            <span className="text-[10px] uppercase font-bold text-orange-400 block tracking-wider">
              🏷️ หน้าต่างนี้เปิดขายต่อ (Resale)
            </span>
            <span className="text-xs text-stone-300 font-light">คุณสามารถรับช่วงต่อสิทธิ์หน้าต่างนี้จากเพื่อนได้</span>
          </div>
          <div className="text-right shrink-0">
            <span className="text-base font-bold font-mono text-orange-300 block">฿{w.resalePrice?.toLocaleString()}</span>
          </div>
        </div>
      )}
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
}: WindowDetailModalProps & { windowItem: WindowItem }) {
  const [showCitizenId, setShowCitizenId] = useState(false)
  const [showPhone, setShowPhone] = useState(false)
  const [resaleFormOpen, setResaleFormOpen] = useState(false)
  useEffect(() => {
    setShowCitizenId(false)
    setShowPhone(false)
  }, [w.id])

  const edit = getEditAvailability(w)
  const holding = getHoldingPeriod(w)
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
          <span className="font-mono text-emerald-400 font-bold">500 ฿ (ตลอดชีพ)</span>
        </div>
      </div>

      {isForResale && w.resalePrice && (
        <div className="p-3.5 rounded-xl bg-gradient-to-r from-orange-950/30 via-[#151025] to-purple-950/30 border border-rose-500/30 space-y-2 text-xs">
          <div className="flex items-center justify-between text-rose-300 font-bold">
            <span>💰 ประมาณการรายได้จากการขายต่อบานนี้:</span>
            <span className="font-mono text-[10px] px-1.5 py-0.5 rounded bg-purple-950 text-purple-200">หักค่าคอม 5%</span>
          </div>
          <div className="space-y-1 font-mono text-[11px]">
            <div className="flex justify-between text-stone-400">
              <span>ราคาขายต่อที่ตั้งไว้:</span>
              <span className="text-stone-200 font-bold">฿{w.resalePrice.toLocaleString()}</span>
            </div>
            <div className="flex justify-between text-rose-400">
              <span>ค่าคอมมิชชั่นระบบ (5%):</span>
              <span>-฿{commissionOf(w.resalePrice).toLocaleString()}</span>
            </div>
            <div className="flex justify-between text-emerald-300 font-bold pt-1 border-t border-purple-900/30 text-xs">
              <span>ยอดเงินโอนเข้ากระเป๋าคุณสุทธิ (95%):</span>
              <span>฿{(w.resalePrice - commissionOf(w.resalePrice)).toLocaleString()}</span>
            </div>
          </div>
        </div>
      )}

      <div className="p-3.5 rounded-xl bg-[#09080e] border border-purple-900/30 text-xs space-y-2.5">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-1.5 font-medium text-stone-200">
            <Calendar className="w-4 h-4 text-rose-400" />
            <span>สิทธิ์แก้ไขรูปภาพและข้อความ</span>
          </div>
          <span className="text-[10px] text-stone-400 font-mono">(1 ครั้ง / 24 ชม.)</span>
        </div>
        {edit.canUpdate ? (
          <div className="flex items-center gap-2 p-2 rounded-lg bg-emerald-950/40 border border-emerald-800/40 text-emerald-300">
            <Check className="w-4 h-4 shrink-0 text-emerald-400" />
            <span className="text-[11px] leading-tight font-light">พร้อมให้แก้ไขรูปภาพและข้อความของวันนี้ได้แล้ว!</span>
          </div>
        ) : (
          <div className="flex items-center gap-2 p-2 rounded-lg bg-purple-950/30 border border-purple-800/30 text-rose-300">
            <Clock className="w-4 h-4 shrink-0 text-rose-400" />
            <span className="text-[11px] leading-tight font-light">
              แก้ไขครั้งถัดไปได้ในอีก{' '}
              <strong className="font-mono text-rose-200 font-bold">
                {edit.hoursRemaining} ชม. {edit.minutesRemaining} นาที
              </strong>
            </span>
          </div>
        )}
        <div className="pt-1 flex flex-col gap-2">
          <button
            onClick={() => onOpenEditor(w)}
            disabled={!edit.canUpdate}
            className={`w-full py-2.5 px-3 text-xs font-semibold rounded-xl flex items-center justify-center gap-2 transition-all cursor-pointer ${edit.canUpdate ? 'bg-gradient-to-r from-orange-500 via-rose-500 to-purple-600 text-white shadow-md hover:opacity-95' : 'bg-[#140f21] text-stone-500 cursor-not-allowed border border-purple-900/30'}`}
          >
            <Camera className="w-4 h-4" />
            <span>แก้ไขรูปภาพ / ข้อความบานของคุณ</span>
          </button>
          {!edit.canUpdate && (
            <button
              onClick={() => onSimulatePass24Hours(w.id)}
              className="w-full py-1.5 px-2.5 text-[10px] text-stone-400 hover:text-rose-300 bg-[#120f1e] hover:bg-[#181329] border border-dashed border-purple-900/40 rounded-lg flex items-center justify-center gap-1.5 transition-colors cursor-pointer"
              title="เร่งเวลา 24 ชั่วโมงทันทีเพื่อทดสอบระบบแก้ไข"
            >
              <FastForward className="w-3 h-3 text-rose-400" />
              <span>ทดสอบข้ามเวลา 24 ชั่วโมง (ปลดล็อกสิทธิ์แก้ไขทันที)</span>
            </button>
          )}
        </div>
      </div>

      <div className="space-y-2">
        {!holding.isEligible && (
          <div className="p-3 rounded-xl bg-purple-950/40 border border-purple-500/50 text-rose-200 text-xs space-y-1.5">
            <div className="flex items-center gap-1.5 font-bold text-rose-300">
              <Clock className="w-4 h-4 text-rose-400 shrink-0" />
              <span>เงื่อนไขข้อ 1: ต้องถือครองไม่ต่ำกว่า 1 เดือนขึ้นไป (30 วัน)</span>
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
                  {holding.isEligible ? 'ตั้งราคาเปิดขายต่อให้ผู้อื่น' : `เปิดขายต่อ (ถือครอง ${holding.daysHeld}/30 วัน)`}
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
  const [priceInput, setPriceInput] = useState('1500')
  const cap = getPriceCap(windowItem)
  const price = parseFloat(priceInput) || 0
  const overCap = cap.maxAllowedPrice !== null && price > cap.maxAllowedPrice

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault()
        if (!isEligible) {
          alert('ตามเงื่อนไขข้อ 1: เจ้าของจะต้องถือครองหน้าต่างบานนี้ไม่ต่ำกว่า 1 เดือนขึ้นไป (30 วัน) จึงจะสามารถขายต่อได้')
          return
        }
        const value = parseInt(priceInput, 10)
        if (isNaN(value) || value < MIN_RESALE_PRICE) return
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
            min={MIN_RESALE_PRICE}
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
            <span className="font-bold">5%</span>
          </div>
          <div className="flex justify-between text-stone-400">
            <span>• ค่าคอมมิชชั่นเข้าระบบ (5%):</span>
            <span className="text-rose-400 font-bold">฿{commissionOf(price).toLocaleString()}</span>
          </div>
          <div className="flex justify-between text-stone-300 font-medium">
            <span>• คุณจะได้รับเงินสุทธิ (95%):</span>
            <span className="text-emerald-400 font-bold">฿{(price - commissionOf(price)).toLocaleString()}</span>
          </div>
        </div>
      )}

      <button
        type="submit"
        disabled={overCap || price < MIN_RESALE_PRICE || !isEligible}
        className="w-full py-2.5 px-3 text-xs font-semibold rounded-xl bg-gradient-to-r from-orange-500 via-rose-500 to-purple-600 hover:opacity-95 text-white cursor-pointer shadow-md transition-all"
      >
        ยืนยันเปิดขายต่อบานนี้
      </button>
    </form>
  )
}
