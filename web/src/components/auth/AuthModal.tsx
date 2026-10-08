import { useEffect, useState } from 'react'
import { Check, CircleAlert, CreditCard, Eye, EyeOff, Loader2, Lock, LogIn, Mail, Phone, ShieldCheck, UserPlus, X } from 'lucide-react'
import type { AuthMode, Result, User } from '@shared/types'
import { getAppConfig, type SignupInput } from '@/lib/store'
import { activeSignupBonus, useSettings } from '@/lib/settings'
import { formatCitizenId, formatPhone, isValidCitizenId, isValidThaiMobile } from '@shared/identity'
import { KapsulepLogo } from '../KapsulepLogo'

interface AuthModalProps {
  isOpen: boolean
  onClose: () => void
  initialMode?: AuthMode
  currentUser: User | null
  onLogin: (identifier: string, password: string) => Promise<Result<{ user: User }>>
  onRegister: (input: SignupInput) => Promise<Result<{ user: User }>>
}

type Mode = 'login' | 'signup'

const MODE_TITLES: Record<Mode, string> = {
  login: 'เข้าสู่ระบบ (Log in)',
  signup: 'สมัครสมาชิกใหม่ (Sign up)',
}

/** Mounted only while open, so every opening starts with a fresh form. */
export function AuthModal({ isOpen, initialMode = 'login', ...props }: AuthModalProps) {
  return isOpen ? <AuthDialog {...props} initialMode={initialMode} /> : null
}

function AuthDialog({
  onClose,
  initialMode,
  onLogin,
  onRegister,
}: Omit<AuthModalProps, 'isOpen' | 'initialMode' | 'currentUser'> & { initialMode: Mode }) {
  const [mode, setMode] = useState<Mode>(initialMode)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    setMode(initialMode)
    setError('')
    setSuccess('')
  }, [initialMode])

  const switchMode = (next: Mode) => {
    setMode(next)
    setError('')
  }

  const run = async (action: () => Promise<Result<{ user: User }>>, message: (user: User) => string) => {
    setError('')
    setSuccess('')
    setBusy(true)
    const result = await action()
    setBusy(false)
    if (!result.success) return setError(result.error || 'ทำรายการไม่สำเร็จ')
    setSuccess(message(result.user))
    setTimeout(onClose, 800)
  }

  const tabClass = (active: boolean) =>
    `py-2 px-2 rounded-lg font-medium transition-all cursor-pointer flex items-center justify-center gap-1.5 ${active ? 'bg-gradient-to-r from-orange-500 via-rose-500 to-purple-600 text-white font-bold shadow-sm' : 'text-stone-400 hover:text-stone-200'}`

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
              <h2 className="font-bold text-stone-100 text-base font-['Prompt',sans-serif]">{MODE_TITLES[mode]}</h2>
              <p className="text-xs text-stone-400 font-['Prompt',sans-serif]">ระบบจัดการสิทธิ์และเจ้าของหน้าต่างประเทศไทย</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 text-stone-400 hover:text-stone-200 hover:bg-[#1a142c] rounded-lg cursor-pointer transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="grid grid-cols-2 border-b border-purple-900/30 bg-[#0c0a13] p-1 text-xs font-['Prompt',sans-serif]">
          <button type="button" onClick={() => switchMode('login')} className={tabClass(mode === 'login')}>
            <LogIn className="w-3.5 h-3.5" />
            <span>เข้าสู่ระบบ</span>
          </button>
          <button type="button" onClick={() => switchMode('signup')} className={tabClass(mode === 'signup')}>
            <UserPlus className="w-3.5 h-3.5" />
            <span>สมัครสมาชิก</span>
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

        <div className="p-5 overflow-y-auto flex-1 text-xs">
          {mode === 'login' && (
            <LoginForm
              busy={busy}
              onSubmit={(identifier, password) => {
                if (!identifier.trim()) return setError('กรุณาระบุอีเมล เบอร์โทรศัพท์ หรือเลขบัตรประชาชน')
                run(() => onLogin(identifier.trim(), password), (user) => `เข้าสู่ระบบสำเร็จ ยินดีต้อนรับคุณ ${user.name}`)
              }}
              onGoSignup={() => switchMode('signup')}
            />
          )}
          {mode === 'signup' && (
            <SignupForm
              busy={busy}
              onError={setError}
              onSubmit={(input) => run(() => onRegister(input), () => 'สมัครสมาชิกสำเร็จ! ขั้นต่อไป: ยืนยันตัวตนด้วย OTP เพื่อเปิดสิทธิ์ซื้อ-ขาย')}
              onGoLogin={() => switchMode('login')}
            />
          )}
        </div>
      </div>
    </div>
  )
}

const inputClass =
  'w-full bg-stone-950 border border-stone-700 text-stone-100 rounded-xl focus:outline-none focus:border-amber-400 text-xs'
const submitClass =
  'w-full py-2.5 px-4 rounded-xl font-bold text-stone-950 bg-gradient-to-r from-amber-400 via-amber-300 to-amber-500 hover:from-amber-300 hover:to-amber-400 transition-all cursor-pointer flex items-center justify-center gap-2 shadow-md shadow-amber-500/20 text-xs sm:text-sm disabled:opacity-60 disabled:cursor-wait'

function LoginForm({
  busy,
  onSubmit,
  onGoSignup,
}: {
  busy: boolean
  onSubmit: (identifier: string, password: string) => void
  onGoSignup: () => void
}) {
  const [identifier, setIdentifier] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault()
        onSubmit(identifier, password)
      }}
      className="space-y-4"
    >
      <div>
        <label className="block text-stone-300 font-medium mb-1">อีเมล, เบอร์โทร หรือเลขบัตรประชาชน</label>
        <div className="relative">
          <div className="absolute left-3 top-1/2 -translate-y-1/2 text-stone-500">
            <Mail className="w-4 h-4" />
          </div>
          <input
            type="text"
            value={identifier}
            onChange={(e) => setIdentifier(e.target.value)}
            placeholder="เช่น you@example.com หรือ 081-xxx-xxxx"
            autoComplete="username"
            className={`${inputClass} pl-9 pr-3 py-2.5`}
            required
          />
        </div>
      </div>
      <div>
        <label className="block text-stone-300 font-medium mb-1">รหัสผ่าน</label>
        <div className="relative">
          <div className="absolute left-3 top-1/2 -translate-y-1/2 text-stone-500">
            <Lock className="w-4 h-4" />
          </div>
          <input
            type={showPassword ? 'text' : 'password'}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="กรอกรหัสผ่านของคุณ"
            autoComplete="current-password"
            className={`${inputClass} pl-9 pr-10 py-2.5`}
            required
          />
          <button
            type="button"
            onClick={() => setShowPassword(!showPassword)}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-stone-400 hover:text-stone-200 cursor-pointer"
          >
            {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
          </button>
        </div>
      </div>
      <button type="submit" disabled={busy} className={`${submitClass} mt-2`}>
        {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : <LogIn className="w-4 h-4" />}
        <span>เข้าสู่ระบบ</span>
      </button>
      <div className="pt-2 text-center">
        <span className="text-stone-400 text-[11px]">ยังไม่มีบัญชีใช่หรือไม่? </span>
        <button type="button" onClick={onGoSignup} className="text-amber-400 hover:underline font-bold text-[11px] cursor-pointer">
          สมัครสมาชิกใหม่ที่นี่
        </button>
      </div>
    </form>
  )
}

function SignupForm({
  busy,
  onSubmit,
  onError,
  onGoLogin,
}: {
  busy: boolean
  onSubmit: (input: SignupInput) => void
  onError: (message: string) => void
  onGoLogin: () => void
}) {
  const { minPasswordLength } = getAppConfig()
  const signupBonus = activeSignupBonus(useSettings())
  const [name, setName] = useState('')
  const [citizenId, setCitizenId] = useState('')
  const [phone, setPhone] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const citizenIdValid = isValidCitizenId(citizenId)

  const submit = (e: React.FormEvent) => {
    e.preventDefault()
    onError('')
    if (!name.trim()) return onError('กรุณาระบุชื่อ-นามสกุล')
    if (!citizenIdValid) return onError('กรุณาระบุเลขประจำตัวประชาชน 13 หลักให้ถูกต้อง')
    if (!isValidThaiMobile(phone)) return onError('กรุณาระบุเบอร์โทรศัพท์ 10 หลักให้ถูกต้อง (06, 08, 09)')
    if (!email.trim() || !email.includes('@')) return onError('กรุณาระบุอีเมลที่ถูกต้อง')
    if (password.length < minPasswordLength) return onError(`รหัสผ่านต้องมีความยาวอย่างน้อย ${minPasswordLength} ตัวอักษร`)
    if (password !== confirmPassword) return onError('รหัสผ่านและการยืนยันรหัสผ่านไม่ตรงกัน')
    onSubmit({ name: name.trim(), citizenId: citizenId.trim(), phone: phone.trim(), email: email.trim(), password })
  }

  const passwordToggle = (
    <button
      type="button"
      onClick={() => setShowPassword(!showPassword)}
      className="absolute right-2.5 top-1/2 -translate-y-1/2 text-stone-400 hover:text-stone-200"
    >
      {showPassword ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
    </button>
  )

  return (
    <form onSubmit={submit} className="space-y-3.5">
      <div className="p-2.5 rounded-xl bg-gradient-to-r from-amber-950/50 to-stone-900 border border-amber-500/40 text-amber-200 flex items-center gap-2">
        <ShieldCheck className="w-4 h-4 text-amber-400 shrink-0" />
        <span className="text-[11px] leading-tight">
          โควตาหน้าต่าง 2 บาน (ไทย 1 บาน + ภูมิภาค 1 บาน)
          {signupBonus > 0 && (
            <>
              {' '}· รับเครดิตเริ่มต้น <strong className="text-amber-300 font-mono">{signupBonus.toLocaleString()} ฿</strong>
            </>
          )}
          {' '}· เลขบัตรประชาชนถูกเข้ารหัสก่อนจัดเก็บ
        </span>
      </div>

      <div>
        <label className="block text-stone-300 font-medium mb-1">
          ชื่อ-นามสกุล <span className="text-amber-400">*</span>
        </label>
        <input
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="เช่น สมชาย ใจดี หรือ คุณพรทิพย์"
          autoComplete="name"
          className={`${inputClass} px-3 py-2`}
          required
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
          {citizenId && (
            <span className={`text-[10px] font-mono ${citizenIdValid ? 'text-emerald-400' : 'text-stone-500'}`}>
              {citizenIdValid ? '✓ ถูกต้อง' : 'ระบุ 13 หลัก'}
            </span>
          )}
        </div>
        <input
          type="text"
          value={citizenId}
          onChange={(e) => setCitizenId(formatCitizenId(e.target.value))}
          placeholder="x-xxxx-xxxxx-xx-x"
          maxLength={17}
          className={`w-full bg-stone-950 border px-3 py-2 rounded-xl font-mono text-xs tracking-wider focus:outline-none ${citizenIdValid ? 'border-emerald-500 text-emerald-300' : 'border-stone-700 text-stone-100 focus:border-amber-400'}`}
          required
        />
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
        <div>
          <label className="block text-stone-300 font-medium mb-1">
            เบอร์โทรศัพท์ <span className="text-amber-400">*</span>
          </label>
          <div className="relative">
            <Phone className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-stone-500" />
            <input
              type="tel"
              value={phone}
              onChange={(e) => setPhone(formatPhone(e.target.value))}
              placeholder="0xx-xxx-xxxx"
              maxLength={12}
              autoComplete="tel"
              className={`${inputClass} pl-8 pr-2 py-2 font-mono`}
              required
            />
          </div>
        </div>
        <div>
          <label className="block text-stone-300 font-medium mb-1">
            อีเมล <span className="text-amber-400">*</span>
          </label>
          <div className="relative">
            <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-stone-500" />
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="user@example.com"
              autoComplete="email"
              className={`${inputClass} pl-8 pr-2 py-2`}
              required
            />
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
        <div>
          <label className="block text-stone-300 font-medium mb-1">
            รหัสผ่าน (≥ {minPasswordLength} ตัว) <span className="text-amber-400">*</span>
          </label>
          <div className="relative">
            <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-stone-500" />
            <input
              type={showPassword ? 'text' : 'password'}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="ตั้งรหัสผ่าน"
              autoComplete="new-password"
              className={`${inputClass} pl-8 pr-8 py-2`}
              required
            />
            {passwordToggle}
          </div>
        </div>
        <div>
          <label className="block text-stone-300 font-medium mb-1">
            ยืนยันรหัสผ่าน <span className="text-amber-400">*</span>
          </label>
          <div className="relative">
            <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-stone-500" />
            <input
              type={showPassword ? 'text' : 'password'}
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              placeholder="พิมพ์อีกครั้ง"
              autoComplete="new-password"
              className={`${inputClass} pl-8 pr-2 py-2`}
              required
            />
          </div>
        </div>
      </div>

      <p className="text-[11px] text-stone-400 leading-snug">
        หลังสมัคร ยืนยันตัวตน (KYC) ด้วยรหัส OTP ทางเบอร์โทรศัพท์ เพื่อเปิดสิทธิ์จับจองและซื้อ-ขายต่อหน้าต่าง
      </p>

      <button type="submit" disabled={busy} className={`${submitClass} mt-3`}>
        {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : <UserPlus className="w-4 h-4" />}
        <span>สมัครสมาชิก</span>
      </button>
      <div className="pt-2 text-center">
        <span className="text-stone-400 text-[11px]">มีบัญชีอยู่แล้วใช่หรือไม่? </span>
        <button type="button" onClick={onGoLogin} className="text-amber-400 hover:underline font-bold text-[11px] cursor-pointer">
          เข้าสู่ระบบที่นี่
        </button>
      </div>
    </form>
  )
}
