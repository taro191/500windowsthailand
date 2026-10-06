import { Building2, ChartNoAxesColumn, Layers, Lock, Tag } from 'lucide-react'
import type { Region, Transaction } from '@/types'
import { REGIONS } from '@/data/regions'
import { RESALE_COMMISSION_RATE } from '@/lib/ownershipRules'
import { SectionHeading } from './SectionHeading'
import type { BoardCounts } from './SearchFilterTab'

interface StatsTabProps {
  region: Region
  counts: BoardCounts
  transactions: Transaction[]
}

export function StatsTab({ region, counts, transactions }: StatsTabProps) {
  const resales = transactions.filter((t) => t.type === 'resale')
  const resaleTotal = resales.reduce((sum, t) => sum + t.amount, 0)
  const commissionTotal = resales.reduce(
    (sum, t) => sum + (t.commissionAmount || Math.round(t.amount * RESALE_COMMISSION_RATE)),
    0,
  )

  return (
    <div className="space-y-4">
      <div className="p-4 rounded-xl bg-[#09080e] border border-purple-900/30 space-y-3 font-['Prompt',sans-serif]">
        <SectionHeading icon={ChartNoAxesColumn} title={`สถิติหน้าต่างที่กำลังชม (${region.name})`} />
        <div className="grid grid-cols-3 gap-2 text-center">
          <StatBox label="ว่างพร้อมจอง" value={counts.available} labelClass="text-rose-300" valueClass="text-rose-200" />
          <StatBox label="เปิดขายต่อ" value={counts.forResale} labelClass="text-orange-400" valueClass="text-orange-300" />
          <StatBox label="มีภาพแล้ว" value={counts.occupied} labelClass="text-emerald-400" valueClass="text-emerald-300" />
        </div>
      </div>

      <div className="p-4 rounded-xl bg-[#09080e] border border-purple-900/30 space-y-3 font-['Prompt',sans-serif]">
        <div className="flex items-center justify-between">
          <SectionHeading icon={Tag} title="สถิติตลาดซื้อขายต่อ & ค่าคอมมิชชั่น 5%" />
          <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-rose-500/20 text-rose-300 border border-rose-500/30">
            Rule 5%
          </span>
        </div>
        <div className="grid grid-cols-2 gap-2 text-xs">
          <div className="p-2.5 rounded-lg bg-[#140f21] border border-purple-900/30">
            <span className="text-[10px] text-stone-400 block">มูลค่าซื้อขายต่อรวม</span>
            <span className="text-base font-bold font-mono text-stone-100">฿{resaleTotal.toLocaleString()}</span>
          </div>
          <div className="p-2.5 rounded-lg bg-[#140f21] border border-rose-500/30">
            <span className="text-[10px] text-rose-400 block font-medium">⚡ ค่าคอมมิชชั่นระบบ (5%)</span>
            <span className="text-base font-bold font-mono text-rose-300">฿{commissionTotal.toLocaleString()}</span>
          </div>
        </div>
        <div className="p-2.5 rounded-lg bg-[#140f21]/60 border border-purple-900/20 flex items-center justify-between text-xs font-mono">
          <span className="text-stone-400">เงินสุทธิส่งถึงผู้ขาย (95%):</span>
          <span className="font-bold text-emerald-400">฿{(resaleTotal - commissionTotal).toLocaleString()}</span>
        </div>
      </div>

      <RentalMarketTeaser />

      <div className="p-4 rounded-xl bg-[#09080e] border border-purple-900/30 space-y-2 font-['Prompt',sans-serif]">
        <SectionHeading icon={Layers} title="โครงสร้างหน้าต่างทั้งโครงการ:" />
        <div className="space-y-1.5 text-xs text-stone-300">
          {REGIONS.map((r) => (
            <div key={r.id} className="flex justify-between py-1 border-b border-purple-900/20">
              <span>
                {r.icon} {r.name}:
              </span>
              {r.isCoreHeart ? (
                <span className="font-mono font-bold text-rose-400">500 บาน (โควตา 1 บาน)</span>
              ) : (
                <span className="font-mono text-stone-400">500 บาน</span>
              )}
            </div>
          ))}
          <div className="flex justify-between pt-2 font-bold text-rose-300 font-['Outfit',sans-serif]">
            <span>รวมทั้งประเทศ (7 หน้าต่าง):</span>
            <span className="font-mono">3,500 บาน</span>
          </div>
        </div>
      </div>
    </div>
  )
}

function StatBox({ label, value, labelClass, valueClass }: { label: string; value: number; labelClass: string; valueClass: string }) {
  return (
    <div className="p-2.5 rounded-lg bg-[#140f21] border border-purple-900/30">
      <span className={`text-[10px] block ${labelClass}`}>{label}</span>
      <span className={`text-lg font-bold font-mono ${valueClass}`}>{value}</span>
    </div>
  )
}

/** Roadmap card for the planned rental market (not functional yet). */
function RentalMarketTeaser() {
  const facts = [
    ['ค่าเช่าแนะนำเฉลี่ย', '฿50 - ฿300', '/ สัปดาห์ (ประมาณการ)', 'text-rose-300'],
    ['รอบสัญญาเช่า', '7 - 90 วัน', 'กำหนดได้ตามใจผู้ถือ', 'text-purple-300'],
    ['หักค่าบริการระบบ', '5%', 'หักเฉพาะเมื่อมีผู้เช่า', 'text-stone-200'],
  ]
  return (
    <div className="p-4 rounded-xl bg-gradient-to-br from-[#120f1e] via-[#151025] to-[#09080e] border border-purple-500/30 relative overflow-hidden space-y-3 font-['Prompt',sans-serif]">
      <div
        className="absolute -right-8 -top-8 w-32 h-32 rounded-full blur-2xl opacity-20 pointer-events-none"
        style={{ background: 'radial-gradient(circle, rgba(244,63,94,0.6) 0%, rgba(139,92,246,0.5) 100%)' }}
      />
      <div className="flex items-center justify-between relative z-10 flex-wrap gap-2">
        <div className="flex items-center gap-2.5">
          <span className="w-8 h-8 rounded-xl bg-purple-950/80 text-rose-300 border border-purple-500/40 flex items-center justify-center text-sm shrink-0">
            🗝️
          </span>
          <div>
            <h4 className="text-xs font-bold text-stone-100 uppercase tracking-wider font-['Outfit',sans-serif]">
              ตลาดปล่อยเช่า (Rental Market)
            </h4>
            <span className="text-[10px] text-stone-400 font-light">ระบบปล่อยเช่าช่วงสิทธิ์การแสดงผลบานหน้าต่าง</span>
          </div>
        </div>
        <span className="px-2 py-0.5 rounded-full text-[10px] font-mono font-medium bg-purple-950/80 text-purple-300 border border-purple-500/40 flex items-center gap-1 shrink-0">
          <Lock className="w-2.5 h-2.5 text-purple-400" />
          <span>เร็วๆ นี้ (ยังไม่เปิดใช้งาน)</span>
        </span>
      </div>
      <p className="text-[11px] text-stone-300 leading-relaxed font-light relative z-10">
        ระบบจำลองสำหรับเปิดให้ผู้ถือครองหน้าต่าง สามารถนำบานของตนเองมาปล่อยเช่าช่วงสิทธิ์การแสดงรูปภาพและข้อความให้แก่บุคคลหรือธุรกิจอื่นตามระยะเวลาที่กำหนด
        โดยที่กรรมสิทธิ์การถือครองหน้าต่างและโควตายังเป็นของเจ้าของเดิม 100%
      </p>
      <div className="grid grid-cols-3 gap-2 text-center pt-0.5 relative z-10">
        {facts.map(([label, value, note, valueClass]) => (
          <div key={label} className="p-2.5 rounded-lg bg-[#09080e]/80 border border-purple-900/30">
            <span className="text-[10px] text-stone-400 block font-light">{label}</span>
            <span className={`text-xs sm:text-sm font-bold font-mono block my-0.5 ${valueClass}`}>{value}</span>
            <span className="text-[9px] text-stone-500 block font-mono">{note}</span>
          </div>
        ))}
      </div>
      <div className="p-2.5 rounded-lg bg-[#09080e]/90 border border-purple-900/30 flex items-center justify-between text-[10px] text-stone-400 relative z-10 font-mono">
        <span className="flex items-center gap-1.5 text-stone-400">
          <span className="w-1.5 h-1.5 rounded-full bg-purple-400 animate-pulse" />
          <span className="font-['Prompt',sans-serif]">สถานะโมดูล: อยู่ระหว่างการออกแบบ (ยังไม่เปิดใช้งานและไม่เชื่อมต่อข้อมูลจริง)</span>
        </span>
        <span className="text-purple-400/80 font-bold shrink-0">Roadmap</span>
      </div>
      <div className="p-2.5 rounded-lg bg-emerald-950/30 border border-emerald-500/30 flex items-center justify-between text-[11px] text-emerald-300/90 relative z-10 font-['Prompt',sans-serif]">
        <span className="flex items-center gap-1.5">
          <Building2 className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
          <span>รายได้จากการปล่อยเช่าจะถูกโอนเข้า "บัญชีเพื่อรับเงิน" ในแท็บกระเป๋าเงินโดยอัตโนมัติ</span>
        </span>
        <span className="text-[10px] font-mono text-emerald-400/90 font-bold shrink-0">สุทธิ 95%</span>
      </div>
    </div>
  )
}
