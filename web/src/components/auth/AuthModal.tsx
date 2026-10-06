import { useEffect, useState } from 'react'
import { Check, CircleAlert, CreditCard, Eye, EyeOff, Lock, LogIn, Mail, Phone, ShieldCheck, UserPlus, Users, X } from 'lucide-react'
import type { AuthMode, Result, User } from '@/types'
import type { SignupInput } from '@/lib/store'
import { formatCitizenId, formatPhone, isValidCitizenId, isValidThaiMobile, maskCitizenId, maskPhone } from '@/lib/identity'
import { KapsulepLogo } from '../KapsulepLogo'

const AVATAR_CHOICES = [
  'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?auto=format&fit=crop&w=200&q=80',
  'https://images.unsplash.com/photo-1570295999919-56ceb5ecca61?auto=format&fit=crop&w=200&q=80',
  'https://images.unsplash.com/photo-1580489944761-15a19d654956?auto=format&fit=crop&w=200&q=80',
  'https://images.unsplash.com/photo-1527980965255-d3b416303d12?auto=format&fit=crop&w=200&q=80',
  'https://images.unsplash.com/photo-1544005313-94ddf0286df2?auto=format&fit=crop&w=200&q=80',
  'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?auto=format&fit=crop&w=200&q=80',
]

interface AuthModalProps {
  isOpen: boolean
  onClose: () => void
  initialMode?: AuthMode
  currentUser: User | null
  registeredUsers: User[]
  onLogin: (identifier: string, password: string) => Result<{ user: User }>
  onRegister: (input: SignupInput) => Result<{ user: User }>
  /** Demo: switch to another account without a password. */
  onQuickSwitch: (userId: string) => void
}

const MODE_TITLES: Record<AuthMode, string> = {
  login: 'เข้าสู่ระบบ (Log in)',
  signup: 'สมัครสมาชิกใหม่ (Sign up)',
  switch: 'เลือกสลับบัญชีทดสอบ',
}

export function AuthModal({
  isOpen,
  onClose,
  initialMode = 'login',
  currentUser,
  registeredUsers,
  onLogin,
  onRegister,
  onQuickSwitch,
}: AuthModalProps) {
  const [mode, setMode] = useState<AuthMode>(initialMode)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')

  useEffect(() => {
    if (!isOpen) return
    setMode(initialMode)
    setError('')
    setSuccess('')
  }, [isOpen, initialMode])

  if (!isOpen) return null

  const switchMode = (next: AuthMode) => {
    setMode(next)
    setError('')
  }
  const showResult = (message: string, delay: number) => {
    setSuccess(message)
    setTimeout(onClose, delay)
  }
  const quickSwitch = (userId: string) => {
    onQuickSwitch(userId)
    showResult('สลับบัญชีผู้ใช้สำเร็จ!', 500)
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

        <div className="grid grid-cols-3 border-b border-purple-900/30 bg-[#0c0a13] p-1 text-xs font-['Prompt',sans-serif]">
          <button type="button" onClick={() => switchMode('login')} className={tabClass(mode === 'login')}>
            <LogIn className="w-3.5 h-3.5" />
            <span>เข้าสู่ระบบ</span>
          </button>
          <button type="button" onClick={() => switchMode('signup')} className={tabClass(mode === 'signup')}>
            <UserPlus className="w-3.5 h-3.5" />
            <span>สมัครสมาชิก</span>
          </button>
          <button type="button" onClick={() => switchMode('switch')} className={tabClass(mode === 'switch')}>
            <Users className="w-3.5 h-3.5" />
            <span>สลับบัญชี</span>
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
              registeredUsers={registeredUsers}
              onSubmit={(identifier, password) => {
                setError('')
                setSuccess('')
                if (!identifier.trim()) {
                  setError('กรุณาระบุอีเมล เบอร์โทรศัพท์ หรือเลขบัตรประชาชน')
                  return
                }
                const result = onLogin(identifier.trim(), password)
                if (result.success) showResult(`เข้าสู่ระบบสำเร็จ ยินดีต้อนรับคุณ ${result.user.name}`, 700)
                else setError(result.error || 'เข้าสู่ระบบไม่สำเร็จ')
              }}
              onGoSignup={() => switchMode('signup')}
              onQuickSwitch={quickSwitch}
            />
          )}
          {mode === 'signup' && (
            <SignupForm
              onError={setError}
              onSubmit={(input) => {
                setError('')
                setSuccess('')
                const result = onRegister(input)
                if (result.success) showResult('สมัครสมาชิกสำเร็จ! ได้รับโบนัสเริ่มต้น 10,000 ฿ ในกระเป๋าเงิน', 1000)
                else setError(result.error || 'สมัครสมาชิกไม่สำเร็จ')
              }}
              onGoLogin={() => switchMode('login')}
            />
          )}
          {mode === 'switch' && (
            <AccountSwitcher
              users={registeredUsers}
              currentUserId={currentUser?.id}
              onPick={quickSwitch}
              onGoSignup={() => switchMode('signup')}
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
  'w-full py-2.5 px-4 rounded-xl font-bold text-stone-950 bg-gradient-to-r from-amber-400 via-amber-300 to-amber-500 hover:from-amber-300 hover:to-amber-400 transition-all cursor-pointer flex items-center justify-center gap-2 shadow-md shadow-amber-500/20 text-xs sm:text-sm'

function LoginForm({
  registeredUsers,
  onSubmit,
  onGoSignup,
  onQuickSwitch,
}: {
  registeredUsers: User[]
  onSubmit: (identifier: string, password: string) => void
  onGoSignup: () => void
  onQuickSwitch: (userId: string) => void
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
            placeholder="เช่น newuser@kapsulep.com หรือ 081-xxx-xxxx"
            className={`${inputClass} pl-9 pr-3 py-2.5`}
            required
          />
        </div>
      </div>
      <div>
        <div className="flex items-center justify-between mb-1">
          <label className="text-stone-300 font-medium">รหัสผ่าน</label>
          <span className="text-[10px] text-stone-500">(เริ่มต้น: password123)</span>
        </div>
        <div className="relative">
          <div className="absolute left-3 top-1/2 -translate-y-1/2 text-stone-500">
            <Lock className="w-4 h-4" />
          </div>
          <input
            type={showPassword ? 'text' : 'password'}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="กรอกรหัสผ่านของคุณ"
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
      <button type="submit" className={`${submitClass} mt-2`}>
        <LogIn className="w-4 h-4" />
        <span>เข้าสู่ระบบ</span>
      </button>
      <div className="pt-2 text-center">
        <span className="text-stone-400 text-[11px]">ยังไม่มีบัญชีใช่หรือไม่? </span>
        <button type="button" onClick={onGoSignup} className="text-amber-400 hover:underline font-bold text-[11px] cursor-pointer">
          สมัครสมาชิกใหม่ที่นี่
        </button>
      </div>
      <div className="pt-3 border-t border-stone-800 text-[11px] text-stone-400 space-y-1.5">
        <span className="block font-medium text-stone-300">⚡ หรือคลิกเข้าใช้งานด้วยบัญชีตัวอย่าง:</span>
        <div className="flex flex-wrap gap-1.5">
          {registeredUsers.slice(0, 4).map((user) => (
            <button
              type="button"
              key={user.id}
              onClick={() => onQuickSwitch(user.id)}
              className="px-2 py-1 bg-stone-950 hover:bg-stone-850 text-stone-300 hover:text-amber-300 rounded border border-stone-800 text-[10px] cursor-pointer flex items-center gap-1"
            >
              <img src={user.avatarUrl} alt="" className="w-3.5 h-3.5 rounded-full object-cover" />
              <span>{user.name.split(' ')[0]}</span>
            </button>
          ))}
        </div>
      </div>
    </form>
  )
}

function SignupForm({
  onSubmit,
  onError,
  onGoLogin,
}: {
  onSubmit: (input: SignupInput) => void
  onError: (message: string) => void
  onGoLogin: () => void
}) {
  const [name, setName] = useState('')
  const [citizenId, setCitizenId] = useState('')
  const [phone, setPhone] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [avatarUrl, setAvatarUrl] = useState(AVATAR_CHOICES[0])
  const [verifyNow, setVerifyNow] = useState(true)
  const citizenIdValid = isValidCitizenId(citizenId)

  const submit = (e: React.FormEvent) => {
    e.preventDefault()
    onError('')
    if (!name.trim()) return onError('กรุณาระบุชื่อ-นามสกุล')
    if (!citizenIdValid) return onError('กรุณาระบุเลขประจำตัวประชาชน 13 หลักให้ถูกต้อง')
    if (!isValidThaiMobile(phone)) return onError('กรุณาระบุเบอร์โทรศัพท์ 10 หลักให้ถูกต้อง (06, 08, 09)')
    if (!email.trim() || !email.includes('@')) return onError('กรุณาระบุอีเมลที่ถูกต้อง')
    if (password.length < 6) return onError('รหัสผ่านต้องมีความยาวอย่างน้อย 6 ตัวอักษร')
    if (password !== confirmPassword) return onError('รหัสผ่านและการยืนยันรหัสผ่านไม่ตรงกัน')
    onSubmit({
      name: name.trim(),
      citizenId: citizenId.trim(),
      phone: phone.trim(),
      email: email.trim(),
      password,
      avatarUrl,
      isVerified: verifyNow,
    })
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
          <strong>สิทธิพิเศษผู้ใช้ใหม่:</strong> รับยอดเงินจำลองทันที <strong className="text-amber-300 font-mono">10,000 ฿</strong>{' '}
          และโควตาหน้าต่าง 2 บาน (ไทย 1 บาน + ภูมิภาค 1 บาน)
        </span>
      </div>

      <div>
        <label className="block text-stone-300 font-medium mb-1.5">เลือกรูปโปรไฟล์</label>
        <div className="flex items-center gap-2 overflow-x-auto pb-1">
          {AVATAR_CHOICES.map((url) => (
            <button
              type="button"
              key={url}
              onClick={() => setAvatarUrl(url)}
              className={`w-10 h-10 rounded-full overflow-hidden border-2 transition-all shrink-0 cursor-pointer ${avatarUrl === url ? 'border-amber-400 ring-2 ring-amber-400/50 scale-105' : 'border-stone-700 opacity-60 hover:opacity-100'}`}
            >
              <img src={url} alt="" className="w-full h-full object-cover" />
            </button>
          ))}
        </div>
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
              className={`${inputClass} pl-8 pr-2 py-2`}
              required
            />
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
        <div>
          <label className="block text-stone-300 font-medium mb-1">
            รหัสผ่าน (≥ 6 ตัว) <span className="text-amber-400">*</span>
          </label>
          <div className="relative">
            <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-stone-500" />
            <input
              type={showPassword ? 'text' : 'password'}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="ตั้งรหัสผ่าน"
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
              className={`${inputClass} pl-8 pr-2 py-2`}
              required
            />
          </div>
        </div>
      </div>

      <label className="flex items-start gap-2 p-2.5 rounded-lg bg-stone-950 border border-stone-800 cursor-pointer">
        <input
          type="checkbox"
          checked={verifyNow}
          onChange={(e) => setVerifyNow(e.target.checked)}
          className="mt-0.5 w-4 h-4 accent-amber-500 shrink-0"
        />
        <span className="text-[11px] text-stone-300 leading-snug">
          รับรองข้อมูลบัตรประชาชนและเบอร์โทรศัพท์นี้เพื่อ <strong className="text-amber-300">ยืนยันตัวตน (KYC) ทันที</strong>{' '}
          (พร้อมสิทธิ์ซื้อ-ขายต่อหน้าต่างได้ทันทีหลังสมัคร)
        </span>
      </label>

      <button type="submit" className={`${submitClass} mt-3`}>
        <UserPlus className="w-4 h-4" />
        <span>สมัครสมาชิกและเริ่มใช้งานทันที</span>
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

function AccountSwitcher({
  users,
  currentUserId,
  onPick,
  onGoSignup,
}: {
  users: User[]
  currentUserId?: string
  onPick: (userId: string) => void
  onGoSignup: () => void
}) {
  return (
    <div className="space-y-3">
      <p className="text-stone-400 text-[11px]">
        สลับบัญชีผู้ใช้เพื่อทดสอบการเป็นเจ้าของ การตั้งราคาเปิดขายต่อ และการซื้อขายต่อระหว่างกัน (ระบบหักค่าคอมมิชชั่น 5%):
      </p>
      <div className="space-y-2 max-h-72 overflow-y-auto pr-1">
        {users.map((user) => {
          const isCurrent = currentUserId === user.id
          return (
            <div
              key={user.id}
              onClick={() => onPick(user.id)}
              className={`p-3 rounded-xl border flex items-center justify-between gap-3 cursor-pointer transition-all ${isCurrent ? 'bg-amber-950/40 border-amber-400 ring-1 ring-amber-400/40' : 'bg-stone-950 hover:bg-stone-850 border-stone-800'}`}
            >
              <div className="flex items-center gap-3 min-w-0">
                <img src={user.avatarUrl} alt={user.name} className="w-10 h-10 rounded-full object-cover border border-stone-700 shrink-0" />
                <div className="min-w-0">
                  <div className="flex items-center gap-1.5">
                    <span className="font-bold text-stone-200 truncate text-xs">{user.name}</span>
                    {isCurrent && (
                      <span className="px-1.5 py-0.2 rounded bg-amber-400 text-stone-950 font-bold text-[9px]">ปัจจุบัน</span>
                    )}
                    {user.isVerified ? (
                      <span className="px-1.5 py-0.2 rounded bg-emerald-950 text-emerald-400 border border-emerald-500/40 text-[9px] font-mono">
                        KYC ✓
                      </span>
                    ) : (
                      <span className="px-1.5 py-0.2 rounded bg-amber-950 text-amber-300 border border-amber-500/40 text-[9px] font-mono">
                        รอยืนยัน
                      </span>
                    )}
                  </div>
                  <span className="text-[10px] text-stone-400 block truncate font-mono">
                    ID: {maskCitizenId(user.citizenId)} · {maskPhone(user.phone)}
                  </span>
                </div>
              </div>
              <div className="text-right shrink-0">
                <span className="text-amber-300 font-mono font-bold block text-xs">฿{user.balance.toLocaleString()}</span>
                <span className="text-[10px] text-stone-500">คงเหลือ</span>
              </div>
            </div>
          )
        })}
      </div>
      <div className="pt-2 text-center border-t border-stone-800">
        <button
          type="button"
          onClick={onGoSignup}
          className="text-xs text-amber-400 hover:text-amber-300 font-semibold cursor-pointer flex items-center justify-center gap-1 mx-auto"
        >
          <UserPlus className="w-3.5 h-3.5" />
          <span>+ สมัครบัญชีผู้ใช้ใหม่เพิ่ม</span>
        </button>
      </div>
    </div>
  )
}
