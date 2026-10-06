import { useMemo, useState } from 'react'
import { ImageOff, LayoutGrid, RotateCcw, Search } from 'lucide-react'
import type { RegionId, WindowItem, WindowStatus } from '@/types'
import { REGIONS, REGIONS_BY_ID } from '@/data/regions'
import { CATEGORIES } from '@/data/categories'
import { releaseWindow, takeDownContent } from '@/lib/adminStore'
import { isPromoSlot } from '@/lib/promo'
import type { AdminPageProps } from '../adminData'
import { Badge, baht, Button, Card, DataTable, inputClass, thaiDateTime } from '../ui'

const PAGE_SIZE = 25

export function StatusBadge({ window: w }: { window: WindowItem }) {
  if (isPromoSlot(w.id) && w.status === 'available') return <Badge tone="secondary">พื้นที่โปรโมท</Badge>
  if (w.status === 'available') return <Badge tone="info">ว่าง</Badge>
  if (w.status === 'for_resale') return <Badge tone="warning">ขายต่อ {baht(w.resalePrice || 0)}</Badge>
  return <Badge tone="success">มีเจ้าของ</Badge>
}

/** Ask for a reason, then run the moderation action. Returns false if cancelled. */
function confirmWithReason(question: string): string | null {
  const reason = window.prompt(question, 'ขัดต่อเงื่อนไขการใช้งานข้อ 5')
  return reason && reason.trim() ? reason.trim() : null
}

export function WindowsPage({ admin, data, refresh, notify }: AdminPageProps) {
  const [region, setRegion] = useState<RegionId | 'all'>('all')
  const [status, setStatus] = useState<WindowStatus | 'all'>('all')
  const [query, setQuery] = useState('')
  const [page, setPage] = useState(0)

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    return data.windows.filter(
      (w) =>
        (region === 'all' || w.region === region) &&
        (status === 'all' || w.status === status) &&
        (!q ||
          w.code.toLowerCase().includes(q) ||
          w.title.toLowerCase().includes(q) ||
          w.ownerName.toLowerCase().includes(q) ||
          w.province.toLowerCase().includes(q)),
    )
  }, [data.windows, region, status, query])
  const pages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE))
  const current = Math.min(page, pages - 1)
  const rows = filtered.slice(current * PAGE_SIZE, current * PAGE_SIZE + PAGE_SIZE)

  const takeDown = (w: WindowItem) => {
    const reason = confirmWithReason(`ถอดรูปและข้อความของ ${w.code}? ระบุเหตุผล:`)
    if (!reason) return
    takeDownContent(admin, w.region, w.id, reason)
    refresh()
    notify(`ถอดเนื้อหาของ ${w.code} แล้ว`)
  }
  const release = (w: WindowItem) => {
    const reason = confirmWithReason(`คืน ${w.code} เป็นบานว่าง (ยกเลิกการถือครองของ ${w.ownerName})? ระบุเหตุผล:`)
    if (!reason) return
    releaseWindow(admin, w.region, w.id, reason)
    refresh()
    notify(`คืน ${w.code} เป็นบานว่างแล้ว`)
  }

  return (
    <Card
      title={`หน้าต่างทั้งหมด (${filtered.length.toLocaleString()} บาน)`}
      icon={LayoutGrid}
      outline="primary"
      flush
      tools={
        <div className="flex flex-wrap items-center gap-2">
          <select value={region} onChange={(e) => { setRegion(e.target.value as RegionId | 'all'); setPage(0) }} className={`${inputClass} w-auto`}>
            <option value="all">ทุกภูมิภาค</option>
            {REGIONS.map((r) => (
              <option key={r.id} value={r.id}>
                {r.name}
              </option>
            ))}
          </select>
          <select value={status} onChange={(e) => { setStatus(e.target.value as WindowStatus | 'all'); setPage(0) }} className={`${inputClass} w-auto`}>
            <option value="all">ทุกสถานะ</option>
            <option value="available">ว่าง</option>
            <option value="occupied">มีเจ้าของ</option>
            <option value="for_resale">เปิดขายต่อ</option>
          </select>
          <div className="relative">
            <Search className="absolute left-2 top-1/2 -translate-y-1/2 w-4 h-4 text-[#6c757d]" />
            <input value={query} onChange={(e) => { setQuery(e.target.value); setPage(0) }} placeholder="รหัส / ชื่อ / เจ้าของ" className={`${inputClass} pl-8 w-48`} />
          </div>
        </div>
      }
      footer={
        <div className="flex items-center justify-between">
          <span className="text-[#6c757d]">
            หน้า {current + 1} / {pages}
          </span>
          <div className="flex gap-1">
            <Button size="sm" tone="secondary" outline disabled={current === 0} onClick={() => setPage(current - 1)}>
              ก่อนหน้า
            </Button>
            <Button size="sm" tone="secondary" outline disabled={current >= pages - 1} onClick={() => setPage(current + 1)}>
              ถัดไป
            </Button>
          </div>
        </div>
      }
    >
      <DataTable head={['รหัส', 'ภูมิภาค', 'ชื่อบาน', 'หมวด / จังหวัด', 'เจ้าของ', 'สถานะ', 'ถือครองเมื่อ', 'จัดการ']} empty="ไม่พบหน้าต่างตามเงื่อนไข">
        {rows.map((w) => (
          <tr key={`${w.region}-${w.id}`}>
            <td className="font-mono whitespace-nowrap">{w.code}</td>
            <td className="whitespace-nowrap">{REGIONS_BY_ID[w.region].name}</td>
            <td className="max-w-[240px] truncate" title={w.title}>
              {w.title}
            </td>
            <td className="whitespace-nowrap text-[#6c757d]">
              {CATEGORIES[w.category]?.icon} {w.province}
            </td>
            <td className="whitespace-nowrap">{w.status === 'available' ? '-' : w.ownerName}</td>
            <td>
              <StatusBadge window={w} />
            </td>
            <td className="whitespace-nowrap text-[#6c757d]">{w.status === 'available' ? '-' : thaiDateTime(w.ownerChangedAt || w.claimedAt)}</td>
            <td className="whitespace-nowrap">
              {w.status !== 'available' && (
                <div className="flex gap-1">
                  <Button size="sm" tone="warning" onClick={() => takeDown(w)} title="ถอดรูปและข้อความ">
                    <ImageOff className="w-3.5 h-3.5" /> ถอดเนื้อหา
                  </Button>
                  <Button size="sm" tone="danger" onClick={() => release(w)} title="ยกเลิกการถือครอง คืนเป็นบานว่าง">
                    <RotateCcw className="w-3.5 h-3.5" /> คืนบาน
                  </Button>
                </div>
              )}
            </td>
          </tr>
        ))}
      </DataTable>
    </Card>
  )
}

/** Recently updated content (images, texts, daily notes) for review against rule 5. */
export function ModerationPage({ admin, data, refresh, notify }: AdminPageProps) {
  const recent = useMemo(
    () =>
      data.windows
        .filter((w) => w.status !== 'available' && w.lastImageUpdatedAt)
        .sort((a, b) => new Date(b.lastImageUpdatedAt!).getTime() - new Date(a.lastImageUpdatedAt!).getTime()),
    [data.windows],
  )

  const takeDown = (w: WindowItem) => {
    const reason = confirmWithReason(`ถอดรูปและข้อความของ ${w.code}? ระบุเหตุผล:`)
    if (!reason) return
    takeDownContent(admin, w.region, w.id, reason)
    refresh()
    notify(`ถอดเนื้อหาของ ${w.code} แล้ว`)
  }

  return (
    <>
      <div className="bg-white rounded border-l-[5px] border-l-[#117a8b] shadow-[0_0_1px_rgba(0,0,0,.125),0_1px_3px_rgba(0,0,0,.2)] p-4 mb-4 text-sm">
        <h5 className="font-bold mb-1">เกณฑ์ตรวจสอบ (กติกาข้อ 5)</h5>
        ไม่อนาจาร · ไม่มีความรุนแรง · ไม่เหยียด/สร้างความเกลียดชัง · ไม่ละเมิดข้อมูลส่วนบุคคล (PDPA) · ไม่ผิดกฎหมายไทย · ไม่ละเมิดลิขสิทธิ์
      </div>
      <Card title={`เนื้อหาที่อัปเดตล่าสุด (${recent.length})`} icon={ImageOff} outline="warning">
        {recent.length === 0 ? (
          <p className="text-[#6c757d] text-sm">ยังไม่มีเนื้อหาให้ตรวจ</p>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
            {recent.map((w) => (
              <div key={`${w.region}-${w.id}`} className="border border-[#dee2e6] rounded overflow-hidden bg-white flex flex-col">
                <div className="aspect-[4/3] bg-[#e9ecef]">
                  {w.imageUrl ? (
                    <img src={w.imageUrl} alt={w.title} className="w-full h-full object-cover" />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center text-[#6c757d] text-sm">ไม่มีรูป</div>
                  )}
                </div>
                <div className="p-3 text-sm flex-1 space-y-1">
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-mono text-[#007bff]">{w.code}</span>
                    <span className="text-[0.75rem] text-[#6c757d]">{thaiDateTime(w.lastImageUpdatedAt)}</span>
                  </div>
                  <div className="font-bold truncate" title={w.title}>
                    {w.title}
                  </div>
                  <p className="text-[#6c757d] line-clamp-2 m-0">{w.description}</p>
                  {w.dailyNote && <p className="text-[#1e7e34] m-0">🟢 {w.dailyNote.text}</p>}
                  <div className="text-[0.8rem] text-[#6c757d]">เจ้าของ: {w.ownerName}</div>
                </div>
                <div className="p-2 border-t border-[#dee2e6] flex justify-end">
                  <Button size="sm" tone="danger" onClick={() => takeDown(w)}>
                    <ImageOff className="w-3.5 h-3.5" /> ถอดเนื้อหา
                  </Button>
                </div>
              </div>
            ))}
          </div>
        )}
      </Card>
    </>
  )
}
