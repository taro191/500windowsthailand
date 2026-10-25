import { useEffect, useState } from 'react'
import { Eye, EyeOff, FastForward } from 'lucide-react'
import type { User, WindowItem } from '@shared/types'
import { maskCitizenId, maskPhone } from '@shared/identity'
import { commissionOf, getEditStatus, getHoldingPeriod, getPriceCap } from '@/lib/ownershipRules'
import { useRules, useSettings } from '@/lib/settings'
import { isDemo } from '@/lib/store'
import { btn, btnOn, btnPri, card, field, h3, muted } from './ui'

interface OwnerStudioProps {
  windowItem: WindowItem
  currentUser: User | null
  onOpenEditor: () => void
  onListForResale: (price: number) => void
  onCancelResale: () => void
  onSimulatePass24Hours: () => void
  onSimulateHolding: (days: number) => void
  onOpenKyc: () => void
}

const box = 'p-3 rounded-xl border border-(--kap-line) bg-(--kap-bg) text-[13px]'
const row = 'flex items-center justify-between gap-2'

/** Owner-only card: private details, daily edits of the cover photo and text, resale listing. */
export function OwnerStudio({ windowItem: w, currentUser, onOpenEditor, onListForResale, onCancelResale, onSimulatePass24Hours, onSimulateHolding, onOpenKyc }: OwnerStudioProps) {
  const [showCitizenId, setShowCitizenId] = useState(false)
  const [showPhone, setShowPhone] = useState(false)
  const [resaleFormOpen, setResaleFormOpen] = useState(false)
  useEffect(() => {
    setShowCitizenId(false)
    setShowPhone(false)
    setResaleFormOpen(false)
  }, [w.id, w.region])

  const { editPolicy } = useSettings()
  const rules = useRules()
  const edit = getEditStatus(w, editPolicy)
  const holding = getHoldingPeriod(w, rules.minHoldingDays)
  const isForResale = w.status === 'for_resale'
  const citizenId = w.ownerCitizenId || currentUser?.citizenId
  const contact = w.ownerContact || currentUser?.phone

  return (
    <section className={`${card} space-y-3`}>
      <div className="flex justify-between items-center gap-2 flex-wrap">
        <h3 className={h3}>🛠️ สตูดิโอเจ้าของ</h3>
        <span className="text-[11px] px-2 py-0.5 rounded-full bg-emerald-950 text-emerald-300 border border-emerald-500/40">Verified Owner · เห็นเฉพาะคุณ</span>
      </div>

      <div className={`${box} space-y-2`}>
        <p className={`m-0 text-[12px] ${muted} leading-relaxed`}>
          ข้อมูลส่วนนี้เข้ารหัสและแสดงผลให้ <b className="text-(--kap-text)">คุณ ({currentUser?.name})</b> มองเห็นคนเดียวเท่านั้น บุคคลทั่วไปจะไม่สามารถดูเลขบัตร ปชช. หรือเบอร์ติดต่อจริงของคุณได้
        </p>
        <SecretRow label="เลขบัตรประชาชนผู้ถือครอง:" visible={showCitizenId} onToggle={() => setShowCitizenId(!showCitizenId)} full={citizenId || '-'} masked={maskCitizenId(citizenId)} />
        <SecretRow label="เบอร์โทรศัพท์ติดต่อส่วนตัว:" visible={showPhone} onToggle={() => setShowPhone(!showPhone)} full={contact || '-'} masked={maskPhone(contact)} />
        {w.claimedAt && (
          <div className={row}>
            <span className={muted}>ครอบครองสิทธิ์เมื่อ:</span>
            <span className="font-mono">{new Date(w.claimedAt).toLocaleString('th-TH')}</span>
          </div>
        )}
        <div className={row}>
          <span className={muted}>ต้นทุนสิทธิ์บานแรกเข้า:</span>
          <span className="font-mono text-emerald-400 font-bold">{w.claimPrice ? `${w.claimPrice.toLocaleString()} ฿` : rules.claimPriceLabel} (ตลอดชีพ)</span>
        </div>
      </div>

      {isForResale && w.resalePrice && (
        <div className={`${box} space-y-1 !border-(--kap-gold)/60`}>
          <div className={`${row} font-bold text-(--kap-gold)`}>
            <span>💰 ประมาณการรายได้จากการขายต่อบานนี้</span>
            <span className="text-[11px]">หักค่าคอม {rules.commissionLabel}</span>
          </div>
          <div className={`${row} ${muted}`}>
            <span>ราคาขายต่อที่ตั้งไว้:</span>
            <b className="text-(--kap-text)">฿{w.resalePrice.toLocaleString()}</b>
          </div>
          <div className={row}>
            <span className={muted}>ค่าคอมมิชชั่นระบบ ({rules.commissionLabel}):</span>
            <span className="text-(--kap-warn)">-฿{commissionOf(w.resalePrice).toLocaleString()}</span>
          </div>
          <div className={`${row} text-emerald-300 font-bold pt-1 border-t border-(--kap-line)`}>
            <span>ยอดเงินโอนเข้ากระเป๋าคุณสุทธิ ({rules.sellerLabel}):</span>
            <span>฿{(w.resalePrice - commissionOf(w.resalePrice)).toLocaleString()}</span>
          </div>
        </div>
      )}

      <div className={`${box} space-y-2`}>
        <div className={row}>
          <b>📷 สิทธิ์แก้ไขรูปปกและข้อความ</b>
          <span className={`text-[11px] ${muted}`}>(ฟรี {editPolicy.freeEditsPerDay} ครั้ง / วัน)</span>
        </div>
        <p className={`m-0 text-[12px] ${muted}`}>รูปปก ชื่อ คำแนะนำ หมวดหมู่ และจังหวัด คือสิ่งที่แสดงบนกระดาน ส่วนการ์ดอื่นๆ แก้ได้ฟรีไม่จำกัดผ่านปุ่ม “โหมดเจ้าของ”</p>
        {!edit.paid ? (
          <p className="m-0 p-2 rounded-lg bg-emerald-950/40 border border-emerald-800/40 text-emerald-300 text-[12px]">✓ แก้ไขฟรีได้อีก {edit.freeLeft} ครั้งในวันนี้</p>
        ) : (
          <p className="m-0 p-2 rounded-lg border border-(--kap-line) text-[12px] text-(--kap-warn)">
            {edit.canEdit ? `ใช้สิทธิ์ฟรีวันนี้ครบแล้ว แก้ไขเพิ่มได้ครั้งละ ฿${edit.price.toLocaleString()} (หักจากกระเป๋า) · ` : 'ใช้สิทธิ์แก้ไขของวันนี้ครบแล้ว · '}
            สิทธิ์ฟรีกลับมาในอีก {edit.resetsIn.hours} ชม. {edit.resetsIn.minutes} นาที
          </p>
        )}
        <button type="button" onClick={onOpenEditor} disabled={!edit.canEdit} className={`${btn} ${edit.canEdit ? btnPri : ''} w-full`}>
          แก้ไขรูปปก / ข้อความบานของคุณ
        </button>
        {edit.paid && isDemo() && (
          <button type="button" onClick={onSimulatePass24Hours} className={`w-full py-1.5 text-[11px] ${muted} border border-dashed border-(--kap-line) rounded-lg flex items-center justify-center gap-1.5 cursor-pointer`}>
            <FastForward className="w-3 h-3" /> ทดสอบ: คืนสิทธิ์แก้ไขฟรีของวันนี้
          </button>
        )}
      </div>

      {!holding.isEligible && (
        <div className={`${box} space-y-1`}>
          <b className="text-(--kap-warn)">⏳ เงื่อนไขข้อ 1: ต้องถือครองไม่ต่ำกว่า {rules.minHoldingDays} วัน</b>
          <p className={`m-0 text-[12px] ${muted}`}>
            ปัจจุบันคุณถือครองมาแล้ว <b className="text-(--kap-text)">{holding.daysHeld} วัน</b> (ขาดอีก <b className="text-(--kap-text)">{holding.daysRemaining} วัน</b> จึงจะเปิดขายต่อได้)
          </p>
          <button type="button" onClick={() => onSimulateHolding(35)} className="text-[11px] text-(--kap-teal) underline flex items-center gap-1 cursor-pointer">
            <FastForward className="w-3 h-3" /> [ทดสอบระบบ] เร่งเวลาจำลองถือครองครบ 35 วัน เพื่อปลดล็อกสิทธิ์ขายต่อ
          </button>
        </div>
      )}

      {resaleFormOpen ? (
        <ResaleForm
          windowItem={w}
          isEligible={holding.isEligible}
          onCancel={() => setResaleFormOpen(false)}
          onSubmit={(price) => {
            onListForResale(price)
            setResaleFormOpen(false)
          }}
        />
      ) : isForResale ? (
        <button type="button" onClick={onCancelResale} className={`${btn} w-full !text-(--kap-warn)`}>
          ยกเลิกการเปิดขายต่อ
        </button>
      ) : (
        <button
          type="button"
          onClick={() => (currentUser?.isVerified ? setResaleFormOpen(true) : onOpenKyc())}
          className={`${btn} w-full`}
        >
          🏷️ {holding.isEligible ? 'ตั้งราคาเปิดขายต่อให้ผู้อื่น' : `เปิดขายต่อ (ถือครอง ${holding.daysHeld}/${rules.minHoldingDays} วัน)`}
        </button>
      )}
    </section>
  )
}

function SecretRow({ label, visible, onToggle, full, masked }: { label: string; visible: boolean; onToggle: () => void; full: string; masked: string }) {
  return (
    <div className={row}>
      <span className={muted}>{label}</span>
      <span className="flex items-center gap-1.5 font-mono">
        {visible ? full : masked}
        <button type="button" onClick={onToggle} className={`p-1 ${muted} cursor-pointer`} aria-label={visible ? 'ซ่อน' : 'แสดง'} title={visible ? 'ซ่อน' : 'แสดง'}>
          {visible ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
        </button>
      </span>
    </div>
  )
}

function ResaleForm({ windowItem, isEligible, onCancel, onSubmit }: { windowItem: WindowItem; isEligible: boolean; onCancel: () => void; onSubmit: (price: number) => void }) {
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
      className={`${box} space-y-2.5 !border-(--kap-gold)/60`}
    >
      <div className={row}>
        <b>🏷️ ตั้งราคาขายต่อ (ตามกติกากำหนดเพดานราคา)</b>
        <button type="button" onClick={onCancel} className={`${muted} text-[12px] cursor-pointer`}>
          ยกเลิก
        </button>
      </div>
      <div className="space-y-1 text-[12px]">
        <div className={row}>
          <span className={muted}>เพดานราคาตามเงื่อนไข:</span>
          <span className="text-(--kap-gold)">{cap.tierLabel}</span>
        </div>
        <div className={row}>
          <span className={muted}>ราคาตั้งต้น:</span>
          <span>฿{cap.basePrice.toLocaleString()}</span>
        </div>
        <div className={row}>
          <span className={muted}>เพดานสูงสุด:</span>
          <b className="text-(--kap-gold)">{cap.maxAllowedPrice === null ? 'ตามความต้องการของตลาด' : `ไม่เกิน ฿${cap.maxAllowedPrice.toLocaleString()}`}</b>
        </div>
      </div>
      <label className={`block text-[12px] ${muted}`}>
        ระบุราคาขายต่อ (บาท):
        <input
          type="number"
          min={rules.minResalePrice}
          max={cap.maxAllowedPrice || undefined}
          step="50"
          value={priceInput}
          onChange={(e) => setPriceInput(e.target.value)}
          className={`${field} mt-1 font-mono`}
          required
        />
      </label>
      {price > 0 && !overCap && (
        <div className="space-y-1 text-[12px]">
          <div className={row}>
            <span className={muted}>• ค่าคอมมิชชั่นเข้าระบบ ({rules.commissionLabel}):</span>
            <b className="text-(--kap-warn)">฿{commissionOf(price).toLocaleString()}</b>
          </div>
          <div className={row}>
            <span>• คุณจะได้รับเงินสุทธิ ({rules.sellerLabel}):</span>
            <b className="text-emerald-400">฿{(price - commissionOf(price)).toLocaleString()}</b>
          </div>
        </div>
      )}
      <button type="submit" disabled={overCap || price < rules.minResalePrice || !isEligible} className={`${btn} ${btnOn} w-full`}>
        ยืนยันเปิดขายต่อบานนี้
      </button>
    </form>
  )
}
