import type { WindowItem } from '@shared/types'
import { REGIONS_BY_ID } from '@shared/regions'
import { btn, btnPri, card } from './ui'

export type StatusView = 'pending' | 'welcome' | 'building' | 'suspended'

// Posters with their text drawn in; the heading below repeats it for screen readers.
const VIEWS: Record<StatusView, { image: string; title: string; sub: string }> = {
  pending: { image: '/img/status/pending.webp', title: 'หน้าต่างบานนี้ถูกจองแล้ว', sub: 'อยู่ระหว่างรอการยืนยัน ขณะนี้ยังไม่เปิดให้ชม' },
  welcome: { image: '/img/status/welcome.webp', title: 'ยินดีด้วย! หน้าต่างพร้อมแล้ว', sub: 'ตอนนี้คุณเป็นเจ้าของหน้าต่างบานนี้แล้ว' },
  building: { image: '/img/status/building.webp', title: 'หน้าต่างบานนี้กำลังพัฒนา', sub: 'เจ้าของกำลังเตรียมเนื้อหา รอติดตามได้เลย' },
  suspended: { image: '/img/status/suspended.webp', title: 'หน้าต่างบานนี้ถูกระงับชั่วคราว', sub: 'อยู่ระหว่างรอการตรวจสอบจากทีมงาน ขณะนี้ยังไม่เปิดให้ชม' },
}

/**
 * Shown instead of the window's cards: reserved and waiting for the slip check, the owner's
 * one-time welcome, an owned window with nothing to show yet, or held for review.
 */
export function StatusScreen({ view, w, onStart, onBack, onContact }: { view: StatusView; w: WindowItem; onStart: () => void; onBack: () => void; onContact?: () => void }) {
  const v = VIEWS[view]
  const region = REGIONS_BY_ID[w.region]
  const type = w.region === 'thailand' ? 'ส่วนกลาง' : `ส่วนภูมิภาค · ${region?.name ?? ''}`
  const facts: [string, string][] = [
    ['ID หน้าต่าง', w.code],
    ['ประเภท', type],
    ...(view === 'welcome' ? [['ตำแหน่ง', `#${w.slotPosition || w.id}`] as [string, string]] : []),
    ...(view === 'pending' && w.reservedBy ? [['จองโดย', w.reservedBy] as [string, string]] : []),
  ]
  return (
    <section className={`${card} !p-0 overflow-hidden max-w-[640px] w-full mx-auto text-center`} aria-labelledby="status-title">
      <div className="bg-white">
        <img src={v.image} alt="" className="block w-full max-h-[68vh] object-contain" />
      </div>
      <h2 id="status-title" className="sr-only">
        {v.title}
      </h2>
      <p className="sr-only">{v.sub}</p>
      <dl className="mx-4 sm:mx-5 mt-4 mb-0 px-3.5 py-1.5 border border-(--kap-line) rounded-[14px] text-left">
        {facts.map(([label, value]) => (
          <div key={label} className="flex justify-between gap-3 py-2 border-b border-dashed border-(--kap-line) last:border-b-0">
            <dt className="text-(--kap-muted) text-[14px] m-0">{label}</dt>
            <dd className={`m-0 font-semibold text-right [overflow-wrap:anywhere] ${label === 'ID หน้าต่าง' ? 'font-mono tracking-wide' : ''}`}>{value}</dd>
          </div>
        ))}
      </dl>
      <div className="mx-4 sm:mx-5 mt-4 mb-5">
        {view === 'welcome' && (
          <button type="button" onClick={onStart} className={`${btn} ${btnPri} w-full !min-h-12 !text-[16px]`}>
            เริ่มตั้งค่าหน้าต่างของฉัน
          </button>
        )}
        {view === 'suspended' && onContact && (
          <button type="button" onClick={onContact} className={`${btn} ${btnPri} w-full !min-h-12 !text-[16px]`}>
            ติดต่อทีมงาน
          </button>
        )}
        {(view === 'building' || view === 'pending') && (
          <button type="button" onClick={onBack} className={`${btn} w-full !min-h-12`}>
            ย้อนกลับ
          </button>
        )}
      </div>
    </section>
  )
}
