import { Search, X } from 'lucide-react'
import type { CategoryId, Region, StatusFilter, User } from '@/types'
import { CATEGORIES, CATEGORY_IDS } from '@/data/categories'
import { LanguageToggle } from '@/i18n/LanguageToggle'

export interface BoardCounts {
  total: number
  available: number
  forResale: number
  occupied: number
}

interface SearchFilterTabProps {
  region: Region
  counts: BoardCounts
  currentUser: User | null
  followCount: number
  statusFilter: StatusFilter
  setStatusFilter: (filter: StatusFilter) => void
  categoryFilter: CategoryId | 'all'
  setCategoryFilter: (category: CategoryId | 'all') => void
  searchQuery: string
  setSearchQuery: (query: string) => void
  jumpNumber: string
  setJumpNumber: (value: string) => void
  onJumpToWindow: (windowNumber: number) => void
  /** Close the Hub after choosing a filter so the board is visible. */
  onClose: () => void
}

export function SearchFilterTab({
  region,
  counts,
  currentUser,
  followCount,
  statusFilter,
  setStatusFilter,
  categoryFilter,
  setCategoryFilter,
  searchQuery,
  setSearchQuery,
  jumpNumber,
  setJumpNumber,
  onJumpToWindow,
  onClose,
}: SearchFilterTabProps) {
  const maxNumber = region.windowCount || 500

  const pickStatus = (filter: StatusFilter) => {
    setStatusFilter(filter)
    onClose()
  }
  const pickCategory = (category: CategoryId | 'all') => {
    setCategoryFilter(category)
    onClose()
  }

  const statusButton = (filter: StatusFilter, label: string, activeClass: string, extraClass = '') => (
    <button
      onClick={() => pickStatus(filter)}
      className={`${extraClass} p-2.5 rounded-lg border text-left cursor-pointer transition-all ${statusFilter === filter ? activeClass : 'bg-stone-950 text-stone-400 border-stone-800 hover:text-stone-200'}`}
    >
      {label}
    </button>
  )

  return (
    <div className="space-y-4">
      <LanguageToggle />

      <form
        onSubmit={(e) => {
          e.preventDefault()
          const n = parseInt(jumpNumber, 10)
          if (!isNaN(n) && n >= 1 && n <= maxNumber) {
            onJumpToWindow(n)
            onClose()
          }
        }}
        className="p-4 rounded-xl bg-stone-950 border border-stone-800 space-y-2"
      >
        <label className="text-xs font-bold text-stone-200 block">วาร์ปไปยังบานที่ระบุ (1 ถึง {maxNumber}):</label>
        <div className="flex gap-2">
          <input
            type="number"
            min="1"
            max={maxNumber}
            placeholder="ใส่หมายเลขบาน # เช่น 42 หรือ 250"
            value={jumpNumber}
            onChange={(e) => setJumpNumber(e.target.value)}
            className="flex-1 bg-stone-900 border border-stone-700 text-stone-100 text-xs px-3 py-2 rounded-lg font-mono focus:outline-none focus:border-amber-400"
          />
          <button
            type="submit"
            className="px-4 py-2 bg-amber-400 hover:bg-amber-300 text-stone-950 font-bold text-xs rounded-lg cursor-pointer transition-colors"
          >
            วาร์ป
          </button>
        </div>
      </form>

      <div className="space-y-1.5">
        <label className="text-xs font-bold text-stone-300 block">ค้นหาข้อความ, ชื่อเจ้าของ หรือจังหวัด:</label>
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-stone-500" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="พิมพ์คำค้นหา..."
            className="w-full bg-stone-950 border border-stone-800 text-stone-200 text-xs pl-9 pr-8 py-2 rounded-lg focus:outline-none focus:border-amber-400"
          />
          {searchQuery && (
            <button
              onClick={() => setSearchQuery('')}
              className="absolute right-2.5 top-1/2 -translate-y-1/2 text-stone-400 hover:text-stone-200"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
      </div>

      <div className="space-y-1.5">
        <label className="text-xs font-bold text-stone-300 block">กรองตามสถานะหน้าต่าง:</label>
        <div className="grid grid-cols-2 gap-2 text-xs">
          {statusButton('all', `ทั้งหมด (${counts.total})`, 'bg-amber-500/20 text-amber-300 border-amber-500 font-bold')}
          {statusButton('available', `ว่างพร้อมจอง (${counts.available})`, 'bg-cyan-500/20 text-cyan-300 border-cyan-500 font-bold')}
          {statusButton('for_resale', `เปิดขายต่อ (${counts.forResale})`, 'bg-amber-500/20 text-amber-300 border-amber-500 font-bold')}
          {statusButton('occupied', `มีภาพแล้ว (${counts.occupied})`, 'bg-emerald-500/20 text-emerald-300 border-emerald-500 font-bold')}
          {currentUser &&
            statusButton(
              'follow',
              `🔔 กำลังติดตาม (${followCount ?? 0} · ทุกภูมิภาค)`,
              'bg-amber-500/20 text-amber-300 border-amber-500 font-bold',
              'col-span-2',
            )}
        </div>
      </div>

      <div className="space-y-1.5 pt-2 border-t border-stone-850">
        <label className="text-xs font-bold text-stone-300 block">กรองตามหมวดหมู่:</label>
        <div className="grid grid-cols-2 gap-2 text-xs">
          <button
            onClick={() => pickCategory('all')}
            className={`p-2 rounded-lg border text-left cursor-pointer ${categoryFilter === 'all' ? 'bg-stone-800 text-amber-300 border-amber-400 font-bold' : 'bg-stone-950 text-stone-400 border-stone-800'}`}
          >
            ทุกหมวดหมู่
          </button>
          {CATEGORY_IDS.map((id) => (
            <button
              key={id}
              onClick={() => pickCategory(id)}
              className={`p-2 rounded-lg border text-left cursor-pointer flex items-center gap-1.5 ${categoryFilter === id ? 'bg-stone-800 text-amber-300 border-amber-400 font-bold' : 'bg-stone-950 text-stone-400 border-stone-800'}`}
            >
              <span>{CATEGORIES[id].icon}</span>
              <span className="truncate">{CATEGORIES[id].label}</span>
            </button>
          ))}
        </div>
      </div>
    </div>
  )
}
