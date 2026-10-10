import { useState } from 'react'
import { Check, CircleAlert, CreditCard, Eye, EyeOff, KeyRound, Loader2, Lock, Mail, Phone, Save, ShieldCheck, UserRound, X } from 'lucide-react'
import type { User } from '@shared/types'
import { changePassword, getAppConfig, updateProfile } from '@/lib/store'
import { maskCitizenId, maskPhone } from '@shared/identity'
import { KapsulepLogo } from '../KapsulepLogo'

interface ProfileModalProps {
  currentUser: User
  onClose: () => void
  /** Called after a save, so the app can refresh the account and show a toast. */
  onSaved: (message: string) => void
  onOpenKyc: () => void
}

const inputClass =
  'w-full bg-stone-950 border border-stone-700 text-stone-100 rounded-xl focus:outline-none focus:border-amber-400 text-xs px-3 py-2 disabled:opacity-60'
const submitClass =
  'w-full py-2.5 px-4 rounded-xl font-bold text-stone-950 bg-gradient-to-r from-amber-400 via-amber-300 to-amber-500 hover:from-amber-300 hover:to-amber-400 transition-all cursor-pointer flex items-center justify-center gap-2 shadow-md shadow-amber-500/20 text-xs sm:text-sm disabled:opacity-60 disabled:cursor-wait'

/** The signed-in user's own details: name, bio, email and password. ID and phone change through KYC. */
export function ProfileModal({ currentUser, onClose, onSaved, onOpenKyc }: ProfileModalProps) {
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  const notify = (message: string) => {
    setError('')
    setSuccess(message)
    onSaved(message)
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/80 backdrop-blur-sm overflow-y-auto animate-in fade-in duration-200 font-['Plus_Jakarta_Sans','Prompt',sans-serif]">
      <div
        className="relative w-full max-w-md bg-[#0e0b17] border border-purple-900/40 rounded-2xl shadow-2xl overflow-hidden my-auto max-h-[92vh] flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between px-5 py-4 bg-[#09080e] border-b border-purple-900/30">
          <div className="flex items-center gap-3">
            <KapsulepLogo size={34} showGlow />
            <div>
              <h2 className="font-bold text-stone-100 text-base font-['Prompt',sans-serif]">ข้อมูลส่วนตัว</h2>
              <p className="text-xs text-stone-400 font-['Prompt',sans-serif]">แก้ไขชื่อ อีเมล และรหัสผ่านของคุณ</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 text-stone-400 hover:text-stone-200 hover:bg-[#1a142c] rounded-lg cursor-pointer transition-colors"
            aria-label="ปิด"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {error && (
          <div className="mx-5 mt-4 p-3 rounded-xl bg-rose-950/80 border border-rose-800 text-rose-200 text-xs flex items-center gap-2">
            <CircleAlert className="w-4 h-4 text-rose-400 shrink-0" />
            <span>{error}</span>
          </div>
        )}
        {success && (
          <div className="mx-5 mt-4 p-3 rounded-xl bg-emerald-950/80 border border-emerald-800 text-emerald-200 text-xs flex items-center gap-2">
            <Check className="w-4 h-4 text-emerald-400 shrink-0" />
            <span>{success}</span>
          </div>
        )}

        <div className="p-5 overflow-y-auto flex-1 text-xs space-y-5">
          <DetailsForm user={currentUser} onError={setError} onSaved={notify} />
          <IdentityInfo
            user={currentUser}
            onOpenKyc={() => {
              onClose()
              onOpenKyc()
            }}
          />
          <PasswordForm onError={setError} onSaved={notify} />
        </div>
      </div>
    </div>
  )
}

function SectionTitle({ icon: Icon, children }: { icon: typeof UserRound; children: React.ReactNode }) {
  return (
    <h3 className="flex items-center gap-1.5 font-bold text-stone-200 text-sm font-['Prompt',sans-serif]">
      <Icon className="w-4 h-4 text-amber-400" />
      {children}
    </h3>
  )
}

function DetailsForm({ user, onError, onSaved }: { user: User; onError: (message: string) => void; onSaved: (message: string) => void }) {
  const [name, setName] = useState(user.name)
  const [bio, setBio] = useState(user.bio ?? '')
  const [email, setEmail] = useState(user.email)
  const [currentPassword, setCurrentPassword] = useState('')
  const [busy, setBusy] = useState(false)
  const emailChanged = email.trim().toLowerCase() !== user.email

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    onError('')
    if (!name.trim()) return onError('กรุณาระบุชื่อ')
    if (!email.trim() || !email.includes('@')) return onError('กรุณาระบุอีเมลที่ถูกต้อง')
    if (emailChanged && !currentPassword) return onError('กรุณากรอกรหัสผ่านปัจจุบันเพื่อเปลี่ยนอีเมล')
    setBusy(true)
    const result = await updateProfile({ name: name.trim(), bio, email: email.trim(), currentPassword: emailChanged ? currentPassword : undefined })
    setBusy(false)
    if (!result.success) return onError(result.error || 'บันทึกไม่สำเร็จ')
    setCurrentPassword('')
    onSaved('บันทึกข้อมูลส่วนตัวเรียบร้อยแล้ว')
  }

  return (
    <form onSubmit={submit} className="space-y-3">
      <SectionTitle icon={UserRound}>ข้อมูลทั่วไป</SectionTitle>
      <div className="flex items-center gap-3">
        <img src={user.avatarUrl} alt="" className="w-12 h-12 rounded-full object-cover border-2 border-amber-400 shrink-0" />
        <div className="flex-1">
          <label className="block text-stone-300 font-medium mb-1">ชื่อที่แสดง</label>
          <input value={name} onChange={(e) => setName(e.target.value)} maxLength={120} autoComplete="name" className={inputClass} required />
        </div>
      </div>
      <div>
        <label className="block text-stone-300 font-medium mb-1">แนะนำตัว</label>
        <textarea
          value={bio}
          onChange={(e) => setBio(e.target.value)}
          maxLength={500}
          rows={2}
          placeholder="เล่าเกี่ยวกับตัวคุณสั้นๆ (ไม่บังคับ)"
          className={`${inputClass} resize-none`}
        />
      </div>
      <div>
        <label className="block text-stone-300 font-medium mb-1">อีเมล (ใช้เข้าสู่ระบบและกู้รหัสผ่าน)</label>
        <div className="relative">
          <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-stone-500" />
          <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} autoComplete="email" className={`${inputClass} pl-8`} required />
        </div>
      </div>
      {emailChanged && (
        <div>
          <label className="block text-stone-300 font-medium mb-1">รหัสผ่านปัจจุบัน (เพื่อยืนยันการเปลี่ยนอีเมล)</label>
          <div className="relative">
            <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-stone-500" />
            <input
              type="password"
              value={currentPassword}
              onChange={(e) => setCurrentPassword(e.target.value)}
              autoComplete="current-password"
              className={`${inputClass} pl-8`}
              required
            />
          </div>
        </div>
      )}
      <button type="submit" disabled={busy} className={submitClass}>
        {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
        <span>บันทึกข้อมูล</span>
      </button>
    </form>
  )
}

function IdentityInfo({ user, onOpenKyc }: { user: User; onOpenKyc: () => void }) {
  return (
    <div className="space-y-2 pt-4 border-t border-stone-800">
      <SectionTitle icon={ShieldCheck}>ข้อมูลยืนยันตัวตน</SectionTitle>
      <div className="grid grid-cols-2 gap-2">
        <div className="p-2.5 rounded-xl bg-stone-950 border border-stone-800">
          <span className="flex items-center gap-1 text-[10px] text-stone-500">
            <Phone className="w-3 h-3" /> เบอร์โทรศัพท์
          </span>
          <span className="font-mono text-stone-200">{maskPhone(user.phone) || '-'}</span>
        </div>
        <div className="p-2.5 rounded-xl bg-stone-950 border border-stone-800">
          <span className="flex items-center gap-1 text-[10px] text-stone-500">
            <CreditCard className="w-3 h-3" /> เลขบัตรประชาชน
          </span>
          <span className="font-mono text-stone-200">{maskCitizenId(user.citizenId) || '-'}</span>
        </div>
      </div>
      {user.isVerified ? (
        <p className="text-[11px] text-emerald-300">✓ ยืนยันตัวตน (KYC) แล้ว · หากต้องการเปลี่ยนเบอร์หรือเลขบัตร กรุณาติดต่อผู้ดูแลระบบ</p>
      ) : (
        <button
          type="button"
          onClick={onOpenKyc}
          className="w-full flex items-center justify-center gap-1.5 p-2 rounded-xl bg-gradient-to-r from-orange-500 via-rose-500 to-purple-600 text-white font-bold cursor-pointer hover:opacity-95"
        >
          <ShieldCheck className="w-4 h-4" /> ยืนยันตัวตน (KYC) เพื่อบันทึกเบอร์และเลขบัตร
        </button>
      )}
    </div>
  )
}

function PasswordForm({ onError, onSaved }: { onError: (message: string) => void; onSaved: (message: string) => void }) {
  const { minPasswordLength } = getAppConfig()
  const [current, setCurrent] = useState('')
  const [next, setNext] = useState('')
  const [confirm, setConfirm] = useState('')
  const [show, setShow] = useState(false)
  const [busy, setBusy] = useState(false)

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    onError('')
    if (next.length < minPasswordLength) return onError(`รหัสผ่านใหม่ต้องมีความยาวอย่างน้อย ${minPasswordLength} ตัวอักษร`)
    if (next !== confirm) return onError('รหัสผ่านใหม่และการยืนยันรหัสผ่านไม่ตรงกัน')
    setBusy(true)
    const result = await changePassword(current, next)
    setBusy(false)
    if (!result.success) return onError(result.error || 'เปลี่ยนรหัสผ่านไม่สำเร็จ')
    setCurrent('')
    setNext('')
    setConfirm('')
    onSaved('เปลี่ยนรหัสผ่านเรียบร้อยแล้ว')
  }

  const type = show ? 'text' : 'password'
  return (
    <form onSubmit={submit} className="space-y-3 pt-4 border-t border-stone-800">
      <div className="flex items-center justify-between">
        <SectionTitle icon={KeyRound}>เปลี่ยนรหัสผ่าน</SectionTitle>
        <button type="button" onClick={() => setShow(!show)} className="text-stone-400 hover:text-stone-200 cursor-pointer" aria-label="แสดงรหัสผ่าน">
          {show ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
        </button>
      </div>
      <div>
        <label className="block text-stone-300 font-medium mb-1">รหัสผ่านปัจจุบัน</label>
        <input type={type} value={current} onChange={(e) => setCurrent(e.target.value)} autoComplete="current-password" className={inputClass} required />
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
        <div>
          <label className="block text-stone-300 font-medium mb-1">รหัสผ่านใหม่ (≥ {minPasswordLength} ตัว)</label>
          <input type={type} value={next} onChange={(e) => setNext(e.target.value)} autoComplete="new-password" className={inputClass} required />
        </div>
        <div>
          <label className="block text-stone-300 font-medium mb-1">ยืนยันรหัสผ่านใหม่</label>
          <input type={type} value={confirm} onChange={(e) => setConfirm(e.target.value)} autoComplete="new-password" className={inputClass} required />
        </div>
      </div>
      <button type="submit" disabled={busy} className={submitClass}>
        {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : <KeyRound className="w-4 h-4" />}
        <span>เปลี่ยนรหัสผ่าน</span>
      </button>
    </form>
  )
}
