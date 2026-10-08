import { useEffect, useMemo, useRef, useState } from 'react'
import { ArrowLeft, ArrowUp, LayoutGrid, Search, X } from 'lucide-react'
import type { RegionId, StatusCounts, StatusFilter, User, WindowItem, ZoomLevel } from '@shared/types'
import { REGIONS_BY_ID } from '@shared/regions'
import { isPromoSlot, promoGridPositions } from '@/lib/promo'
import { likesToday } from '@shared/windowBadges'
import { WindowTile } from './WindowTile'

interface WindowGridProps {
  windows: WindowItem[]
  selectedWindow: WindowItem | null
  onSelectWindow: (window: WindowItem) => void
  zoomLevel: ZoomLevel
  setZoomLevel: (zoom: ZoomLevel) => void
  totalCount: number
  activeRegion: RegionId
  onSelectRegion: (region: RegionId) => void
  statusFilter: StatusFilter
  setStatusFilter: (filter: StatusFilter) => void
  searchQuery: string
  setSearchQuery: (query: string) => void
  currentUser: User | null
  counts: StatusCounts
  /** Most-liked windows today, shown as a quick-jump strip. */
  hotTop?: WindowItem[]
}

const GRID_CLASSES: Record<ZoomLevel, string> = {
  compact:
    'grid grid-cols-8 sm:grid-cols-12 md:grid-cols-16 lg:grid-cols-20 gap-1 sm:gap-1.5 p-1.5 sm:p-3 bg-[#0d0a14]/90 rounded-2xl border border-purple-950/60 shadow-2xl',
  medium: 'grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-2.5 sm:gap-3.5',
  large: 'grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3.5 sm:gap-5',
}

const EFFECT_FILTERS = [
  { id: 'fx_hot', label: '🔥 ฮอต', activeClass: 'bg-orange-500/20 text-orange-300 border border-orange-500/40' },
  { id: 'fx_new', label: '✨ ใหม่', activeClass: 'bg-rose-500/20 text-rose-300 border border-rose-500/40' },
  { id: 'fx_daily', label: '🟢 อัปเดตวันนี้', activeClass: 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40' },
  { id: 'fx_star', label: '⭐ ดัง', activeClass: 'bg-purple-500/20 text-purple-300 border border-purple-500/40' },
] as const

/** Keeps track of how many columns the CSS grid currently renders. */
function useGridColumnCount(deps: unknown[]) {
  const gridRef = useRef<HTMLDivElement>(null)
  const [columns, setColumns] = useState(20)
  useEffect(() => {
    const grid = gridRef.current
    if (!grid) return
    const measure = () => {
      const count = getComputedStyle(grid).gridTemplateColumns.split(' ').filter(Boolean).length
      if (count > 0) setColumns(count)
    }
    measure()
    const observer = new ResizeObserver(measure)
    observer.observe(grid)
    return () => observer.disconnect()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps)
  return { gridRef, columns }
}

export function WindowGrid({
  windows,
  selectedWindow,
  onSelectWindow,
  zoomLevel,
  setZoomLevel,
  totalCount,
  activeRegion,
  onSelectRegion,
  statusFilter,
  setStatusFilter,
  searchQuery,
  setSearchQuery,
  currentUser,
  counts,
  hotTop = [],
}: WindowGridProps) {
  const { gridRef, columns } = useGridColumnCount([zoomLevel, activeRegion, windows.length])

  // On the full, unfiltered board the promo windows are moved into this round's shape.
  const arrangedWindows = useMemo(() => {
    if (windows.length !== totalCount || !windows.some((w) => isPromoSlot(w.id))) return windows
    const positions = promoGridPositions(columns, windows.length)
    const promoByIndex = new Map<number, WindowItem>()
    windows
      .filter((w) => isPromoSlot(w.id))
      .forEach((w) => {
        const index = positions.get(w.id)
        if (index !== undefined) promoByIndex.set(index, w)
      })
    const others = windows.filter((w) => !isPromoSlot(w.id))
    let next = 0
    return windows.map((_, index) => promoByIndex.get(index) ?? others[next++])
  }, [windows, totalCount, columns])

  const region = REGIONS_BY_ID[activeRegion]
  const isThailandBoard = region.isCoreHeart

  const jumpToWindow = (window: WindowItem) => {
    setStatusFilter('all')
    setSearchQuery('')
    setTimeout(() => {
      document.getElementById(`window-${window.id}`)?.scrollIntoView({ behavior: 'smooth', block: 'center' })
      setTimeout(() => onSelectWindow(window), 500)
    }, 60)
  }

  const statusButton = (filter: StatusFilter, label: string, activeClass: string) => (
    <button
      onClick={() => setStatusFilter(filter)}
      className={`px-2.5 py-1 rounded-lg transition-all cursor-pointer whitespace-nowrap ${statusFilter === filter ? activeClass : 'text-stone-400 hover:text-stone-200'}`}
    >
      {label}
    </button>
  )

  const zoomButton = (zoom: ZoomLevel, label: string, title: string, extraClass = '') => (
    <button
      onClick={() => setZoomLevel(zoom)}
      title={title}
      className={`${extraClass} px-2 py-0.5 rounded cursor-pointer transition-colors ${zoomLevel === zoom ? 'bg-gradient-to-r from-orange-500 to-rose-500 text-white font-semibold' : 'text-stone-400 hover:text-stone-200'}`}
    >
      {label}
    </button>
  )

  return (
    <div className="max-w-7xl mx-auto px-2 sm:px-4 lg:px-8 py-2 sm:py-5 relative font-['Plus_Jakarta_Sans','Prompt',sans-serif]">
      {statusFilter !== 'all' && (
        <div className="sm:hidden mb-2.5 px-3 py-1.5 rounded-xl bg-purple-950/50 border border-rose-500/40 flex items-center justify-between text-xs text-rose-200">
          <span>
            กำลังกรอง:{' '}
            <strong className="text-rose-300">{statusFilter === 'follow' ? 'กำลังติดตาม' : statusFilter}</strong>
          </span>
          <button onClick={() => setStatusFilter('all')} className="text-stone-400 hover:text-stone-200 underline text-[11px]">
            ล้างตัวกรอง
          </button>
        </div>
      )}

      {!isThailandBoard && (
        <div className="hidden sm:flex mb-3.5 px-3.5 py-2.5 rounded-xl bg-[#140f21] border border-purple-500/40 items-center justify-between gap-3 text-xs">
          <div className="flex items-center gap-2 text-stone-200">
            <span>{region.icon}</span>
            <span className="font-bold text-rose-300">หน้าต่าง{region.name} 500 บาน</span>
            <span className="text-stone-400">· {region.description}</span>
          </div>
          <button
            onClick={() => onSelectRegion('thailand')}
            className="flex items-center gap-1.5 px-3 py-1 bg-gradient-to-r from-orange-500 to-rose-500 hover:opacity-95 text-white font-semibold rounded-lg transition-all cursor-pointer shrink-0 shadow-sm"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            <span>กลับสู่หน้าต่างประเทศไทย 500 บาน</span>
          </button>
        </div>
      )}

      <div className="hidden sm:flex flex-wrap items-center justify-between gap-2.5 pb-3 border-b border-stone-850/80 text-xs">
        <div className="flex items-center gap-1 p-0.5 bg-[#120f1c]/90 rounded-xl border border-stone-800 overflow-x-auto scrollbar-none">
          {statusButton('all', `ทั้งหมด (${counts.all})`, 'bg-gradient-to-r from-orange-500 to-rose-500 text-white font-semibold shadow-xs')}
          {statusButton('available', `ว่าง (${counts.available})`, 'bg-rose-500/20 text-rose-300 border border-rose-500/40 font-semibold')}
          {statusButton('for_resale', `เปิดขายต่อ (${counts.for_resale})`, 'bg-orange-500/20 text-orange-300 border border-orange-500/40 font-semibold')}
          {statusButton('occupied', `มีภาพแล้ว (${counts.occupied})`, 'bg-purple-500/20 text-purple-300 border border-purple-500/40 font-semibold')}
          {currentUser &&
            statusButton('my', `บานของฉัน (${counts.my})`, 'bg-gradient-to-r from-rose-500 to-purple-600 text-white font-semibold')}
          {currentUser && (
            <button
              title="รวมทุกภูมิภาค"
              onClick={() => setStatusFilter('follow')}
              className={`px-2.5 py-1 rounded-lg transition-all cursor-pointer whitespace-nowrap ${statusFilter === 'follow' ? 'bg-gradient-to-r from-rose-500 to-purple-600 text-white font-semibold' : 'text-stone-400 hover:text-stone-200'}`}
            >
              🔔 กำลังติดตาม ({counts.follow || 0})
            </button>
          )}
        </div>

        <div className="flex items-center gap-1 p-0.5 bg-[#120f1c]/90 rounded-xl border border-stone-800 overflow-x-auto scrollbar-none">
          {EFFECT_FILTERS.map((f) => (
            <button
              key={f.id}
              onClick={() => setStatusFilter(statusFilter === f.id ? 'all' : f.id)}
              className={`px-2.5 py-1 rounded-lg transition-all cursor-pointer whitespace-nowrap ${statusFilter === f.id ? `${f.activeClass} font-semibold` : 'text-stone-400 hover:text-stone-200'}`}
            >
              {f.label} ({counts[f.id] ?? 0})
            </button>
          ))}
        </div>

        <div className="flex items-center gap-2 ml-auto">
          <div className="relative">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-stone-500" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="ค้นหาบาน..."
              className="w-28 sm:w-40 bg-[#120f1c] border border-stone-800 text-stone-200 text-xs pl-8 pr-6 py-1 rounded-lg focus:outline-none focus:border-rose-400 font-mono"
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery('')}
                className="absolute right-2 top-1/2 -translate-y-1/2 text-stone-400 hover:text-stone-200 cursor-pointer"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>
          <div className="flex items-center p-0.5 bg-[#120f1c] rounded-lg border border-stone-800 text-xs font-medium">
            {zoomButton('compact', '500 บานเต็มจอ', 'แสดง 500 บานเต็มหน้าจอ')}
            {zoomButton('medium', 'มาตรฐาน', 'ขนาดมาตรฐาน')}
            {zoomButton('large', 'ขยาย', 'ขยายใหญ่', 'hidden sm:inline')}
          </div>
        </div>
      </div>

      {hotTop.length > 0 && (
        <div className="hidden sm:block mt-3 mb-1 rounded-xl border border-rose-500/30 bg-[#160f1f]/60 px-3 py-2">
          <div className="flex items-center gap-2 text-[11px] text-rose-300 font-semibold mb-1.5">
            <span>🔥 ฮอตวันนี้ Top {hotTop.length}</span>
            <span className="text-stone-500 font-normal">ไลค์ในวันนี้ตามเวลาไทย · คลิกเพื่อเลื่อนไปที่บาน</span>
          </div>
          <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-none">
            {hotTop.map((w, rank) => (
              <button
                key={`${w.region}-${w.id}`}
                onClick={() => jumpToWindow(w)}
                className="shrink-0 flex items-center gap-2 pl-1.5 pr-2.5 py-1 rounded-lg bg-[#110e19] border border-stone-800 hover:border-rose-400 transition-colors cursor-pointer"
                title={w.title}
              >
                <span className="text-[10px] font-mono text-orange-400 font-bold w-3 text-center">{rank + 1}</span>
                <img src={w.imageUrl} alt="" className="w-7 h-7 rounded object-cover" />
                <span className="text-[11px] text-stone-200 max-w-[110px] truncate">{w.title}</span>
                <span className="text-[10px] font-mono text-rose-400">♥ {likesToday(w)}</span>
              </button>
            ))}
          </div>
        </div>
      )}

      <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-[10px] text-stone-400 px-1 mt-1">
        <span className="flex items-center gap-1"><span>🔥</span> ฮอต: ไลค์วันนี้ ≥ 10</span>
        <span className="flex items-center gap-1"><span>✨</span> ใหม่ / 🤝 เจ้าของใหม่ (72 ชม.)</span>
        <span className="flex items-center gap-1"><span className="fx-dot" /> อัปเดตวันนี้</span>
        <span className="flex items-center gap-1"><span>⭐</span> หัวใจหรือผู้ติดตาม ≥ 1,000</span>
        <span className="flex items-center gap-1 text-rose-400/90"><span>🛡️</span> โควตาจำกัดไม่เกิน 2 บาน (ไทย 1 + ภูมิภาค 1)</span>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-2 text-[11px] text-stone-400 my-2 px-1">
        <div className="flex items-center gap-1.5">
          <LayoutGrid className="w-3.5 h-3.5 text-rose-400" />
          <span>
            แสดง <strong className="text-rose-300 font-mono font-semibold">{windows.length}</strong>
            {statusFilter === 'follow' ? (
              ' บานที่คุณติดตาม (รวมทุกภูมิภาค)'
            ) : (
              <>
                {' '}บาน จากทั้งหมด <span className="font-mono">{totalCount}</span> บาน
              </>
            )}
          </span>
        </div>
        {zoomLevel === 'compact' && (
          <span className="hidden sm:inline text-stone-500">* คลิกที่ช่องใดก็ได้เพื่อเปิดดูภาพและเรื่องราวเต็ม</span>
        )}
      </div>

      {windows.length === 0 ? (
        <div className="py-20 text-center max-w-md mx-auto px-4">
          <div className="w-12 h-12 rounded-full bg-stone-900 border border-stone-800 flex items-center justify-center mx-auto mb-3 text-stone-400">
            <Search className="w-6 h-6" />
          </div>
          <h3 className="text-base font-semibold text-stone-200">
            {statusFilter === 'follow' ? 'ยังไม่มีบานที่ติดตาม' : 'ไม่พบบานหน้าต่างตามเงื่อนไขที่เลือก'}
          </h3>
          <p className="text-xs text-stone-400 mt-1 leading-relaxed">
            {statusFilter === 'follow'
              ? 'กดปุ่ม «ติดตาม» ในหน้ารายละเอียดของบานที่สนใจ แล้วบานนั้นจะมาอยู่ที่นี่ (รวมทุกภูมิภาค)'
              : `ลองปรับเปลี่ยนคำค้นหา หรือรีเซ็ตตัวกรองเพื่อดูหน้าต่างบานอื่นในทั้งหมด ${totalCount} บาน`}
          </p>
        </div>
      ) : (
        <div ref={gridRef} className={GRID_CLASSES[zoomLevel]}>
          {arrangedWindows.map((w) => (
            <WindowTile
              key={`${w.region}-${w.id}`}
              windowItem={w}
              zoomLevel={zoomLevel}
              isSelected={selectedWindow?.id === w.id && selectedWindow?.region === w.region}
              onSelect={onSelectWindow}
              currentUser={currentUser}
              showRegion={statusFilter === 'follow'}
            />
          ))}
        </div>
      )}

      <button
        onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}
        className="fixed bottom-20 sm:bottom-6 right-6 z-30 p-2.5 bg-[#120f1c]/90 hover:bg-stone-800 text-stone-300 hover:text-rose-300 border border-purple-900/60 rounded-full shadow-xl transition-all cursor-pointer backdrop-blur"
        title="กลับขึ้นด้านบน"
      >
        <ArrowUp className="w-4 h-4" />
      </button>
    </div>
  )
}
