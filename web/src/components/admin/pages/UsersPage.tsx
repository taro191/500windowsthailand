import { useMemo, useState } from 'react'
import { Ban, Power, PowerOff, Search, ShieldCheck, ShieldOff, UserMinus, UserPlus, Undo2, Users, X } from 'lucide-react'
import type { User } from '@shared/types'
import { createUser, revokeKyc, setUserDisabled, setUserRole, setUserSuspended } from '@/lib/adminApi'
import { maskCitizenId, maskPhone } from '@shared/identity'
import type { AdminPageProps } from '../adminData'
import { Badge, baht, Button, Card, DataTable, FormRow, inputClass, thaiDateTime } from '../ui'

type RoleFilter = 'all' | 'admin' | 'user'
type StatusFilter = 'all' | 'active' | 'suspended' | 'disabled'
type KycFilter = 'all' | 'verified' | 'pending'

const digitsOf = (value: string) => value.replace(/\D/g, '')

const EMPTY_FORM = { name: '', email: '', password: '', role: 'user' as 'admin' | 'user' }

/** Super admin only: new account that logs in with email and password. */
function NewUserCard({ onClose, refresh, notify }: { onClose: () => void } & Pick<AdminPageProps, 'refresh' | 'notify'>) {
  const [form, setForm] = useState(EMPTY_FORM)
  const [saving, setSaving] = useState(false)
  const set = (changes: Partial<typeof EMPTY_FORM>) => setForm((f) => ({ ...f, ...changes }))

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    setSaving(true)
    const result = await createUser(form)
    setSaving(false)
    if (!result.success) return notify(result.error || 'สร้างผู้ใช้ไม่สำเร็จ', 'error')
    await refresh()
    notify(`สร้างบัญชี ${form.name} แล้ว`)
    setForm(EMPTY_FORM)
    onClose()
  }

  return (
    <Card
      title="เพิ่มผู้ใช้ใหม่"
      icon={UserPlus}
      outline="primary"
      tools={
        <button type="button" onClick={onClose} className="text-[#6c757d] hover:text-[#212529] cursor-pointer" aria-label="ปิด">
          <X className="w-4 h-4" />
        </button>
      }
    >
      <form onSubmit={submit} className="grid gap-x-4 sm:grid-cols-2">
        <FormRow label="ชื่อ">
          <input required value={form.name} onChange={(e) => set({ name: e.target.value })} className={inputClass} maxLength={120} />
        </FormRow>
        <FormRow label="อีเมล" hint="ใช้เป็นชื่อเข้าสู่ระบบ">
          <input required type="email" value={form.email} onChange={(e) => set({ email: e.target.value })} className={inputClass} />
        </FormRow>
        <FormRow label="รหัสผ่าน" hint="อย่างน้อย 8 ตัวอักษร แจ้งผู้ใช้ให้เปลี่ยนหลังเข้าสู่ระบบครั้งแรก">
          <input required type="text" autoComplete="off" minLength={8} value={form.password} onChange={(e) => set({ password: e.target.value })} className={inputClass} />
        </FormRow>
        <FormRow label="สิทธิ์">
          <select value={form.role} onChange={(e) => set({ role: e.target.value as 'admin' | 'user' })} className={inputClass}>
            <option value="user">ผู้ใช้ทั่วไป</option>
            <option value="admin">ผู้ดูแลระบบ</option>
          </select>
        </FormRow>
        <div className="sm:col-span-2 flex justify-end gap-2">
          <Button tone="secondary" outline onClick={onClose}>
            ยกเลิก
          </Button>
          <Button type="submit" disabled={saving}>
            <UserPlus className="w-4 h-4" /> {saving ? 'กำลังสร้าง...' : 'สร้างผู้ใช้'}
          </Button>
        </div>
      </form>
    </Card>
  )
}

export function UsersPage({ admin, data, refresh, notify }: AdminPageProps) {
  const [adding, setAdding] = useState(false)
  const [query, setQuery] = useState('')
  const [roleFilter, setRoleFilter] = useState<RoleFilter>('all')
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all')
  const [kycFilter, setKycFilter] = useState<KycFilter>('all')

  const holdings = useMemo(() => {
    const map = new Map<string, number>()
    data.windows.forEach((w) => w.ownerId && map.set(w.ownerId, (map.get(w.ownerId) || 0) + 1))
    return map
  }, [data.windows])

  const users = data.users.filter((u) => {
    const q = query.trim().toLowerCase()
    const qDigits = digitsOf(q)
    const matchesQuery =
      !q ||
      u.name.toLowerCase().includes(q) ||
      u.email.toLowerCase().includes(q) ||
      u.id.toLowerCase().includes(q) ||
      (qDigits.length >= 3 && digitsOf(u.phone).includes(qDigits))
    const matchesRole = roleFilter === 'all' || (roleFilter === 'admin') === (u.role === 'admin')
    const matchesStatus =
      statusFilter === 'all' ||
      (statusFilter === 'active' && !u.disabled && !u.suspended) ||
      (statusFilter === 'suspended' && u.suspended) ||
      (statusFilter === 'disabled' && u.disabled)
    const matchesKyc = kycFilter === 'all' || (kycFilter === 'verified') === u.isVerified
    return matchesQuery && matchesRole && matchesStatus && matchesKyc
  })

  /** Runs an admin action after confirming, then reloads the list. */
  const act = async (question: string, run: () => Promise<{ success: boolean; error?: string }>, done: string) => {
    if (!window.confirm(question)) return
    const result = await run()
    if (!result.success) return notify(result.error || 'ทำรายการไม่สำเร็จ', 'error')
    await refresh()
    notify(done)
  }

  const toggleDisabled = (u: User) =>
    act(
      u.disabled
        ? `เปิดใช้งานบัญชี ${u.name} อีกครั้ง?`
        : `ปิดใช้งานบัญชี ${u.name}? ผู้ใช้จะเข้าสู่ระบบไม่ได้และถูกออกจากระบบทุกอุปกรณ์ (บานและเงินในกระเป๋ายังอยู่)`,
      () => setUserDisabled(u.id, !u.disabled),
      u.disabled ? `เปิดใช้งานบัญชี ${u.name} แล้ว` : `ปิดใช้งานบัญชี ${u.name} แล้ว`,
    )
  const toggleSuspend = (u: User) =>
    act(
      u.suspended ? `ยกเลิกการระงับธุรกรรมของ ${u.name}?` : `ระงับการทำธุรกรรมของ ${u.name}? (จับจอง/ซื้อ/ขาย/แก้ไขบานไม่ได้ และถูกออกจากระบบทุกอุปกรณ์)`,
      () => setUserSuspended(u.id, !u.suspended),
      u.suspended ? `ยกเลิกการระงับ ${u.name} แล้ว` : `ระงับธุรกรรมของ ${u.name} แล้ว`,
    )
  const toggleRole = (u: User) =>
    act(
      u.role === 'admin'
        ? `เปลี่ยน ${u.name} เป็นผู้ใช้ทั่วไป? จะเข้าหน้าผู้ดูแลระบบไม่ได้อีก`
        : `ให้สิทธิ์ผู้ดูแลระบบแก่ ${u.name}? จะจัดการผู้ใช้ การเงิน และตั้งค่าระบบได้ทั้งหมด`,
      () => setUserRole(u.id, u.role === 'admin' ? 'user' : 'admin'),
      u.role === 'admin' ? `${u.name} เป็นผู้ใช้ทั่วไปแล้ว` : `${u.name} เป็นผู้ดูแลระบบแล้ว`,
    )
  const revoke = (u: User) =>
    act(`เพิกถอนการยืนยันตัวตนของ ${u.name}? ผู้ใช้จะต้องยืนยันใหม่ก่อนซื้อขาย`, () => revokeKyc(u.id), `เพิกถอน KYC ของ ${u.name} แล้ว`)

  return (
    <>
      {adding && <NewUserCard onClose={() => setAdding(false)} refresh={refresh} notify={notify} />}
      <Card
        title={`ผู้ใช้งาน (${users.length}/${data.users.length})`}
        icon={Users}
        outline="info"
        flush
        tools={
          <div className="flex flex-wrap items-center gap-2">
            <select value={roleFilter} onChange={(e) => setRoleFilter(e.target.value as RoleFilter)} className={`${inputClass} !w-auto`}>
              <option value="all">ทุกสิทธิ์</option>
              <option value="admin">ผู้ดูแลระบบ</option>
              <option value="user">ผู้ใช้ทั่วไป</option>
            </select>
            <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value as StatusFilter)} className={`${inputClass} !w-auto`}>
              <option value="all">ทุกสถานะ</option>
              <option value="active">ใช้งานปกติ</option>
              <option value="suspended">ระงับธุรกรรม</option>
              <option value="disabled">ปิดใช้งาน</option>
            </select>
            <select value={kycFilter} onChange={(e) => setKycFilter(e.target.value as KycFilter)} className={`${inputClass} !w-auto`}>
              <option value="all">KYC ทั้งหมด</option>
              <option value="verified">ยืนยันตัวตนแล้ว</option>
              <option value="pending">ยังไม่ยืนยันตัวตน</option>
            </select>
            <div className="relative">
              <Search className="absolute left-2 top-1/2 -translate-y-1/2 w-4 h-4 text-[#6c757d]" />
              <input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="ชื่อ / อีเมล / เบอร์ / รหัสผู้ใช้"
                className={`${inputClass} pl-8 w-60`}
              />
            </div>
            {admin.superAdmin && !adding && (
              <Button onClick={() => setAdding(true)}>
                <UserPlus className="w-4 h-4" /> เพิ่มผู้ใช้
              </Button>
            )}
          </div>
        }
      >
        <DataTable head={['ผู้ใช้', 'ติดต่อ', 'เลขบัตร (ปิดบัง)', 'สิทธิ์', 'สถานะ', 'KYC', 'ถือครอง', 'กระเป๋าเงิน', 'บัญชีรับเงิน', 'สมัครเมื่อ', 'จัดการ']} empty="ไม่พบผู้ใช้ที่ตรงกับเงื่อนไข">
          {users.map((u) => {
            const isSelf = u.id === admin.id
            return (
              <tr key={u.id} className={u.disabled ? 'opacity-60' : ''}>
                <td className="whitespace-nowrap">
                  <div className="flex items-center gap-2">
                    <img src={u.avatarUrl} alt="" className="w-8 h-8 rounded-full object-cover" />
                    <div>
                      <div className="font-bold">{u.name}</div>
                      <div className="text-[0.75rem] text-[#6c757d] font-mono">{u.id}</div>
                    </div>
                  </div>
                </td>
                <td className="whitespace-nowrap text-[#6c757d]">
                  {u.email}
                  <br />
                  {maskPhone(u.phone) || '-'}
                </td>
                <td className="font-mono whitespace-nowrap">{maskCitizenId(u.citizenId) || '-'}</td>
                <td className="whitespace-nowrap">
                  {u.superAdmin ? (
                    <Badge tone="danger">Super Admin</Badge>
                  ) : u.role === 'admin' ? (
                    <Badge tone="dark">ผู้ดูแลระบบ</Badge>
                  ) : (
                    <Badge tone="secondary">ผู้ใช้ทั่วไป</Badge>
                  )}
                </td>
                <td className="whitespace-nowrap">
                  {u.disabled ? (
                    <Badge tone="danger">ปิดใช้งาน</Badge>
                  ) : u.suspended ? (
                    <Badge tone="warning">ระงับธุรกรรม</Badge>
                  ) : (
                    <Badge tone="success">ใช้งานปกติ</Badge>
                  )}
                </td>
                <td>{u.isVerified ? <Badge tone="success">ยืนยันแล้ว</Badge> : <Badge tone="secondary">ยังไม่ยืนยัน</Badge>}</td>
                <td className="text-center">{holdings.get(u.id) || 0}/2</td>
                <td className="text-right font-mono whitespace-nowrap">{baht(u.balance)}</td>
                <td className="whitespace-nowrap text-[#6c757d]">
                  {u.payoutAccount ? `${u.payoutAccount.bankName || 'พร้อมเพย์'} · ${u.payoutAccount.accountNumber}` : '-'}
                </td>
                <td className="whitespace-nowrap text-[#6c757d]">{thaiDateTime(u.createdAt)}</td>
                <td className="whitespace-nowrap">
                  {isSelf ? (
                    <span className="text-[0.8rem] text-[#6c757d]">บัญชีของคุณ</span>
                  ) : u.superAdmin ? (
                    <span className="text-[0.8rem] text-[#6c757d]">-</span>
                  ) : (
                    <div className="flex flex-wrap gap-1">
                      <Button size="sm" tone={u.disabled ? 'success' : 'secondary'} onClick={() => toggleDisabled(u)}>
                        {u.disabled ? <Power className="w-3.5 h-3.5" /> : <PowerOff className="w-3.5 h-3.5" />}
                        {u.disabled ? 'เปิดใช้งาน' : 'ปิดใช้งาน'}
                      </Button>
                      {admin.superAdmin && (
                        <Button size="sm" tone={u.role === 'admin' ? 'warning' : 'primary'} onClick={() => toggleRole(u)}>
                          {u.role === 'admin' ? <UserMinus className="w-3.5 h-3.5" /> : <ShieldCheck className="w-3.5 h-3.5" />}
                          {u.role === 'admin' ? 'เป็นผู้ใช้ทั่วไป' : 'ตั้งเป็นแอดมิน'}
                        </Button>
                      )}
                      {!u.disabled && (
                        <Button size="sm" tone={u.suspended ? 'success' : 'danger'} onClick={() => toggleSuspend(u)}>
                          {u.suspended ? <Undo2 className="w-3.5 h-3.5" /> : <Ban className="w-3.5 h-3.5" />}
                          {u.suspended ? 'ยกเลิกระงับ' : 'ระงับธุรกรรม'}
                        </Button>
                      )}
                      {u.isVerified && (
                        <Button size="sm" tone="warning" onClick={() => revoke(u)}>
                          <ShieldOff className="w-3.5 h-3.5" /> เพิกถอน KYC
                        </Button>
                      )}
                    </div>
                  )}
                </td>
              </tr>
            )
          })}
        </DataTable>
      </Card>
    </>
  )
}
