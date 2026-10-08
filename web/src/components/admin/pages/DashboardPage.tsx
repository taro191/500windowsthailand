import { ImageOff, LayoutGrid, Megaphone, Receipt, ShieldCheck, Tag, Users, Wallet } from 'lucide-react'
import { REGIONS } from '@shared/regions'
import { isPromoSlot } from '@/lib/promo'
import { RESALE_COMMISSION_RATE } from '@/lib/ownershipRules'
import type { AdminPage } from '../AdminLayout'
import type { AdminPageProps } from '../adminData'
import { Badge, baht, Card, DataTable, InfoBox, SmallBox, thaiDateTime } from '../ui'

export function DashboardPage({ data, onNavigate }: AdminPageProps & { onNavigate: (page: AdminPage) => void }) {
  const { users, windows, transactions, promoRequests } = data
  const members = users.filter((u) => u.role !== 'admin')
  const owned = windows.filter((w) => w.status !== 'available')
  const claims = transactions.filter((t) => t.type === 'claim')
  const resales = transactions.filter((t) => t.type === 'resale')
  const topups = transactions.filter((t) => t.type === 'topup')
  const claimRevenue = claims.reduce((s, t) => s + t.amount, 0)
  const editFees = transactions.filter((t) => t.type === 'edit_fee').reduce((s, t) => s + t.amount, 0)
  const commission = resales.reduce((s, t) => s + (t.commissionAmount ?? Math.round(t.amount * RESALE_COMMISSION_RATE)), 0)
  const pendingPromo = promoRequests.filter((r) => r.status === 'pending').length
  const promoRevenue = promoRequests.filter((r) => r.status === 'approved' && r.payment).reduce((s, r) => s + r.payment!.amount, 0)
  const pendingKyc = members.filter((u) => !u.isVerified).length

  return (
    <>
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4 mb-4">
        <SmallBox tone="info" value={members.length} label="สมาชิกทั้งหมด" icon={Users} onMore={() => onNavigate('users')} />
        <SmallBox tone="success" value={`${owned.length}/3,500`} label="บานที่มีเจ้าของ" icon={LayoutGrid} onMore={() => onNavigate('windows')} />
        <SmallBox tone="warning" value={baht(claimRevenue + commission + promoRevenue + editFees)} label="รายได้แพลตฟอร์ม" icon={Receipt} onMore={() => onNavigate('revenue')} />
        <SmallBox tone="danger" value={pendingPromo} label="คำขอโปรโมทรอตรวจ" icon={Megaphone} onMore={() => onNavigate('promo')} />
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4 mb-4">
        <InfoBox tone="primary" icon={ShieldCheck} label="ยังไม่ยืนยันตัวตน (KYC)" value={pendingKyc} />
        <InfoBox tone="success" icon={Wallet} label="ยอดเติมเงินรวม" value={baht(topups.reduce((s, t) => s + t.amount, 0))} />
        <InfoBox tone="warning" icon={Tag} label="เปิดขายต่อ" value={windows.filter((w) => w.status === 'for_resale').length} />
        <InfoBox tone="danger" icon={ImageOff} label="ถูกระงับบัญชี" value={members.filter((u) => u.suspended).length} />
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-4">
        <div className="xl:col-span-2">
          <Card title="ธุรกรรมล่าสุด" icon={Receipt} outline="primary" flush footer={<button type="button" onClick={() => onNavigate('transactions')} className="text-[#007bff] hover:underline cursor-pointer">ดูธุรกรรมทั้งหมด</button>}>
            <DataTable head={['เวลา', 'ประเภท', 'รายการ', 'ผู้ชำระ', 'ยอด']} empty="ยังไม่มีธุรกรรม">
              {transactions.slice(0, 8).map((t) => (
                <tr key={t.id}>
                  <td className="whitespace-nowrap">{thaiDateTime(t.date)}</td>
                  <td>
                    <TxBadge type={t.type} />
                  </td>
                  <td className="font-mono">{t.windowCode}</td>
                  <td>{t.toOwner}</td>
                  <td className="text-right font-mono">{baht(t.amount)}</td>
                </tr>
              ))}
            </DataTable>
          </Card>
        </div>
        <Card title="การถือครองแยกตามภูมิภาค" icon={LayoutGrid} outline="success">
          <div className="space-y-3">
            {REGIONS.map((region) => {
              const regionWindows = windows.filter((w) => w.region === region.id)
              const taken = regionWindows.filter((w) => w.status !== 'available').length
              const free = regionWindows.filter((w) => w.status === 'available' && !isPromoSlot(w.id)).length
              const percent = regionWindows.length ? (taken / regionWindows.length) * 100 : 0
              return (
                <div key={region.id}>
                  <div className="flex justify-between text-sm mb-1">
                    <span>
                      {region.icon} {region.name}
                    </span>
                    <span className="text-[#6c757d]">
                      <b className="text-[#212529]">{taken}</b> / ว่าง {free}
                    </span>
                  </div>
                  <div className="h-2 rounded bg-[#e9ecef] overflow-hidden">
                    <div className="h-full bg-[#28a745]" style={{ width: `${Math.max(percent, taken ? 1 : 0)}%` }} />
                  </div>
                </div>
              )
            })}
          </div>
        </Card>
      </div>
    </>
  )
}

export function TxBadge({ type }: { type: string }) {
  if (type === 'claim') return <Badge tone="info">จับจอง</Badge>
  if (type === 'resale') return <Badge tone="warning">ซื้อขายต่อ</Badge>
  if (type === 'topup') return <Badge tone="success">เติมเงิน</Badge>
  if (type === 'promo') return <Badge tone="danger">ค่าโปรโมท</Badge>
  if (type === 'refund') return <Badge tone="secondary">คืนเงิน</Badge>
  if (type === 'edit_fee') return <Badge tone="primary">ค่าแก้ไขบาน</Badge>
  if (type === 'bonus') return <Badge tone="success">โบนัสสมัครสมาชิก</Badge>
  return <Badge tone="secondary">{type}</Badge>
}
