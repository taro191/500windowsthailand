import { Check, RotateCcw, ShieldAlert, X } from 'lucide-react'
import { KapsulepLogo } from '../KapsulepLogo'

interface ResetConfirmModalProps {
  isOpen: boolean
  onClose: () => void
  onConfirm: () => void
}

const EFFECTS = [
  ['รีเซ็ตผู้ใช้:', 'เป็นค่าเริ่มต้นของผู้สมัครเข้าระบบครั้งแรก (โควตา 0/2 บาน, เครดิต 10,000 ฿)'],
  ['ล้างประวัติการใช้งาน:', 'ประวัติธุรกรรมการซื้อ-ขายต่อทั้งหมดถูกล้างออกเป็นศูนย์'],
  ['ล้างการตั้งค่า:', 'รีเซ็ตหน้าต่างที่เคยจับจองและตัวกรองค้นหาทั้งหมดกลับสู่ค่าเริ่มต้นของระบบ'],
]

/** Demo: confirm wiping all local data back to the first-time-user state. */
export function ResetConfirmModal({ isOpen, onClose, onConfirm }: ResetConfirmModalProps) {
  if (!isOpen) return null
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/85 backdrop-blur-sm overflow-y-auto animate-in fade-in duration-200 font-['Plus_Jakarta_Sans','Prompt',sans-serif]">
      <div
        className="relative w-full max-w-md bg-[#0e0b17] border border-rose-900/60 rounded-2xl shadow-2xl overflow-hidden my-auto p-5 sm:p-6 space-y-4"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-center gap-3">
            <KapsulepLogo size={36} showGlow />
            <div>
              <h2 className="font-bold text-stone-100 text-base font-['Prompt',sans-serif]">รีเซ็ตแอปเป็นค่าเริ่มต้นผู้ใช้ใหม่</h2>
              <p className="text-xs text-stone-400 font-['Prompt',sans-serif]">ล้างข้อมูลการตั้งค่าและประวัติการใช้งานทั้งหมด</p>
            </div>
          </div>
          <button onClick={onClose} className="p-1 text-stone-400 hover:text-stone-200 hover:bg-[#1a142c] rounded-lg cursor-pointer transition-colors">
            <X className="w-5 h-5" />
          </button>
        </div>
        <div className="p-3.5 rounded-xl bg-[#09080e] border border-rose-900/40 text-xs text-stone-300 space-y-2 font-['Prompt',sans-serif]">
          <div className="flex items-center gap-1.5 text-rose-400 font-bold">
            <ShieldAlert className="w-4 h-4 shrink-0" />
            <span>สิ่งที่จะเกิดขึ้นเมื่อกดยืนยันการรีเซ็ต:</span>
          </div>
          <ul className="space-y-1.5 text-[11px] text-stone-400 pl-1 leading-relaxed font-light">
            {EFFECTS.map(([title, detail]) => (
              <li key={title} className="flex items-start gap-1.5">
                <Check className="w-3.5 h-3.5 text-emerald-400 shrink-0 mt-0.5" />
                <span>
                  <strong>{title}</strong> {detail}
                </span>
              </li>
            ))}
          </ul>
        </div>
        <div className="flex items-center gap-2.5 pt-1 font-['Prompt',sans-serif]">
          <button
            onClick={onClose}
            className="flex-1 py-2.5 px-3 rounded-xl bg-[#140f21] hover:bg-[#1b152d] border border-stone-800 text-stone-300 text-xs font-semibold cursor-pointer transition-colors"
          >
            ยกเลิก
          </button>
          <button
            onClick={() => {
              onConfirm()
              onClose()
            }}
            className="flex-1 py-2.5 px-3 rounded-xl bg-gradient-to-r from-orange-500 via-rose-500 to-purple-600 hover:opacity-95 text-white text-xs font-bold cursor-pointer transition-all shadow-md flex items-center justify-center gap-1.5"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            <span>ยืนยันรีเซ็ตทั้งหมด</span>
          </button>
        </div>
      </div>
    </div>
  )
}
