import { Heart, Lock, Plus, ShoppingBag, Tag, Users } from 'lucide-react'
import type { User, WindowItem, ZoomLevel } from '@shared/types'
import { REGIONS_BY_ID } from '@shared/regions'
import { followerCount, highlightClass, highlightLabel, todaysNote } from '@shared/windowBadges'
import { adForSlot, isPromoSlot, safeHttpUrl, safeImageUrl, type PromoAd } from '@/lib/promo'
import { HighlightPill, HotSparks, StarBadge } from './WindowBadges'

interface WindowTileProps {
  windowItem: WindowItem
  zoomLevel: ZoomLevel
  isSelected: boolean
  onSelect: (window: WindowItem) => void
  currentUser: User | null
  /** Prefix the slot number with the region icon (used in the cross-region "following" view). */
  showRegion?: boolean
}

export function WindowTile({ windowItem, zoomLevel, isSelected, onSelect, currentUser, showRegion }: WindowTileProps) {
  const ad = isPromoSlot(windowItem.id) ? adForSlot(windowItem.id) : null
  if (ad) return <PromoAdTile windowItem={windowItem} ad={ad} zoomLevel={zoomLevel} onSelect={onSelect} />

  if (isPromoSlot(windowItem.id) && windowItem.status === 'available') {
    return <PromoPlaceholderTile windowItem={windowItem} zoomLevel={zoomLevel} isSelected={isSelected} onSelect={onSelect} />
  }

  const props = { windowItem, isSelected, onSelect, currentUser, showRegion }
  return zoomLevel === 'compact' ? <CompactTile {...props} /> : <CardTile {...props} zoomLevel={zoomLevel} />
}

function getTileInfo(windowItem: WindowItem, currentUser: User | null) {
  const isMine = !!currentUser && windowItem.ownerId === currentUser.id
  const isFollowed = !!currentUser && !!windowItem.followerIds?.includes(currentUser.id)
  return {
    isMine,
    isFollowed,
    isAvailable: windowItem.status === 'available',
    isForResale: windowItem.status === 'for_resale',
    isOccupied: windowItem.status === 'occupied',
    code: windowItem.code || `#${windowItem.id.toString().padStart(3, '0')}`,
    slot: windowItem.slotPosition || windowItem.id,
    effectClass: highlightClass(windowItem),
    label: highlightLabel(windowItem),
  }
}

function PromoAdTile({
  windowItem,
  ad,
  zoomLevel,
  onSelect,
}: {
  windowItem: WindowItem
  ad: PromoAd
  zoomLevel: ZoomLevel
  onSelect: (window: WindowItem) => void
}) {
  const link = safeHttpUrl(ad.link)
  const image = safeImageUrl(ad.image)
  const compact = zoomLevel === 'compact'
  return (
    <button
      onClick={() => (link ? window.open(link, '_blank', 'noopener,noreferrer') : onSelect(windowItem))}
      id={`window-${windowItem.id}`}
      title={`${ad.brand}${ad.tagline ? ` · ${ad.tagline}` : ''} (โปรโมท)`}
      className={`relative overflow-hidden rounded-lg border border-amber-300/60 bg-gradient-to-br from-orange-400 to-fuchsia-500 text-white cursor-pointer hover:brightness-110 transition ${compact ? 'aspect-square' : 'min-h-[110px]'}`}
    >
      {image && <img src={image} alt="" className="absolute inset-0 h-full w-full object-cover" />}
      <span className="absolute left-0 top-0 rounded-br bg-black/60 px-1 text-[8px] font-bold tracking-wide">AD</span>
      <span className="absolute bottom-0 right-0 rounded-tl bg-black/60 px-1 font-mono text-[9px]">{windowItem.id}</span>
      {!image && (
        <span className="absolute inset-0 flex items-center justify-center p-1 text-center text-[10px] font-bold leading-tight font-['Prompt',sans-serif]">
          {compact ? ad.brand.slice(0, 2) : ad.brand}
        </span>
      )}
    </button>
  )
}

function PromoPlaceholderTile({
  windowItem,
  zoomLevel,
  isSelected,
  onSelect,
}: {
  windowItem: WindowItem
  zoomLevel: ZoomLevel
  isSelected: boolean
  onSelect: (window: WindowItem) => void
}) {
  const compact = zoomLevel === 'compact'
  return (
    <button
      onClick={() => onSelect(windowItem)}
      id={`window-${windowItem.id}`}
      title={`หน้าต่าง ${windowItem.id} · ล็อกไว้เป็นพื้นที่โปรโมท`}
      className={`relative flex flex-col items-center justify-center gap-0.5 rounded-lg border border-amber-400/40 bg-gradient-to-br from-amber-500/15 to-fuchsia-500/15 text-amber-200 cursor-pointer hover:border-amber-300/70 transition-colors ${compact ? 'aspect-square' : 'min-h-[110px] p-3'} ${isSelected ? 'ring-2 ring-amber-300' : ''}`}
    >
      <Lock className={compact ? 'h-3 w-3' : 'h-5 w-5'} />
      <span className={`font-mono ${compact ? 'text-[9px]' : 'text-sm font-bold'}`}>{windowItem.id}</span>
      {!compact && <span className="text-[11px] font-['Prompt',sans-serif]">พื้นที่โปรโมท</span>}
    </button>
  )
}

type TileProps = Omit<WindowTileProps, 'zoomLevel'>

/** Small square used by the "500 บานเต็มจอ" view. */
function CompactTile({ windowItem, isSelected, onSelect, currentUser, showRegion }: TileProps) {
  const t = getTileInfo(windowItem, currentUser)
  const status = t.isAvailable
    ? 'ว่าง 500฿'
    : t.isForResale
      ? `เปิดขายต่อ ฿${windowItem.resalePrice?.toLocaleString()}`
      : t.isMine
        ? 'บานของฉัน'
        : windowItem.ownerName
  const ringClass = isSelected
    ? 'ring-2 ring-rose-400 border-rose-300 scale-125 z-20 shadow-lg shadow-rose-500/30'
    : t.isMine
      ? 'ring-1.5 ring-purple-400 border-purple-500'
      : 'border-stone-800/80 hover:border-rose-400/80 hover:scale-110 hover:z-10'

  return (
    <button
      onClick={() => onSelect(windowItem)}
      id={`window-${windowItem.id}`}
      title={`หน้าต่าง ${t.code} · ตำแหน่ง ${t.slot} - ${windowItem.title} (${status})${t.label ? ` · ${t.label}` : ''}`}
      className={`relative group aspect-square rounded-sm overflow-hidden border transition-all cursor-pointer font-['Plus_Jakarta_Sans','Prompt',sans-serif] ${t.effectClass} ${t.isFollowed && !t.isMine && !isSelected ? 'kap-followed' : ''} ${ringClass} ${t.isAvailable ? 'bg-stone-900/60 hover:bg-stone-850' : 'bg-[#100d17]'}`}
    >
      {t.isAvailable ? (
        <div className="w-full h-full flex flex-col items-center justify-center p-0.5 text-stone-500 group-hover:text-rose-300 transition-colors">
          <span className="text-[9px] font-mono leading-none">{windowItem.id}</span>
          <span className="text-[7px] text-rose-400/90 font-mono mt-0.5 font-medium">ว่าง</span>
        </div>
      ) : (
        <>
          <img
            src={windowItem.imageUrl}
            alt={windowItem.title}
            className="w-full h-full object-cover group-hover:brightness-110 transition-all duration-200"
            loading="lazy"
          />
          <div className="absolute top-0 left-0 right-0 bg-stone-950/80 px-1 py-0.5 flex items-center justify-between text-[7px] font-mono text-stone-300">
            <span>{showRegion ? `${REGIONS_BY_ID[windowItem.region]?.icon || ''}${windowItem.id}` : windowItem.id}</span>
            {t.isForResale && <span className="text-orange-400 font-bold">฿</span>}
            {t.isMine && <span className="text-purple-300 font-bold">ฉัน</span>}
            {t.isFollowed && !t.isMine && (
              <span className="kap-follow-dot" title="กำลังติดตาม">●</span>
            )}
          </div>
          <div className="absolute inset-0 bg-purple-950/20 opacity-0 group-hover:opacity-100 transition-opacity" />
          <StarBadge windowItem={windowItem} size={13} className="top-[13px] right-0.5" />
          <HotSparks windowItem={windowItem} />
          <HighlightPill windowItem={windowItem} compact />
        </>
      )}
    </button>
  )
}

/** Card with header, image and footer used by the "มาตรฐาน" and "ขยาย" views. */
function CardTile({ windowItem, zoomLevel, isSelected, onSelect, currentUser }: TileProps & { zoomLevel: ZoomLevel }) {
  const t = getTileInfo(windowItem, currentUser)
  const note = todaysNote(windowItem)
  const followers = followerCount(windowItem)
  const borderClass = isSelected
    ? 'ring-2 ring-rose-500 border-rose-400 shadow-xl shadow-rose-500/20 scale-[1.02] z-20'
    : t.isMine
      ? 'border-purple-500/80 bg-[#140f21]/90 shadow-md shadow-purple-950/30 hover:border-purple-400'
      : 'border-stone-800/90 bg-[#110e19]/90 hover:border-rose-500/60 hover:bg-[#161224] hover:shadow-lg'
  const ownerTitle = t.isAvailable
    ? 'พร้อมให้จับจอง'
    : windowItem.previousOwnerId
      ? `เจ้าของ: ${windowItem.ownerName} (อ้างอิง ID เดิม: ${windowItem.previousOwnerId})`
      : windowItem.ownerName

  return (
    <div
      id={`window-${windowItem.id}`}
      onClick={() => onSelect(windowItem)}
      className={`group relative flex flex-col rounded-xl overflow-hidden border transition-all duration-200 cursor-pointer font-['Plus_Jakarta_Sans','Prompt',sans-serif] ${t.effectClass} ${t.isFollowed && !t.isMine && !isSelected ? 'kap-followed' : ''} ${borderClass}`}
    >
      <div className="flex items-center justify-between px-2.5 py-1.5 bg-[#0c0a12]/95 border-b border-stone-800/80 text-xs">
        <div className="flex items-center gap-1.5 font-mono text-stone-300 font-semibold">
          <span className="text-rose-400 font-['Outfit',sans-serif]">{t.code}</span>
          <span
            className="text-[10px] text-stone-400 font-normal px-1.5 py-0.2 rounded bg-stone-900 border border-stone-800"
            title="ตำแหน่งจัดวางบนหน้าต่างในรอบปัจจุบัน"
          >
            ตำแหน่ง #{t.slot}
          </span>
          {t.isMine && (
            <span className="px-1.5 py-0.2 text-[10px] bg-purple-950 text-purple-300 border border-purple-600/50 rounded font-bold">
              บานของฉัน
            </span>
          )}
          {t.isFollowed && !t.isMine && (
            <span className="px-1.5 py-0.2 text-[10px] bg-purple-950 text-purple-300 border border-purple-600/50 rounded font-bold">
              🔔 กำลังติดตาม
            </span>
          )}
        </div>
        {t.isAvailable && <span className="text-[11px] text-rose-300 font-medium">ว่าง 500฿</span>}
        {t.isForResale && (
          <span className="text-[11px] text-orange-300 font-mono font-bold flex items-center gap-0.5">
            <Tag className="w-3 h-3 text-orange-400" />
            <span>฿{windowItem.resalePrice?.toLocaleString()}</span>
          </span>
        )}
        {t.isOccupied && windowItem.province && (
          <span className="text-[11px] text-stone-400 truncate max-w-[80px]">{windowItem.province}</span>
        )}
      </div>

      <div className="relative aspect-[4/3] bg-stone-950 overflow-hidden flex items-center justify-center">
        {t.isAvailable ? (
          <div className="w-full h-full p-4 flex flex-col items-center justify-center text-center bg-radial from-[#181326] to-[#09080e] border border-dashed border-stone-800 hover:border-rose-500/50 transition-colors">
            <div className="w-10 h-10 rounded-full bg-stone-800/80 group-hover:bg-rose-500/20 text-stone-400 group-hover:text-rose-300 flex items-center justify-center transition-colors mb-2">
              <Plus className="w-5 h-5" />
            </div>
            <span className="text-xs font-medium text-stone-300 group-hover:text-rose-200">จับจองบานนี้</span>
            <span className="text-[11px] text-stone-500 font-mono mt-0.5">500 ฿ (ตลอดชีพ)</span>
          </div>
        ) : (
          <>
            <img
              src={windowItem.imageUrl}
              alt={windowItem.title}
              className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
              loading="lazy"
            />
            <div className="absolute inset-0 pointer-events-none border border-black/30 shadow-[inset_0_0_10px_rgba(0,0,0,0.6)]" />
            <StarBadge windowItem={windowItem} size={zoomLevel === 'large' ? 26 : 20} className="top-1.5 right-1.5" />
            <HotSparks windowItem={windowItem} />
            <HighlightPill windowItem={windowItem} />
            {t.isForResale && (
              <div className="absolute bottom-2 left-2 bg-[#0c0a12]/95 border border-orange-500/60 px-2 py-0.5 rounded text-xs font-mono font-bold text-orange-300 shadow flex items-center gap-1">
                <ShoppingBag className="w-3 h-3 text-orange-400" />
                <span>เปิดขายต่อ ฿{windowItem.resalePrice?.toLocaleString()}</span>
              </div>
            )}
          </>
        )}
      </div>

      <div className="p-2.5 flex flex-col gap-1 text-left flex-1 justify-between">
        <div>
          <h3 className="text-xs sm:text-sm font-semibold text-stone-200 group-hover:text-rose-200 line-clamp-1 transition-colors">
            {windowItem.title}
          </h3>
          {note && (
            <p className="text-[11px] text-emerald-300/90 line-clamp-1 mt-0.5 flex items-center gap-1.5">
              <span className="fx-dot" />
              <span className="truncate">{note}</span>
            </p>
          )}
          {zoomLevel === 'large' && (
            <p className="text-[11px] text-stone-400 line-clamp-2 mt-0.5 leading-relaxed font-light">
              {windowItem.description}
            </p>
          )}
        </div>
        <div className="flex items-center justify-between text-[11px] text-stone-400 pt-1 border-t border-stone-850/60 mt-1">
          <span className="truncate max-w-[120px]" title={ownerTitle}>
            {t.isAvailable ? 'พร้อมให้จับจอง' : windowItem.ownerName}
          </span>
          {!t.isAvailable && (
            <span className="flex items-center gap-2 font-mono text-[10px] text-stone-500">
              {followers > 0 && (
                <span className="flex items-center gap-1" title="ผู้ติดตาม">
                  <Users className="w-3.5 h-3.5 text-purple-400/80" />
                  <span>{followers.toLocaleString()}</span>
                </span>
              )}
              <span className="flex items-center gap-1">
                <Heart className="w-3.5 h-3.5 text-rose-500/80" />
                <span>{windowItem.likesCount.toLocaleString()}</span>
              </span>
            </span>
          )}
        </div>
      </div>
    </div>
  )
}
