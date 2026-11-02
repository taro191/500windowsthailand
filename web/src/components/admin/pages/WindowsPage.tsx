import { useCallback, useEffect, useMemo, useState } from 'react'
import { Archive, ArchiveRestore, ImageOff, LayoutGrid, Lock, LockOpen, RotateCcw, Search } from 'lucide-react'
import type { RegionId, WindowArchive, WindowItem, WindowStatus } from '@shared/types'
import { REGIONS, REGIONS_BY_ID } from '@shared/regions'
import { CATEGORIES } from '@shared/categories'
import { archiveWindow, loadWindowArchives, releaseWindow, restoreWindowArchive, setWindowSuspended, takeDownContent } from '@/lib/adminApi'
import { isPromoSlot } from '@/lib/promo'
import type { AdminPageProps } from '../adminData'
import { Badge, baht, Button, Card, DataTable, inputClass, thaiDateTime } from '../ui'

const PAGE_SIZE = 25

export function StatusBadge({ window: w }: { window: WindowItem }) {
  if (w.lifecycle === 'suspended') return <Badge tone="danger">ระงับ รอตรวจสอบ</Badge>
  if (w.lifecycle === 'pending') return <Badge tone="warning">จองแล้ว รอตรวจสลิป</Badge>
  if (w.lifecycle === 'unpaid') return <Badge tone="warning">ทดลองใช้ครบ รอชำระเงิน</Badge>
  if (w.trialEndsAt) return <Badge tone="info">ทดลองใช้ฟรี</Badge>
  if (w.takenDown) return <Badge tone="danger">ระงับเนื้อหา</Badge>
  if (w.lifecycle === 'building') return <Badge tone="secondary">ยังไม่เผยแพร่</Badge>
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

/** Hides a window's content from visitors (kept for the owner and admins), or lifts it. */
async function toggleTakedown(w: WindowItem, refresh: AdminPageProps['refresh'], notify: AdminPageProps['notify']) {
  const hide = !w.takenDown
  const reason = confirmWithReason(
    hide
      ? `ระงับเนื้อหาของ ${w.code}? ผู้ชมจะเห็นหน้า "กำลังพัฒนา" ส่วนข้อมูลและรูปยังอยู่ครบ (เห็นได้เฉพาะเจ้าของและผู้ดูแล) เจ้าของต้องแก้ไขแล้วกดเผยแพร่ใหม่ ระบุเหตุผล (เจ้าของจะเห็นเหตุผลนี้):`
      : `ยกเลิกการระงับเนื้อหาของ ${w.code} และเผยแพร่ตามเดิม? ระบุเหตุผล:`,
  )
  if (!reason) return
  const result = await takeDownContent(w.region, w.id, reason, hide)
  if (!result.success) return notify(result.error, 'error')
  await refresh()
  notify(hide ? `ระงับเนื้อหาของ ${w.code} แล้ว` : `ยกเลิกการระงับเนื้อหาของ ${w.code} แล้ว`)
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

  const takeDown = (w: WindowItem) => toggleTakedown(w, refresh, notify)
  const suspend = async (w: WindowItem) => {
    const hold = w.lifecycle !== 'suspended'
    const reason = confirmWithReason(
      hold ? `ระงับ ${w.code} เพื่อตรวจสอบ? ผู้ชมและเจ้าของจะเห็นเฉพาะหน้า "รอการตรวจสอบ" ระบุเหตุผล (บันทึกในประวัติ ไม่แสดงต่อผู้ชม):` : `ปลดระงับ ${w.code}? ระบุเหตุผล:`,
    )
    if (!reason) return
    const result = await setWindowSuspended(w.region, w.id, hold, reason)
    if (!result.success) return notify(result.error, 'error')
    await refresh()
    notify(hold ? `ระงับ ${w.code} แล้ว` : `ปลดระงับ ${w.code} แล้ว`)
  }
  const release = async (w: WindowItem) => {
    const reason = confirmWithReason(`คืน ${w.code} เป็นบานว่าง (ยกเลิกการถือครองของ ${w.ownerName})? ระบุเหตุผล:`)
    if (!reason) return
    const result = await releaseWindow(w.region, w.id, reason)
    if (!result.success) return notify(result.error, 'error')
    await refresh()
    notify(`คืน ${w.code} เป็นบานว่างแล้ว`)
  }
  const archive = async (w: WindowItem) => {
    const reason = confirmWithReason(
      `ลบ ${w.code} «${w.title}» ออกจากบาน? ข้อมูลและเจ้าของ (${w.ownerName}) จะถูกเก็บไว้ที่เมนู «บานที่ถูกลบ» เพื่อนำกลับมาลงบานอื่นได้ และบานนี้จะว่างให้จับจองได้ตามปกติ ระบุเหตุผล:`,
    )
    if (!reason) return
    const result = await archiveWindow(w.region, w.id, reason)
    if (!result.success) return notify(result.error, 'error')
    await refresh()
    notify(`ลบ ${w.code} และเก็บข้อมูลไว้แล้ว`)
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
                  <Button size="sm" tone={w.lifecycle === 'suspended' ? 'success' : 'secondary'} onClick={() => suspend(w)} title="ผู้ชมเห็นเฉพาะหน้า รอการตรวจสอบ">
                    {w.lifecycle === 'suspended' ? <LockOpen className="w-3.5 h-3.5" /> : <Lock className="w-3.5 h-3.5" />} {w.lifecycle === 'suspended' ? 'ปลดระงับ' : 'ระงับ'}
                  </Button>
                  <Button size="sm" tone={w.takenDown ? 'success' : 'warning'} onClick={() => takeDown(w)} title="ซ่อนเนื้อหาจากผู้ชม ข้อมูลยังอยู่ครบ">
                    <ImageOff className="w-3.5 h-3.5" /> {w.takenDown ? 'คืนเนื้อหา' : 'ระงับเนื้อหา'}
                  </Button>
                  <Button size="sm" tone="danger" onClick={() => release(w)} title="ยกเลิกการถือครอง คืนเป็นบานว่าง">
                    <RotateCcw className="w-3.5 h-3.5" /> คืนบาน
                  </Button>
                  {admin.superAdmin && (
                    <Button size="sm" tone="dark" onClick={() => archive(w)} title="ย้ายข้อมูลไปเก็บ แล้วให้บานนี้ว่าง (Super Admin)">
                      <Archive className="w-3.5 h-3.5" /> ลบบาน
                    </Button>
                  )}
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
export function ModerationPage({ data, refresh, notify }: AdminPageProps) {
  const recent = useMemo(
    () =>
      data.windows
        .filter((w) => w.status !== 'available' && w.lastImageUpdatedAt)
        .sort((a, b) => new Date(b.lastImageUpdatedAt!).getTime() - new Date(a.lastImageUpdatedAt!).getTime()),
    [data.windows],
  )

  const takeDown = (w: WindowItem) => toggleTakedown(w, refresh, notify)

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
                  <Button size="sm" tone={w.takenDown ? 'success' : 'danger'} onClick={() => takeDown(w)}>
                    <ImageOff className="w-3.5 h-3.5" /> {w.takenDown ? 'คืนเนื้อหา' : 'ระงับเนื้อหา'}
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

/** Super admin: windows removed into the archive; put one back on any empty window. */
export function WindowArchivesPage({ refresh, notify }: AdminPageProps) {
  const [archives, setArchives] = useState<WindowArchive[] | null>(null)
  const [targets, setTargets] = useState<Record<string, { region: RegionId; num: string }>>({})
  const [busy, setBusy] = useState('')

  const load = useCallback(async () => {
    const result = await loadWindowArchives()
    if (!result.success) return notify(result.error, 'error')
    setArchives(result.archives)
  }, [notify])
  useEffect(() => {
    void load()
  }, [load])

  const targetOf = (a: WindowArchive) => targets[a.id] ?? { region: a.region, num: '' }
  const setTarget = (a: WindowArchive, next: Partial<{ region: RegionId; num: string }>) => setTargets((t) => ({ ...t, [a.id]: { ...targetOf(a), ...next } }))
  const restore = async (a: WindowArchive) => {
    const { region, num } = targetOf(a)
    const n = Number(num)
    if (!Number.isInteger(n) || n < 1) return notify('กรุณาระบุหมายเลขบานว่างที่จะนำข้อมูลไปลง', 'error')
    if (!window.confirm(`นำข้อมูล ${a.code} «${a.title}» ของ ${a.ownerName} ไปลงบานหมายเลข ${n} (${REGIONS_BY_ID[region].name})?`)) return
    setBusy(a.id)
    const result = await restoreWindowArchive(a.id, region, n)
    setBusy('')
    if (!result.success) return notify(result.error, 'error')
    setArchives(result.archives)
    await refresh()
    notify(`นำข้อมูล ${a.code} กลับมาลงบานใหม่แล้ว`)
  }

  return (
    <Card title={`บานที่ถูกลบ (${archives?.length ?? 0})`} icon={Archive} outline="secondary" flush>
      <DataTable head={['รูป', 'บานเดิม', 'ชื่อบาน', 'เจ้าของ', 'เหตุผล', 'ลบเมื่อ', 'นำกลับมาลง']} empty={archives ? 'ยังไม่มีบานที่ถูกลบ' : 'กำลังโหลด…'}>
        {(archives ?? []).map((a) => {
          const t = targetOf(a)
          return (
            <tr key={a.id}>
              <td>{a.imageUrl ? <img src={a.imageUrl} alt="" className="w-14 h-10 object-cover rounded" /> : '-'}</td>
              <td className="font-mono whitespace-nowrap">{a.code}</td>
              <td className="max-w-[200px] truncate" title={a.title}>
                {a.title}
              </td>
              <td className="whitespace-nowrap">{a.ownerName}</td>
              <td className="max-w-[220px] truncate" title={a.reason}>
                {a.reason}
              </td>
              <td className="whitespace-nowrap text-[#6c757d]">
                {thaiDateTime(a.archivedAt)}
                <div className="text-[0.75rem]">โดย {a.archivedBy}</div>
              </td>
              <td className="whitespace-nowrap">
                {a.restoredAt ? (
                  <Badge tone="success">
                    ลงบาน {a.restoredTo} แล้ว · {thaiDateTime(a.restoredAt)}
                  </Badge>
                ) : (
                  <div className="flex items-center gap-1">
                    <select value={t.region} onChange={(e) => setTarget(a, { region: e.target.value as RegionId })} className={`${inputClass} w-auto`}>
                      {REGIONS.map((r) => (
                        <option key={r.id} value={r.id}>
                          {r.name}
                        </option>
                      ))}
                    </select>
                    <input
                      value={t.num}
                      onChange={(e) => setTarget(a, { num: e.target.value.replace(/\D/g, '') })}
                      inputMode="numeric"
                      placeholder="เลขบานว่าง"
                      className={`${inputClass} w-24`}
                    />
                    <Button size="sm" tone="success" disabled={busy === a.id} onClick={() => restore(a)}>
                      <ArchiveRestore className="w-3.5 h-3.5" /> นำกลับมาลง
                    </Button>
                  </div>
                )}
              </td>
            </tr>
          )
        })}
      </DataTable>
    </Card>
  )
}
