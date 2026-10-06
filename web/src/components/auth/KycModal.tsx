import { useState } from 'react'
import { Check, CircleAlert, CreditCard, Phone, Send, ShieldCheck, Sparkles, X } from 'lucide-react'
import type { Result, User } from '@/types'
import { formatCitizenId, formatPhone, isValidCitizenId, isValidThaiMobile } from '@/lib/identity'
import { KapsulepLogo } from '../KapsulepLogo'

interface KycModalProps {
  isOpen: boolean
  currentUser: User | null
  onClose: () => void
  onSuccess: (user: User) => void
  onVerify: (citizenId: string, phone: string) => Result<{ user: User }>
  /** Why KYC was requested (e.g. the action that was blocked). */
  reasonNotice?: string
}

/**
 * Identity verification with a 13-digit citizen ID and a Thai mobile number.
 * The OTP is simulated on screen (no SMS is sent in the demo).
 */
export function KycModal({ isOpen, currentUser, onClose, onSuccess, onVerify, reasonNotice }: KycModalProps) {
  const [citizenId, setCitizenId] = useState(currentUser?.citizenId ? formatCitizenId(currentUser.citizenId) : '')
  const [phone, setPhone] = useState(currentUser?.phone ? formatPhone(currentUser.phone) : '')
  const [otpSent, setOtpSent] = useState(false)
  const [expectedOtp, setExpectedOtp] = useState('')
  const [otp, setOtp] = useState('')
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')

  if (!isOpen || !currentUser) return null

  const citizenIdValid = isValidCitizenId(citizenId)
  const phoneValid = isValidThaiMobile(phone)

  const requestOtp = () => {
    if (!citizenIdValid) {
      setError('กรุณากรอกเลขบัตรประชาชน 13 หลักให้ถูกต้องตามหลักการคำนวณของกรมการปกครอง')
      return
    }
    if (!phoneValid) {
      setError('กรุณากรอกเบอร์โทรศัพท์มือถือ 10 หลักให้ถูกต้อง (ขึ้นต้นด้วย 06, 08 หรือ 09)')
      return
    }
    setError('')
    const code = Math.floor(100000 + Math.random() * 900000).toString()
    setExpectedOtp(code)
    setOtpSent(true)
    setOtp(code) // Demo: auto-filled so testers don't need to retype it.
  }

  const submit = (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    if (!citizenIdValid) return setError('เลขประจำตัวประชาชนไม่ถูกต้อง')
    if (!phoneValid) return setError('เบอร์โทรศัพท์ไม่ถูกต้อง')
    if (!otpSent) return setError('กรุณากดรับรหัส OTP ทางเบอร์โทรศัพท์ก่อน')
    if (otp !== expectedOtp) return setError('รหัส OTP ไม่ถูกต้อง กรุณาตรวจสอบอีกครั้ง')
    const result = onVerify(citizenId, phone)
    if (result.success) {
      setSuccess('ยืนยันตัวตนสำเร็จ! บัญชีของคุณได้รับการรับรองสิทธิ์ซื้อ-ขายต่อเรียบร้อย')
      setTimeout(() => {
        onSuccess(result.user)
        onClose()
      }, 900)
    } else {
      setError(result.error || 'เกิดข้อผิดพลาดในการยืนยันตัวตน')
    }
  }

  const validityHint = (show: boolean, valid: boolean, okText: string, hintText: string) =>
    show && (
      <span className={`text-[10px] font-mono flex items-center gap-1 ${valid ? 'text-emerald-400' : 'text-stone-500'}`}>
        {valid ? (
          <>
            <Check className="w-3 h-3 text-emerald-400" />
            <span>{okText}</span>
          </>
        ) : (
          <span>{hintText}</span>
        )}
      </span>
    )

  const canSubmit = otpSent && otp.length === 6

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/85 backdrop-blur-sm overflow-y-auto animate-in fade-in duration-200 font-['Plus_Jakarta_Sans','Prompt',sans-serif]">
      <div
        className="relative w-full max-w-lg bg-[#0e0b17] border border-purple-900/40 rounded-2xl shadow-2xl overflow-hidden my-auto max-h-[92vh] flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between px-5 py-4 bg-[#09080e] border-b border-purple-900/30">
          <div className="flex items-center gap-3">
            <KapsulepLogo size={34} showGlow />
            <div>
              <div className="flex items-center gap-1.5">
                <h2 className="font-bold text-stone-100 text-base font-['Prompt',sans-serif]">ยืนยันตัวตนผู้ใช้งาน (KYC)</h2>
                <span className="text-[10px] font-mono px-1.5 py-0.2 rounded bg-purple-950 text-purple-300 border border-purple-500/40 font-bold">
                  ข้อบังคับระบบ
                </span>
              </div>
              <p className="text-xs text-stone-400 font-['Prompt',sans-serif]">อ้างอิงเลขบัตรประชาชน 13 หลัก และเบอร์โทรศัพท์</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 text-stone-400 hover:text-stone-200 hover:bg-[#1a142c] rounded-lg cursor-pointer transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-4 mx-5 mt-4 rounded-xl bg-gradient-to-r from-purple-950/40 via-[#151022] to-rose-950/30 border border-rose-500/40 space-y-1.5 text-xs font-['Prompt',sans-serif]">
          <div className="flex items-center gap-1.5 font-bold text-rose-300">
            <Sparkles className="w-4 h-4 text-rose-400" />
            <span>เงื่อนไขสำคัญ: การซื้อ ขายต่อ ต้องยืนยันตัวตนเท่านั้น</span>
          </div>
          <p className="text-stone-300 text-[11px] leading-relaxed font-light">
            ผู้ใช้งาน 1 คน (อ้างอิงเลขบัตรประชาชนและเบอร์โทรศัพท์) สามารถถือครองหน้าต่างได้ <strong>ไม่เกิน 2 บาน</strong> ประกอบด้วย:
          </p>
          <div className="grid grid-cols-2 gap-2 pt-1 font-mono text-[11px]">
            <div className="p-2 rounded-lg bg-[#09080e] border border-purple-500/40 text-rose-300 font-['Prompt',sans-serif]">
              🇹🇭 1. หน้าต่างบานประเทศไทย: <strong>1 บาน</strong>
            </div>
            <div className="p-2 rounded-lg bg-[#09080e] border border-purple-500/40 text-purple-300 font-['Prompt',sans-serif]">
              🗺️ 2. หน้าต่างบานภูมิภาค: <strong>1 บาน</strong>
            </div>
          </div>
          {reasonNotice && (
            <p className="text-rose-200/90 text-[11px] pt-1 border-t border-purple-900/40 italic font-light">ℹ️ {reasonNotice}</p>
          )}
        </div>

        {error && (
          <div className="mx-5 mt-3 p-3 rounded-xl bg-rose-950/80 border border-rose-800 text-rose-200 text-xs flex items-center gap-2">
            <CircleAlert className="w-4 h-4 text-rose-400 shrink-0" />
            <span>{error}</span>
          </div>
        )}
        {success && (
          <div className="mx-5 mt-3 p-3 rounded-xl bg-emerald-950/80 border border-emerald-800 text-emerald-200 text-xs flex items-center gap-2">
            <Check className="w-4 h-4 text-emerald-400 shrink-0" />
            <span>{success}</span>
          </div>
        )}

        <form onSubmit={submit} className="p-5 space-y-4 overflow-y-auto flex-1 text-xs">
          <div>
            <label className="block text-stone-300 font-medium mb-1">ชื่อ-นามสกุล ที่แสดงในระบบ</label>
            <input
              type="text"
              value={currentUser.name}
              disabled
              className="w-full bg-stone-950/60 border border-stone-800 text-stone-400 px-3 py-2 rounded-xl text-xs cursor-not-allowed"
            />
          </div>

          <div>
            <div className="flex items-center justify-between mb-1">
              <label className="text-stone-300 font-medium flex items-center gap-1.5">
                <CreditCard className="w-3.5 h-3.5 text-amber-400" />
                <span>
                  เลขประจำตัวประชาชน 13 หลัก <span className="text-amber-400">*</span>
                </span>
              </label>
              {validityHint(!!citizenId, citizenIdValid, 'เลขบัตรถูกต้อง', 'ระบุ 13 หลัก')}
            </div>
            <input
              type="text"
              value={citizenId}
              onChange={(e) => setCitizenId(formatCitizenId(e.target.value))}
              placeholder="x-xxxx-xxxxx-xx-x"
              maxLength={17}
              className={`w-full bg-stone-950 border px-3 py-2.5 rounded-xl font-mono text-sm tracking-wider focus:outline-none ${citizenIdValid ? 'border-emerald-500 text-emerald-300 focus:border-emerald-400' : 'border-stone-700 text-stone-100 focus:border-amber-400'}`}
              required
            />
            <p className="text-[10px] text-stone-500 mt-1">
              * ข้อมูลจะถูกจัดเก็บเข้ารหัสอย่างปลอดภัย เพื่อใช้ตรวจสอบการถือครองหน้าต่างตามโควตาไม่เกิน 2 บาน
            </p>
          </div>

          <div>
            <div className="flex items-center justify-between mb-1">
              <label className="text-stone-300 font-medium flex items-center gap-1.5">
                <Phone className="w-3.5 h-3.5 text-cyan-400" />
                <span>
                  เบอร์โทรศัพท์มือถือ <span className="text-amber-400">*</span>
                </span>
              </label>
              {validityHint(!!phone, phoneValid, 'เบอร์ถูกต้อง', 'ระบุ 10 หลัก')}
            </div>
            <div className="flex gap-2">
              <input
                type="tel"
                value={phone}
                onChange={(e) => setPhone(formatPhone(e.target.value))}
                placeholder="0xx-xxx-xxxx"
                maxLength={12}
                className="flex-1 bg-stone-950 border border-stone-700 text-stone-100 px-2.5 py-1.5 min-h-9 rounded-lg font-mono text-xs tracking-wider focus:outline-none focus:border-amber-400"
                required
              />
              <button
                type="button"
                onClick={requestOtp}
                className="px-2.5 py-1.5 min-h-9 bg-stone-800 hover:bg-stone-700 text-amber-300 border border-amber-500/40 rounded-lg font-medium cursor-pointer transition-colors text-[11px] whitespace-nowrap flex items-center gap-1"
              >
                <Send className="w-3 h-3" />
                <span>{otpSent ? 'ส่ง OTP อีกครั้ง' : 'ขอรหัส OTP'}</span>
              </button>
            </div>
          </div>

          {otpSent && (
            <div className="p-3 bg-cyan-950/40 border border-cyan-500/50 rounded-xl space-y-2 animate-in fade-in duration-200">
              <div className="flex items-center justify-between">
                <span className="text-cyan-300 text-xs font-semibold">📱 จำลองข้อความ SMS เข้าเบอร์ {phone}</span>
                <span className="font-mono text-xs px-2 py-0.5 rounded bg-cyan-500/20 text-cyan-200 font-bold">OTP: {expectedOtp}</span>
              </div>
              <p className="text-[11px] text-stone-300">
                รหัสยืนยัน OTP 6 หลักของคุณคือ <strong className="text-cyan-300 font-mono tracking-widest">{expectedOtp}</strong>{' '}
                (ระบบได้กรอกให้อัตโนมัติเพื่อความสะดวกรวดเร็วในการทดสอบ)
              </p>
              <div>
                <label className="block text-[11px] text-stone-300 font-medium mb-1">กรอกรหัสยืนยัน OTP 6 หลัก:</label>
                <input
                  type="text"
                  maxLength={6}
                  value={otp}
                  onChange={(e) => setOtp(e.target.value.replace(/[^0-9]/g, ''))}
                  placeholder="xxxxxx"
                  className="w-full bg-stone-950 border border-cyan-500/60 text-cyan-200 font-mono font-bold text-center text-base tracking-widest py-2 rounded-lg focus:outline-none"
                  required
                />
              </div>
            </div>
          )}

          <div className="pt-2">
            <button
              type="submit"
              disabled={!canSubmit}
              className={`w-full py-3 px-4 rounded-xl font-bold font-['Prompt',sans-serif] flex items-center justify-center gap-2 transition-all cursor-pointer ${canSubmit ? 'bg-gradient-to-r from-orange-500 via-rose-500 to-purple-600 hover:opacity-95 shadow-lg shadow-rose-500/20 text-white text-sm' : 'bg-[#181326] text-stone-500 cursor-not-allowed text-xs'}`}
            >
              <ShieldCheck className="w-4 h-4" />
              <span>ยืนยันข้อมูลตัวตนและเปิดสิทธิ์ซื้อ-ขาย-โอน</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
