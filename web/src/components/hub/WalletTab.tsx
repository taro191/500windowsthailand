import { useEffect, useState } from 'react'
import { Building2, Check, CircleCheck, History, QrCode, Sparkles, UserCog, Wallet } from 'lucide-react'
import type { AuthMode, PayoutAccount, Transaction, User, WindowItem } from '@shared/types'
import { BANKS } from '@shared/banks'
import { maskCitizenId, maskPhone } from '@shared/identity'
import { RESALE_COMMISSION_RATE } from '@/lib/ownershipRules'

interface WalletTabProps {
  currentUser: User | null
  myWindows: WindowItem[]
  transactions: Transaction[]
  onOpenTopUp?: () => void
  onUpdateUserName: (name: string) => void
  onOpenProfile: () => void
  onOpenWalletHistory: () => void
  onUpdatePayoutAccount: (account: PayoutAccount) => void
  onSelectWindow: (window: WindowItem) => void
  onOpenAuth: (mode: AuthMode) => void
  onClose: () => void
}

export function WalletTab(props: WalletTabProps) {
  const { currentUser, onOpenAuth } = props
  if (!currentUser) {
    return (
      <div className="space-y-5">
        <div className="p-4 rounded-xl bg-amber-950/50 border border-amber-500/50 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs">
          <div>
            <span className="font-bold text-amber-300 block text-sm">คุณยังไม่ได้เข้าสู่ระบบ</span>
            <span className="text-stone-300 text-[11px]">เข้าสู่ระบบเพื่อจัดการหน้าต่างและใช้งานกระเป๋าเงิน</span>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => onOpenAuth('login')}
              className="px-3 py-1.5 bg-stone-900 hover:bg-stone-850 text-stone-200 border border-stone-700 rounded-lg font-bold"
            >
              เข้าสู่ระบบ
            </button>
            <button
              onClick={() => onOpenAuth('signup')}
              className="px-3 py-1.5 bg-amber-400 hover:bg-amber-300 text-stone-950 rounded-lg font-bold"
            >
              สมัครสมาชิก
            </button>
          </div>
        </div>
      </div>
    )
  }
  return (
    <div className="space-y-5">
      <ProfileCard user={currentUser} onUpdateUserName={props.onUpdateUserName} onOpenProfile={props.onOpenProfile} />
      <BalanceCard user={currentUser} onOpenTopUp={props.onOpenTopUp} onOpenHistory={props.onOpenWalletHistory} />
      <PayoutAccountCard user={currentUser} onUpdatePayoutAccount={props.onUpdatePayoutAccount} />
      <OwnedWindows windows={props.myWindows} onSelectWindow={props.onSelectWindow} onClose={props.onClose} />
      <TransactionHistory transactions={props.transactions} />
    </div>
  )
}

function ProfileCard({
  user,
  onUpdateUserName,
  onOpenProfile,
}: {
  user: User
  onUpdateUserName: (name: string) => void
  onOpenProfile: () => void
}) {
  const [editing, setEditing] = useState(false)
  const [name, setName] = useState(user.name)
  useEffect(() => setName(user.name), [user.name])

  return (
    <div className="p-4 rounded-xl bg-stone-950 border border-stone-800 space-y-3">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <img src={user.avatarUrl} alt="" className="w-12 h-12 rounded-full object-cover border-2 border-amber-400" />
          <div>
            {editing ? (
              <form
                onSubmit={(e) => {
                  e.preventDefault()
                  if (name.trim()) {
                    onUpdateUserName(name.trim())
                    setEditing(false)
                  }
                }}
                className="flex gap-1.5"
              >
                <input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="bg-stone-900 border border-stone-700 text-stone-100 text-xs px-2 py-0.5 rounded"
                />
                <button type="submit" className="px-2 py-0.5 bg-amber-400 text-stone-950 font-bold rounded text-xs">
                  บันทึก
                </button>
              </form>
            ) : (
              <div className="flex items-center gap-2">
                <h3 className="font-bold text-stone-100 text-sm">{user.name}</h3>
                <button onClick={() => setEditing(true)} className="text-amber-400 hover:underline text-[11px]">
                  แก้ไขชื่อ
                </button>
              </div>
            )}
            <span className="text-[11px] text-stone-400 block font-mono">
              {user.email} · {user.phone || 'ยังไม่ระบุเบอร์โทร'}
            </span>
          </div>
        </div>
        <button
          onClick={onOpenProfile}
          className="shrink-0 px-2.5 py-1 rounded-lg bg-stone-900 hover:bg-stone-850 text-amber-300 border border-stone-700 text-[11px] font-bold flex items-center gap-1 cursor-pointer"
        >
          <UserCog className="w-3.5 h-3.5" /> ข้อมูลส่วนตัว
        </button>
      </div>
    </div>
  )
}

function BalanceCard({ user, onOpenTopUp, onOpenHistory }: { user: User; onOpenTopUp?: () => void; onOpenHistory: () => void }) {
  return (
    <div className="p-4 rounded-xl bg-gradient-to-br from-stone-950 to-stone-900 border border-amber-500/40">
      <div className="flex items-center justify-between text-xs text-stone-400 mb-1">
        <span>ยอดเงินคงเหลือในกระเป๋า</span>
        <Wallet className="w-4 h-4 text-amber-400" />
      </div>
      <div className="text-2xl sm:text-3xl font-black font-mono text-amber-300 tabular-nums">฿{user.balance.toLocaleString()}</div>
      <div className="flex items-center justify-between gap-2 mt-3 pt-3 border-t border-stone-800">
        <span className="text-[11px] text-stone-400">ใช้ชำระค่าจับจองและซื้อต่อได้ทันที · ไม่พอใช้ช่องทางอื่นร่วมได้</span>
        <div className="flex items-center gap-1.5 shrink-0">
          <button
            onClick={onOpenHistory}
            className="px-2.5 py-1.5 text-xs bg-stone-900 hover:bg-stone-850 text-amber-300 border border-stone-700 rounded-lg font-bold cursor-pointer flex items-center gap-1"
          >
            <History className="w-3.5 h-3.5" /> ประวัติการเงิน
          </button>
          {onOpenTopUp && (
            <button
              onClick={onOpenTopUp}
              className="px-3 py-1.5 text-xs bg-gradient-to-r from-amber-400 to-amber-500 text-stone-950 rounded-lg font-bold cursor-pointer"
            >
              + เติมเงิน
            </button>
          )}
        </div>
      </div>
    </div>
  )
}

function PayoutAccountCard({
  user,
  onUpdatePayoutAccount,
}: {
  user: User
  onUpdatePayoutAccount: (account: PayoutAccount) => void
}) {
  const account = user.payoutAccount
  const [editing, setEditing] = useState(false)
  const [type, setType] = useState<PayoutAccount['type']>(account?.type || 'promptpay')
  const [promptpayType, setPromptpayType] = useState<'citizenId' | 'phone'>(account?.promptpayType || 'citizenId')
  const [bankCode, setBankCode] = useState(account?.bankCode || 'kbank')
  const [accountNumber, setAccountNumber] = useState(account?.accountNumber || '')
  const [accountName, setAccountName] = useState(account?.accountName || user.name || '')
  const [autoPayout, setAutoPayout] = useState(account?.autoPayout ?? true)
  const [payoutMessage, setPayoutMessage] = useState<string | null>(null)
  const [savedMessage, setSavedMessage] = useState<string | null>(null)

  /** Fills the form from the saved account, or from the profile for a new one. */
  const loadForm = (from = user.payoutAccount) => {
    if (from) {
      setType(from.type)
      setPromptpayType(from.promptpayType || 'citizenId')
      setBankCode(from.bankCode || 'kbank')
      setAccountNumber(from.accountNumber || '')
      setAccountName(from.accountName || user.name)
      setAutoPayout(from.autoPayout ?? true)
    } else {
      setAccountName(user.name)
      setAccountNumber(user.phone || '')
    }
  }
  useEffect(() => loadForm(), [user]) // eslint-disable-line react-hooks/exhaustive-deps

  const save = (e: React.FormEvent) => {
    e.preventDefault()
    if (!accountNumber.trim()) return
    const bank = BANKS.find((b) => b.code === bankCode)
    onUpdatePayoutAccount({
      type,
      promptpayType: type === 'promptpay' ? promptpayType : undefined,
      bankCode: type === 'bank' ? bankCode : undefined,
      bankName: type === 'bank' ? bank?.name : 'พร้อมเพย์ (PromptPay)',
      accountNumber: accountNumber.trim(),
      accountName: accountName.trim() || user.name || '',
      autoPayout,
      isVerified: true,
      updatedAt: new Date().toISOString(),
    })
    setEditing(false)
    setSavedMessage('บันทึกข้อมูลบัญชีรับเงินเรียบร้อยแล้ว')
    setTimeout(() => setSavedMessage(null), 3500)
  }

  /** Demo: pretend ฿100 of income was transferred to the account. */
  const simulatePayout = () => {
    if (!account) return
    setPayoutMessage('⏳ กำลังจำลองการส่งคำสั่งโอนเงินรายได้เข้าบัญชี...')
    setTimeout(() => {
      setPayoutMessage(
        `✅ ทดสอบโอนเงินสำเร็จ! จำลองการส่งเงินรายได้ ฿100.00 เข้าบัญชี ${account.accountName} (${account.accountNumber}) เรียบร้อยแล้ว`,
      )
      setTimeout(() => setPayoutMessage(null), 4500)
    }, 1200)
  }

  const bank = BANKS.find((b) => b.code === account?.bankCode)
  const fieldClass =
    'w-full bg-[#09080e] border border-purple-900/40 text-stone-100 px-3 py-1.5 rounded-lg focus:outline-none focus:border-rose-400 text-xs'
  const toggleClass = (active: boolean) =>
    `flex-1 py-1.5 px-2.5 rounded-lg text-xs font-semibold flex items-center justify-center gap-1.5 transition-all cursor-pointer ${active ? 'bg-gradient-to-r from-orange-500 to-rose-500 text-white shadow-sm' : 'bg-[#140f21] text-stone-400 hover:text-stone-200 border border-purple-900/30'}`

  return (
    <div className="p-4 rounded-xl bg-gradient-to-br from-[#120f21] via-[#161129] to-[#0a0812] border border-purple-500/40 space-y-3 font-['Prompt',sans-serif] shadow-lg">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-xl bg-gradient-to-tr from-orange-500 via-rose-500 to-purple-600 p-[1.5px] shrink-0 shadow-md">
            <div className="w-full h-full rounded-[10px] bg-[#0c0915] flex items-center justify-center text-rose-300">
              <Building2 className="w-4 h-4" />
            </div>
          </div>
          <div>
            <div className="flex items-center gap-1.5 flex-wrap">
              <h4 className="text-xs font-bold text-stone-100 font-['Outfit',sans-serif] tracking-wide">
                บัญชีเพื่อรับเงิน (Payout & Receiving Account)
              </h4>
              <span className="text-[10px] px-1.5 py-0.2 rounded bg-emerald-950 text-emerald-300 border border-emerald-500/40 font-mono font-bold">
                รับสุทธิ 95%
              </span>
            </div>
            <span className="text-[11px] text-stone-400 block font-light">
              ช่องทางรับเงินโอนจากการขายต่อบานหน้าต่างและค่าเช่าจากตลาดปล่อยเช่า
            </span>
          </div>
        </div>
        {!editing && (
          <button
            type="button"
            onClick={() => {
              if (account) loadForm(account)
              setEditing(true)
            }}
            className="px-2.5 py-1 rounded-lg bg-[#1f1738] hover:bg-[#2a1f4d] border border-purple-500/40 text-rose-300 hover:text-white text-xs font-semibold cursor-pointer transition-colors shrink-0"
          >
            {account ? 'แก้ไขบัญชี' : '+ ตั้งค่าบัญชี'}
          </button>
        )}
      </div>

      {savedMessage && (
        <div className="p-2.5 rounded-lg bg-emerald-950/60 border border-emerald-500/50 text-emerald-300 text-xs flex items-center gap-1.5 animate-in fade-in duration-150">
          <CircleCheck className="w-4 h-4 shrink-0 text-emerald-400" />
          <span>{savedMessage}</span>
        </div>
      )}
      {payoutMessage && (
        <div className="p-2.5 rounded-lg bg-purple-950/80 border border-purple-500/50 text-rose-300 text-xs flex items-center gap-1.5 animate-in fade-in duration-150 font-mono">
          <Sparkles className="w-4 h-4 shrink-0 text-rose-400" />
          <span>{payoutMessage}</span>
        </div>
      )}

      {!editing &&
        (account ? (
          <div className="p-3.5 rounded-xl bg-[#09080e] border border-purple-900/40 space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                {account.type === 'promptpay' ? (
                  <div className="px-2.5 py-1 rounded-lg bg-sky-950 border border-sky-500/50 text-sky-300 text-xs font-bold font-mono flex items-center gap-1">
                    <QrCode className="w-3.5 h-3.5" />
                    <span>PROMPTPAY</span>
                  </div>
                ) : (
                  <div className={`px-2.5 py-1 rounded-lg text-white text-xs font-bold font-mono shadow-sm ${bank?.color || 'bg-purple-700'}`}>
                    {bank?.text || 'BANK'}
                  </div>
                )}
                <div>
                  <div className="text-xs font-bold text-stone-200">
                    {account.type === 'promptpay'
                      ? `พร้อมเพย์ (${account.promptpayType === 'phone' ? 'เบอร์โทรศัพท์' : 'เลขประจำตัวประชาชน'})`
                      : account.bankName || 'บัญชีธนาคาร'}
                  </div>
                  <div className="text-sm font-mono font-bold text-stone-100 tracking-wider">{account.accountNumber}</div>
                </div>
              </div>
              <span className="px-2 py-0.5 rounded-full bg-emerald-950/80 border border-emerald-500/40 text-emerald-300 text-[10px] font-medium flex items-center gap-1">
                <Check className="w-3 h-3 text-emerald-400" />
                <span>พร้อมรับเงิน</span>
              </span>
            </div>
            <div className="pt-2 border-t border-purple-900/30 flex items-center justify-between text-[11px] text-stone-400 font-light">
              <div>
                <span>ชื่อบัญชี: </span>
                <strong className="text-stone-200 font-medium">{account.accountName}</strong>
              </div>
              <span className="text-[10px] text-emerald-400 font-mono">{account.autoPayout ? '✓ โอนเข้าอัตโนมัติ' : 'โอนตามคำขอ'}</span>
            </div>
            <div className="pt-1 flex justify-end">
              <button
                type="button"
                onClick={simulatePayout}
                className="px-3 py-1.5 rounded-lg bg-[#19122b] hover:bg-[#231a3d] border border-purple-500/30 text-rose-300 hover:text-white text-xs font-medium flex items-center gap-1.5 cursor-pointer transition-colors"
              >
                <Sparkles className="w-3.5 h-3.5 text-rose-400" />
                <span>⚡ ทดสอบระบบรับเงินเข้าบัญชี (Simulate Payout)</span>
              </button>
            </div>
          </div>
        ) : (
          <div className="p-3.5 rounded-xl bg-[#09080e] border border-dashed border-purple-900/50 text-center space-y-2">
            <p className="text-xs text-stone-400 font-light max-w-sm mx-auto leading-relaxed">
              ยังไม่ได้ระบุบัญชีเพื่อรับเงิน — เมื่อบานหน้าต่างของคุณถูกซื้อต่อ หรือปล่อยเช่าในตลาด ระบบจะโอนเงินสุทธิ 95% เข้าสู่บัญชีนี้โดยตรง
            </p>
            <button
              type="button"
              onClick={() => {
                setAccountName(user.name)
                setAccountNumber(user.phone || '')
                setEditing(true)
              }}
              className="px-3.5 py-1.5 rounded-xl bg-gradient-to-r from-orange-500 via-rose-500 to-purple-600 hover:opacity-90 text-white text-xs font-bold cursor-pointer transition-all shadow-md"
            >
              + ตั้งค่าบัญชีเพื่อรับเงินทันที
            </button>
          </div>
        ))}

      {editing && (
        <form onSubmit={save} className="p-3.5 rounded-xl bg-[#09080e] border border-purple-500/50 space-y-3 text-xs">
          <div className="flex items-center justify-between pb-1 border-b border-purple-900/30">
            <span className="font-bold text-stone-200">{account ? 'แก้ไขบัญชีเพื่อรับเงิน' : 'ตั้งค่าบัญชีเพื่อรับเงิน'}</span>
            <button type="button" onClick={() => setEditing(false)} className="text-[11px] text-stone-400 hover:text-stone-200 cursor-pointer">
              ยกเลิก
            </button>
          </div>

          <div className="flex gap-2">
            <button type="button" onClick={() => setType('promptpay')} className={toggleClass(type === 'promptpay')}>
              <QrCode className="w-3.5 h-3.5" />
              <span>พร้อมเพย์ (PromptPay)</span>
            </button>
            <button type="button" onClick={() => setType('bank')} className={toggleClass(type === 'bank')}>
              <Building2 className="w-3.5 h-3.5" />
              <span>บัญชีธนาคาร</span>
            </button>
          </div>

          {type === 'promptpay' && (
            <div className="space-y-2.5 bg-[#140f21] p-3 rounded-lg border border-purple-900/30">
              <div className="flex items-center justify-between text-[11px]">
                <span className="text-stone-400">ประเภทพร้อมเพย์:</span>
                <div className="flex gap-3">
                  <label className="flex items-center gap-1 cursor-pointer text-stone-300">
                    <input
                      type="radio"
                      name="ppType"
                      checked={promptpayType === 'citizenId'}
                      onChange={() => {
                        setPromptpayType('citizenId')
                        if (user.citizenId) setAccountNumber(user.citizenId)
                      }}
                      className="accent-rose-500"
                    />
                    <span>เลขบัตรประชาชน</span>
                  </label>
                  <label className="flex items-center gap-1 cursor-pointer text-stone-300">
                    <input
                      type="radio"
                      name="ppType"
                      checked={promptpayType === 'phone'}
                      onChange={() => {
                        setPromptpayType('phone')
                        if (user.phone) setAccountNumber(user.phone)
                      }}
                      className="accent-rose-500"
                    />
                    <span>เบอร์โทรศัพท์</span>
                  </label>
                </div>
              </div>
              <div className="flex items-center gap-2 text-[10px]">
                <span className="text-stone-500">ดึงข้อมูลด่วน:</span>
                {user.citizenId && (
                  <button
                    type="button"
                    onClick={() => {
                      setPromptpayType('citizenId')
                      setAccountNumber(user.citizenId)
                    }}
                    className="px-2 py-0.5 rounded bg-purple-950/70 border border-purple-500/30 text-rose-300 hover:text-white cursor-pointer"
                  >
                    เลขบัตร KYC ({maskCitizenId(user.citizenId)})
                  </button>
                )}
                {user.phone && (
                  <button
                    type="button"
                    onClick={() => {
                      setPromptpayType('phone')
                      setAccountNumber(user.phone)
                    }}
                    className="px-2 py-0.5 rounded bg-purple-950/70 border border-purple-500/30 text-rose-300 hover:text-white cursor-pointer"
                  >
                    เบอร์โทร ({maskPhone(user.phone)})
                  </button>
                )}
              </div>
              <div>
                <label className="text-[11px] text-stone-300 block mb-1">
                  {promptpayType === 'citizenId' ? 'เลขบัตรประชาชน 13 หลัก' : 'เบอร์โทรศัพท์พร้อมเพย์ 10 หลัก'} *
                </label>
                <input
                  type="text"
                  value={accountNumber}
                  onChange={(e) => setAccountNumber(e.target.value)}
                  placeholder={promptpayType === 'citizenId' ? '1-xxxx-xxxxx-xx-x' : '08x-xxx-xxxx'}
                  className={`${fieldClass} font-mono`}
                  required
                />
              </div>
            </div>
          )}

          {type === 'bank' && (
            <div className="space-y-2.5 bg-[#140f21] p-3 rounded-lg border border-purple-900/30">
              <div>
                <label className="text-[11px] text-stone-300 block mb-1">เลือกธนาคาร *</label>
                <select value={bankCode} onChange={(e) => setBankCode(e.target.value)} className={fieldClass}>
                  {BANKS.map((b) => (
                    <option key={b.code} value={b.code}>
                      {b.name}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="text-[11px] text-stone-300 block mb-1">เลขที่บัญชีธนาคาร *</label>
                <input
                  type="text"
                  value={accountNumber}
                  onChange={(e) => setAccountNumber(e.target.value)}
                  placeholder="xxx-x-xxxxx-x"
                  className={`${fieldClass} font-mono`}
                  required
                />
              </div>
            </div>
          )}

          <div>
            <label className="text-[11px] text-stone-300 block mb-1">ชื่อ-นามสกุล เจ้าของบัญชี (ต้องตรงกับชื่อผู้ถือครองกรรมสิทธิ์) *</label>
            <input
              type="text"
              value={accountName}
              onChange={(e) => setAccountName(e.target.value)}
              placeholder="ชื่อ-นามสกุล จริง"
              className="w-full bg-[#140f21] border border-purple-900/40 text-stone-100 px-3 py-1.5 rounded-lg focus:outline-none focus:border-rose-400 text-xs"
              required
            />
          </div>
          <label className="flex items-start gap-2 cursor-pointer pt-1">
            <input
              type="checkbox"
              checked={autoPayout}
              onChange={(e) => setAutoPayout(e.target.checked)}
              className="mt-0.5 w-4 h-4 accent-rose-500 shrink-0"
            />
            <span className="text-[11px] text-stone-300 font-light leading-relaxed">
              โอนเงินสุทธิ (95%) เข้าบัญชีนี้อัตโนมัติทันที เมื่อมีการขายต่อหรือปล่อยเช่าสำเร็จ
            </span>
          </label>
          <div className="flex gap-2 pt-1">
            <button
              type="button"
              onClick={() => setEditing(false)}
              className="px-3 py-2 rounded-lg bg-[#140f21] hover:bg-[#1a142c] text-stone-400 hover:text-stone-200 text-xs cursor-pointer"
            >
              ยกเลิก
            </button>
            <button
              type="submit"
              className="flex-1 py-2 px-3 rounded-lg bg-gradient-to-r from-orange-500 via-rose-500 to-purple-600 hover:opacity-90 text-white font-bold text-xs shadow-md cursor-pointer flex items-center justify-center gap-1.5"
            >
              <Check className="w-3.5 h-3.5" />
              <span>บันทึกบัญชีเพื่อรับเงิน</span>
            </button>
          </div>
        </form>
      )}
    </div>
  )
}

function OwnedWindows({
  windows,
  onSelectWindow,
  onClose,
}: {
  windows: WindowItem[]
  onSelectWindow: (window: WindowItem) => void
  onClose: () => void
}) {
  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between text-xs">
        <span className="font-bold text-stone-200">หน้าต่างที่ถือครอง ({windows.length} บาน / จำกัดไม่เกิน 2 บาน)</span>
      </div>
      {windows.length === 0 ? (
        <p className="text-xs text-stone-500 italic p-3 bg-stone-950 rounded-lg border border-stone-850">
          คุณยังไม่ได้เป็นเจ้าของบานหน้าต่างใด (โควตาสูงสุด: ไทย 1 บาน + ภูมิภาค 1 บาน) คลิกจับจองบานว่างในหน้าต่างได้ทันที
        </p>
      ) : (
        <div className="space-y-2 max-h-56 overflow-y-auto pr-1">
          {windows.map((w) => (
            <div
              key={`${w.region}-${w.id}`}
              onClick={() => {
                onSelectWindow(w)
                onClose()
              }}
              className="p-2.5 rounded-lg bg-stone-950 border border-stone-800 hover:border-amber-400 cursor-pointer flex items-center justify-between text-xs"
            >
              <div className="flex items-center gap-2 min-w-0">
                {/* The design used a via.placeholder.com fallback; an empty slot avoids the external request. */}
                {w.imageUrl ? (
                  <img src={w.imageUrl} alt={w.title} className="w-8 h-8 rounded object-cover shrink-0" />
                ) : (
                  <span className="w-8 h-8 rounded bg-stone-800 shrink-0" />
                )}
                <div className="min-w-0">
                  <span className="font-mono text-amber-300 font-bold mr-1">{w.code}</span>
                  <span className="text-stone-200 truncate">{w.title}</span>
                </div>
              </div>
              <span className="text-[10px] font-mono text-stone-400 shrink-0">{w.region === 'thailand' ? '🇹🇭 ไทย' : '🗺️ ภูมิภาค'}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

const TX_TYPE_STYLES: Record<string, [string, string]> = {
  claim: ['แรกเข้า (Claim)', 'bg-cyan-950 text-cyan-300 border border-cyan-500/40'],
  resale: ['ซื้อขายต่อ (Resale)', 'bg-amber-950 text-amber-300 border border-amber-500/40'],
  topup: ['เติมเงิน (Top-up)', 'bg-emerald-950 text-emerald-300 border border-emerald-500/40'],
  promo: ['ค่าโปรโมท', 'bg-fuchsia-950 text-fuchsia-300 border border-fuchsia-500/40'],
  refund: ['คืนเงินเข้ากระเป๋า', 'bg-stone-800 text-stone-200 border border-stone-500/40'],
  edit_fee: ['ค่าแก้ไขบาน', 'bg-sky-950 text-sky-300 border border-sky-500/40'],
  bonus: ['โบนัสสมัครสมาชิก', 'bg-lime-950 text-lime-300 border border-lime-500/40'],
}

function TransactionHistory({ transactions }: { transactions: Transaction[] }) {
  return (
    <div className="space-y-2 pt-2 border-t border-stone-800">
      <div className="flex items-center justify-between text-xs">
        <span className="font-bold text-stone-200">ประวัติการทำธุรกรรม ({transactions.length})</span>
        <span className="text-[10px] text-amber-400 font-mono">ค่าคอมมิชชั่น 5%</span>
      </div>
      {transactions.length === 0 ? (
        <p className="text-xs text-stone-500 italic p-3 bg-stone-950 rounded-lg border border-stone-850">
          ยังไม่มีประวัติธุรกรรม (ระบบถูกรีเซ็ตเริ่มต้นเรียบร้อย)
        </p>
      ) : (
        <div className="space-y-2 max-h-60 overflow-y-auto pr-1">
          {transactions.map((tx) => {
            const isResale = tx.type === 'resale'
            const [typeLabel, typeClass] = TX_TYPE_STYLES[tx.type] || TX_TYPE_STYLES.claim
            const commission = tx.commissionAmount || (isResale ? Math.round(tx.amount * RESALE_COMMISSION_RATE) : 0)
            const sellerNet = tx.netSellerAmount || (isResale ? tx.amount - commission : tx.amount)
            return (
              <div key={tx.id} className="p-2.5 rounded-lg bg-stone-950 border border-stone-800 text-xs space-y-1.5">
                <div className="flex items-center justify-between">
                  <span className="font-mono text-amber-300 font-bold">{tx.windowCode}</span>
                  <span className={`text-[10px] font-bold px-1.5 py-0.2 rounded ${typeClass}`}>{typeLabel}</span>
                </div>
                <div className="text-[11px] text-stone-300 truncate">{tx.windowTitle}</div>
                <div className="text-[10px] text-stone-400 flex items-center justify-between pt-1 border-t border-stone-850 font-mono">
                  <div className="flex flex-col">
                    <span>
                      {tx.fromOwner} → {tx.toOwner}
                    </span>
                    {tx.fromOwnerId && (
                      <span className="text-[9px] text-amber-400/80">
                        (ID เดิม: {tx.fromOwnerId} → ใหม่: {tx.toOwnerId || '-'})
                      </span>
                    )}
                  </div>
                  <span className="font-bold text-stone-100">฿{tx.amount.toLocaleString()}</span>
                </div>
                {isResale && (
                  <div className="p-1.5 rounded bg-stone-900 border border-amber-900/40 text-[10px] flex items-center justify-between font-mono">
                    <span className="text-amber-400">ค่าคอมมิชชั่น 5%: ฿{commission.toLocaleString()}</span>
                    <span className="text-emerald-400">ผู้ขายรับสุทธิ 95%: ฿{sellerNet.toLocaleString()}</span>
                  </div>
                )}
                {tx.walletAmount !== undefined && tx.type !== 'topup' && tx.type !== 'refund' && (
                  <div className="p-1.5 rounded bg-stone-900 border border-purple-900/40 text-[10px] flex items-center justify-between font-mono">
                    <span className="text-amber-300">กระเป๋าเงิน: ฿{tx.walletAmount.toLocaleString()}</span>
                    {!!tx.externalAmount && (
                      <span className="text-sky-300">
                        {tx.channelName}: ฿{tx.externalAmount.toLocaleString()}
                      </span>
                    )}
                  </div>
                )}
                {tx.slipRef && (
                  <div className="p-1.5 rounded bg-emerald-950/40 border border-emerald-500/30 text-[10px] flex items-center justify-between font-mono">
                    <span className="text-emerald-300 flex items-center gap-1">
                      <span>✓ อนุมัติสลิป:</span>
                      <span className="text-stone-300">{tx.slipRef}</span>
                    </span>
                    <span className="text-emerald-400 font-bold uppercase text-[9px] px-1 bg-emerald-900/40 rounded">
                      {tx.slipStatus || 'Approved'}
                    </span>
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
