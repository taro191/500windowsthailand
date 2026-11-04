import type { User, WindowItem } from '@shared/types'
import { myTrialWindow } from '@/lib/store'

/** Buying another window ends the user's free trial at once (shared/trial.ts): say so before they pay. */
export function TrialEndsNotice({ currentUser, windowItem }: { currentUser: User | null; windowItem: WindowItem }) {
  const trial = currentUser ? myTrialWindow(currentUser) : undefined
  if (!trial || (trial.region === windowItem.region && trial.id === windowItem.id)) return null
  return (
    <p className="m-0 p-3 rounded-xl bg-amber-950/30 border border-amber-700/40 text-[11px] leading-relaxed text-amber-100">
      ⚠️ คุณมีบานทดลองใช้ <strong>{trial.code}</strong> อยู่ เมื่อชำระบานนี้สำเร็จ บานทดลองเดิมจะหยุดใช้งานทันทีและกลับเป็นบานว่าง
      ข้อมูลในบานทดลองไม่ย้ายมาบานนี้
    </p>
  )
}
