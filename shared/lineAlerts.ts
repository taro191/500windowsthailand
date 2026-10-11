// Kinds of LINE alert the super admin can switch on or off, grouped as on the admin page.
// Every topic is on until switched off; the test message always goes out.

export type LineAlertGroup = 'slips' | 'finance' | 'settings' | 'users' | 'security' | 'contact'

export const LINE_ALERT_GROUPS: { id: LineAlertGroup; label: string; hint: string }[] = [
  { id: 'slips', label: 'สลิปรอตรวจ', hint: 'ทันทีที่ลูกค้าส่งสลิป' },
  { id: 'finance', label: 'ความเคลื่อนไหวทางการเงิน', hint: 'สรุปทุก 30 วินาที' },
  { id: 'settings', label: 'การแก้ไขการตั้งค่า', hint: 'พร้อมค่าก่อน-หลัง' },
  { id: 'users', label: 'ผู้ใช้', hint: 'ผู้ใช้ทำเอง' },
  { id: 'security', label: 'ความปลอดภัย', hint: 'สิ่งที่แอดมินทำกับบัญชีผู้ใช้' },
  { id: 'contact', label: 'ติดต่อเรา', hint: 'ข้อความยังเก็บไว้ในเมนู ข้อความติดต่อ' },
]

export const LINE_ALERT_TOPICS = [
  { id: 'slips.topup', group: 'slips', label: 'สลิปเติมเงิน' },
  { id: 'slips.claim', group: 'slips', label: 'สลิปจับจองบาน' },
  { id: 'slips.resale', group: 'slips', label: 'สลิปซื้อต่อ' },
  { id: 'slips.promo', group: 'slips', label: 'สลิปโปรโมท' },
  { id: 'finance.topup', group: 'finance', label: '🟢 เติมเงิน' },
  { id: 'finance.bonus', group: 'finance', label: '🟢 โบนัสสมัครสมาชิก' },
  { id: 'finance.refund', group: 'finance', label: '🟢 คืนเงินเข้ากระเป๋า' },
  { id: 'finance.claim', group: 'finance', label: '🔴 จับจองบาน' },
  { id: 'finance.resale', group: 'finance', label: '🔁 ขายต่อบาน' },
  { id: 'finance.promo', group: 'finance', label: '🔴 ค่าโปรโมท' },
  { id: 'finance.edit_fee', group: 'finance', label: '🔴 ค่าแก้ไขบาน' },
  { id: 'finance.transfer', group: 'finance', label: '• โอนสิทธิ์บาน' },
  { id: 'settings.rules', group: 'settings', label: 'กติกาทั่วไป' },
  { id: 'settings.channels', group: 'settings', label: 'ช่องทางรับชำระเงิน' },
  { id: 'settings.priceCaps', group: 'settings', label: 'เพดานราคาขายต่อ' },
  { id: 'settings.topUp', group: 'settings', label: 'การเติมเงิน' },
  { id: 'settings.editPolicy', group: 'settings', label: 'การแก้ไขบาน' },
  { id: 'settings.signupBonus', group: 'settings', label: 'โบนัสสมัครสมาชิก' },
  { id: 'settings.contact', group: 'settings', label: 'ข้อมูลติดต่อเรา' },
  { id: 'users.signup', group: 'users', label: 'สมัครสมาชิกใหม่' },
  { id: 'users.kyc', group: 'users', label: 'ยืนยันตัวตน (KYC) ด้วย OTP สำเร็จ' },
  { id: 'security.userEdit', group: 'security', label: 'สร้าง / แก้ไขข้อมูลผู้ใช้' },
  { id: 'security.suspend', group: 'security', label: 'ระงับ / ปิดใช้งานบัญชี' },
  { id: 'security.role', group: 'security', label: 'เปลี่ยนสิทธิ์แอดมิน' },
  { id: 'security.kyc', group: 'security', label: 'แอดมินยืนยัน / เพิกถอน KYC' },
  { id: 'contact.message', group: 'contact', label: 'ข้อความจากฟอร์มติดต่อเรา' },
] as const satisfies readonly { id: string; group: LineAlertGroup; label: string }[]

export type LineAlertTopic = (typeof LINE_ALERT_TOPICS)[number]['id']
export type LineAlertTopics = Record<LineAlertTopic, boolean>

export const isLineAlertTopic = (id: string): id is LineAlertTopic => LINE_ALERT_TOPICS.some((t) => t.id === id)

/** Which topics are on, from the saved JSON (also reads the older per-group switches). */
export function lineAlertTopicsFrom(saved: unknown): LineAlertTopics {
  const s = (saved && typeof saved === 'object' ? saved : {}) as Record<string, unknown>
  return Object.fromEntries(
    LINE_ALERT_TOPICS.map((t) => [t.id, typeof s[t.id] === 'boolean' ? s[t.id] : s[t.group] !== false]),
  ) as LineAlertTopics
}
