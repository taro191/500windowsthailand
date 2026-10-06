import { useMemo, useState } from 'react'
import { Ban, Search, ShieldOff, Undo2, Users } from 'lucide-react'
import type { User } from '@/types'
import { revokeKyc, setUserSuspended } from '@/lib/adminStore'
import { maskCitizenId, maskPhone } from '@/lib/identity'
import type { AdminPageProps } from '../adminData'
import { Badge, baht, Button, Card, DataTable, inputClass, thaiDateTime } from '../ui'

export function UsersPage({ admin, data, refresh, notify }: AdminPageProps) {
  const [query, setQuery] = useState('')
  const [kycFilter, setKycFilter] = useState<'all' | 'verified' | 'pending' | 'suspended'>('all')

  const holdings = useMemo(() => {
    const map = new Map<string, number>()
    data.windows.forEach((w) => w.ownerId && map.set(w.ownerId, (map.get(w.ownerId) || 0) + 1))
    return map
  }, [data.windows])

  const users = data.users.filter((u) => {
    const q = query.trim().toLowerCase()
    const matchesQuery = !q || u.name.toLowerCase().includes(q) || u.email.toLowerCase().includes(q) || u.phone.includes(q)
    const matchesFilter =
      kycFilter === 'all' ||
      (kycFilter === 'verified' && u.isVerified) ||
      (kycFilter === 'pending' && !u.isVerified) ||
      (kycFilter === 'suspended' && u.suspended)
    return matchesQuery && matchesFilter
  })

  const toggleSuspend = (u: User) => {
    if (!window.confirm(u.suspended ? `ยกเลิกการระงับบัญชี ${u.name}?` : `ระงับการทำธุรกรรมของ ${u.name}?`)) return
    setUserSuspended(admin, u.id, !u.suspended)
    refresh()
    notify(u.suspended ? `ยกเลิกการระงับ ${u.name} แล้ว` : `ระงับบัญชี ${u.name} แล้ว`)
  }
  const revoke = (u: User) => {
    if (!window.confirm(`เพิกถอนการยืนยันตัวตนของ ${u.name}? ผู้ใช้จะต้องยืนยันใหม่ก่อนซื้อขาย`)) return
    revokeKyc(admin, u.id)
    refresh()
    notify(`เพิกถอน KYC ของ ${u.name} แล้ว`)
  }

  return (
    <Card
      title={`ผู้ใช้งาน (${users.length})`}
      icon={Users}
      outline="info"
      flush
      tools={
        <div className="flex flex-wrap items-center gap-2">
          <select value={kycFilter} onChange={(e) => setKycFilter(e.target.value as typeof kycFilter)} className={`${inputClass} w-auto`}>
            <option value="all">ทั้งหมด</option>
            <option value="verified">ยืนยันตัวตนแล้ว</option>
            <option value="pending">ยังไม่ยืนยันตัวตน</option>
            <option value="suspended">ถูกระงับ</option>
          </select>
          <div className="relative">
            <Search className="absolute left-2 top-1/2 -translate-y-1/2 w-4 h-4 text-[#6c757d]" />
            <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="ชื่อ / อีเมล / เบอร์" className={`${inputClass} pl-8 w-48`} />
          </div>
        </div>
      }
    >
      <DataTable head={['ผู้ใช้', 'ติดต่อ', 'เลขบัตร (ปิดบัง)', 'KYC', 'ถือครอง', 'กระเป๋าเงิน', 'บัญชีรับเงิน', 'สมัครเมื่อ', 'จัดการ']}>
        {users.map((u) => (
          <tr key={u.id}>
            <td className="whitespace-nowrap">
              <div className="flex items-center gap-2">
                <img src={u.avatarUrl} alt="" className="w-8 h-8 rounded-full object-cover" />
                <div>
                  <div className="font-bold">{u.name}</div>
                  {u.role === 'admin' && <Badge tone="dark">ผู้ดูแลระบบ</Badge>}
                  {u.suspended && <Badge tone="danger">ถูกระงับ</Badge>}
                </div>
              </div>
            </td>
            <td className="whitespace-nowrap text-[#6c757d]">
              {u.email}
              <br />
              {maskPhone(u.phone) || '-'}
            </td>
            <td className="font-mono whitespace-nowrap">{maskCitizenId(u.citizenId) || '-'}</td>
            <td>{u.isVerified ? <Badge tone="success">ยืนยันแล้ว</Badge> : <Badge tone="secondary">ยังไม่ยืนยัน</Badge>}</td>
            <td className="text-center">{holdings.get(u.id) || 0}/2</td>
            <td className="text-right font-mono whitespace-nowrap">{baht(u.balance)}</td>
            <td className="whitespace-nowrap text-[#6c757d]">
              {u.payoutAccount ? `${u.payoutAccount.bankName || 'พร้อมเพย์'} · ${u.payoutAccount.accountNumber}` : '-'}
            </td>
            <td className="whitespace-nowrap text-[#6c757d]">{thaiDateTime(u.createdAt)}</td>
            <td className="whitespace-nowrap">
              {u.role !== 'admin' && (
                <div className="flex gap-1">
                  {u.isVerified && (
                    <Button size="sm" tone="warning" onClick={() => revoke(u)}>
                      <ShieldOff className="w-3.5 h-3.5" /> เพิกถอน KYC
                    </Button>
                  )}
                  <Button size="sm" tone={u.suspended ? 'success' : 'danger'} onClick={() => toggleSuspend(u)}>
                    {u.suspended ? <Undo2 className="w-3.5 h-3.5" /> : <Ban className="w-3.5 h-3.5" />}
                    {u.suspended ? 'ยกเลิกระงับ' : 'ระงับ'}
                  </Button>
                </div>
              )}
            </td>
          </tr>
        ))}
      </DataTable>
    </Card>
  )
}
