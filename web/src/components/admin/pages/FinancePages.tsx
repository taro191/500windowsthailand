import { useMemo, useState } from 'react'
import { ChartColumn, Download, HandCoins, History, Receipt, Wallet } from 'lucide-react'
import type { Transaction, TransactionType } from '@shared/types'
import { RESALE_COMMISSION_RATE } from '@/lib/ownershipRules'
import type { AdminPageProps } from '../adminData'
import { TxBadge } from './DashboardPage'
import { BackendNotice, Badge, baht, Button, Card, DataTable, InfoBox, inputClass, thaiDateTime } from '../ui'

const commissionOf = (t: Transaction) => t.commissionAmount ?? Math.round(t.amount * RESALE_COMMISSION_RATE)

function downloadCsv(filename: string, rows: (string | number)[][]) {
  const csv = rows.map((r) => r.map((cell) => `"${String(cell ?? '').replace(/"/g, '""')}"`).join(',')).join('\n')
  // BOM so Excel opens Thai text correctly.
  const blob = new Blob(['﻿' + csv], { type: 'text/csv;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = filename
  link.click()
  URL.revokeObjectURL(url)
}

function SlipLink({ tx }: { tx: Transaction }) {
  if (!tx.slipRef) return <span className="text-[#6c757d]">-</span>
  return tx.slipUrl ? (
    <a href={tx.slipUrl} target="_blank" rel="noreferrer" className="text-[#007bff] hover:underline font-mono">
      {tx.slipRef}
    </a>
  ) : (
    <span className="font-mono">{tx.slipRef}</span>
  )
}

function paymentLabel(t: Transaction) {
  const parts: string[] = []
  if (t.walletAmount) parts.push(`กระเป๋า ${baht(t.walletAmount)}`)
  if (t.externalAmount) parts.push(`${t.channelName || 'ช่องทางอื่น'} ${baht(t.externalAmount)}`)
  return parts.join(' + ') || '-'
}

export function TransactionsPage({ data }: AdminPageProps) {
  const [type, setType] = useState<TransactionType | 'all'>('all')
  const rows = data.transactions.filter((t) => type === 'all' || t.type === type)

  const exportCsv = () =>
    downloadCsv('transactions.csv', [
      ['วันที่', 'ประเภท', 'รหัส', 'รายการ', 'จาก', 'ถึง', 'ยอด', 'กระเป๋า', 'ช่องทางอื่น', 'ช่องทาง', 'ค่าคอม', 'สลิป'],
      ...rows.map((t) => [
        t.date,
        t.type,
        t.windowCode,
        t.windowTitle,
        t.fromOwner,
        t.toOwner,
        t.amount,
        t.walletAmount ?? '',
        t.externalAmount ?? '',
        t.channelName ?? '',
        t.type === 'resale' ? commissionOf(t) : '',
        t.slipRef ?? '',
      ]),
    ])

  return (
    <Card
      title={`ธุรกรรม (${rows.length})`}
      icon={Receipt}
      outline="primary"
      flush
      tools={
        <>
          <select value={type} onChange={(e) => setType(e.target.value as TransactionType | 'all')} className={`${inputClass} w-auto`}>
            <option value="all">ทุกประเภท</option>
            <option value="claim">จับจอง</option>
            <option value="resale">ซื้อขายต่อ</option>
            <option value="topup">เติมเงิน</option>
            <option value="promo">ค่าโปรโมท</option>
            <option value="refund">คืนเงิน</option>
          </select>
          <Button size="sm" tone="success" onClick={exportCsv} disabled={rows.length === 0}>
            <Download className="w-3.5 h-3.5" /> CSV
          </Button>
        </>
      }
    >
      <DataTable head={['วันที่', 'ประเภท', 'รหัส', 'จาก → ถึง', 'ยอด', 'การชำระ', 'ค่าคอม 5%', 'สลิป/อ้างอิง']} empty="ยังไม่มีธุรกรรม">
        {rows.map((t) => (
          <tr key={t.id}>
            <td className="whitespace-nowrap">{thaiDateTime(t.date)}</td>
            <td>
              <TxBadge type={t.type} />
            </td>
            <td className="font-mono whitespace-nowrap">{t.windowCode}</td>
            <td className="min-w-[200px]">
              {t.fromOwner} → {t.toOwner}
            </td>
            <td className="text-right font-mono whitespace-nowrap">{baht(t.amount)}</td>
            <td className="whitespace-nowrap text-[#6c757d]">{paymentLabel(t)}</td>
            <td className="text-right font-mono">{t.type === 'resale' ? baht(commissionOf(t)) : '-'}</td>
            <td className="whitespace-nowrap">
              <SlipLink tx={t} />
            </td>
          </tr>
        ))}
      </DataTable>
    </Card>
  )
}

export function TopUpsPage({ data }: AdminPageProps) {
  const topups = data.transactions.filter((t) => t.type === 'topup')
  const byChannel = useMemo(() => {
    const map = new Map<string, number>()
    topups.forEach((t) => map.set(t.channelName || '-', (map.get(t.channelName || '-') || 0) + t.amount))
    return [...map.entries()]
  }, [topups])
  const total = topups.reduce((s, t) => s + t.amount, 0)
  const walletTotal = data.users.reduce((s, u) => s + u.balance, 0)

  return (
    <>
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-4">
        <InfoBox tone="success" icon={Wallet} label="ยอดเติมเงินรวม" value={baht(total)} />
        <InfoBox tone="info" icon={Receipt} label="จำนวนครั้งที่เติม" value={topups.length} />
        <InfoBox tone="warning" icon={HandCoins} label="ยอดคงเหลือในกระเป๋าทุกบัญชี" value={baht(walletTotal)} />
      </div>
      <div className="grid grid-cols-1 xl:grid-cols-3 gap-4">
        <div className="xl:col-span-2">
          <Card title="รายการเติมเงิน" icon={Wallet} outline="success" flush>
            <DataTable head={['วันที่', 'ผู้ใช้', 'ช่องทาง', 'ยอด', 'สลิป/อ้างอิง', 'สถานะ']} empty="ยังไม่มีการเติมเงิน">
              {topups.map((t) => (
                <tr key={t.id}>
                  <td className="whitespace-nowrap">{thaiDateTime(t.date)}</td>
                  <td>{t.toOwner}</td>
                  <td>{t.channelName}</td>
                  <td className="text-right font-mono">{baht(t.amount)}</td>
                  <td>
                    <SlipLink tx={t} />
                  </td>
                  <td>
                    <Badge tone="success">อนุมัติแล้ว</Badge>
                  </td>
                </tr>
              ))}
            </DataTable>
          </Card>
        </div>
        <Card title="แยกตามช่องทาง" icon={ChartColumn} outline="info">
          {byChannel.length === 0 ? (
            <p className="text-sm text-[#6c757d] m-0">ยังไม่มีข้อมูล</p>
          ) : (
            <ul className="space-y-2 text-sm">
              {byChannel.map(([channel, amount]) => (
                <li key={channel} className="flex justify-between border-b border-[#dee2e6] pb-1">
                  <span>{channel}</span>
                  <b className="font-mono">{baht(amount)}</b>
                </li>
              ))}
            </ul>
          )}
        </Card>
      </div>
      <BackendNotice>
        ตอนนี้สลิปทุกใบถูกอนุมัติอัตโนมัติ (จำลอง) เมื่อมีระบบจริง ควรตรวจสลิปผ่าน API ธนาคาร/บริการตรวจสลิป
        และให้รายการที่ตรวจไม่ผ่านเข้าคิว "รอตรวจ" ในหน้านี้
      </BackendNotice>
    </>
  )
}

export function PayoutsPage({ data }: AdminPageProps) {
  const users = new Map(data.users.map((u) => [u.id, u]))
  const sales = data.transactions.filter((t) => t.type === 'resale')

  return (
    <>
      <BackendNotice>
        ตอนนี้เงินสุทธิ 95% จากการขายต่อจะเข้ากระเป๋าเงินของผู้ขายทันที การโอนออกไปยังบัญชีธนาคาร/พร้อมเพย์ของผู้ขายจริง
        ต้องใช้ระบบโอนเงินอัตโนมัติ (Payout API) หรือให้ทีมบัญชีโอนเองแล้วบันทึกในหน้านี้
      </BackendNotice>
      <Card title={`รายการที่ต้องจ่ายผู้ขาย (${sales.length})`} icon={HandCoins} outline="warning" flush>
        <DataTable head={['วันที่ขาย', 'บาน', 'ผู้ขาย', 'ราคาขาย', 'ค่าคอม', 'ผู้ขายได้รับ (95%)', 'บัญชีรับเงิน', 'สถานะ']} empty="ยังไม่มีการขายต่อ">
          {sales.map((t) => {
            const seller = t.fromOwnerId ? users.get(t.fromOwnerId) : undefined
            const account = seller?.payoutAccount
            return (
              <tr key={t.id}>
                <td className="whitespace-nowrap">{thaiDateTime(t.date)}</td>
                <td className="font-mono">{t.windowCode}</td>
                <td>{t.fromOwner}</td>
                <td className="text-right font-mono">{baht(t.amount)}</td>
                <td className="text-right font-mono">{baht(commissionOf(t))}</td>
                <td className="text-right font-mono font-bold">{baht(t.netSellerAmount ?? t.amount - commissionOf(t))}</td>
                <td className="whitespace-nowrap text-[#6c757d]">
                  {account ? `${account.bankName || 'พร้อมเพย์'} · ${account.accountNumber}` : <Badge tone="danger">ยังไม่ตั้งบัญชี</Badge>}
                </td>
                <td>
                  <Badge tone="info">เข้ากระเป๋าแล้ว</Badge>
                </td>
              </tr>
            )
          })}
        </DataTable>
      </Card>
    </>
  )
}

export function RevenuePage({ data }: AdminPageProps) {
  const months = useMemo(() => {
    const map = new Map<string, { claim: number; commission: number; topup: number }>()
    data.transactions.forEach((t) => {
      const key = t.date.slice(0, 7)
      const row = map.get(key) || { claim: 0, commission: 0, topup: 0 }
      if (t.type === 'claim') row.claim += t.amount
      if (t.type === 'resale') row.commission += commissionOf(t)
      if (t.type === 'topup') row.topup += t.amount
      map.set(key, row)
    })
    return [...map.entries()].sort(([a], [b]) => b.localeCompare(a))
  }, [data.transactions])
  const claimTotal = months.reduce((s, [, r]) => s + r.claim, 0)
  const commissionTotal = months.reduce((s, [, r]) => s + r.commission, 0)
  const promoRevenue = data.promoRequests.filter((r) => r.status === 'approved' && r.payment).reduce((s, r) => s + r.payment!.amount, 0)
  const promoHeld = data.promoRequests.filter((r) => r.status === 'pending' && r.payment).reduce((s, r) => s + r.payment!.amount, 0)
  const promoRefunded = data.promoRequests.reduce((s, r) => s + (r.refund?.amount || 0), 0)
  const maxBar = Math.max(1, ...months.map(([, r]) => r.claim + r.commission))

  return (
    <>
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4 mb-4">
        <InfoBox tone="info" icon={Receipt} label="ค่าจับจองบาน" value={baht(claimTotal)} />
        <InfoBox tone="warning" icon={HandCoins} label="ค่าคอมมิชชั่นขายต่อ 5%" value={baht(commissionTotal)} />
        <InfoBox tone="success" icon={ChartColumn} label="ค่าโปรโมท (อนุมัติแล้ว)" value={baht(promoRevenue)} />
        <InfoBox tone="secondary" icon={History} label={`ค่าโปรโมทรอพิจารณา (คืนไปแล้ว ${baht(promoRefunded)})`} value={baht(promoHeld)} />
      </div>
      <Card title="รายได้รายเดือน" icon={ChartColumn} outline="success" flush>
        <DataTable head={['เดือน', 'ค่าจับจอง', 'ค่าคอม 5%', 'รวมรายได้', '', 'เงินเติมเข้ากระเป๋า']} empty="ยังไม่มีรายได้">
          {months.map(([month, r]) => (
            <tr key={month}>
              <td className="font-mono">{month}</td>
              <td className="text-right font-mono">{baht(r.claim)}</td>
              <td className="text-right font-mono">{baht(r.commission)}</td>
              <td className="text-right font-mono font-bold">{baht(r.claim + r.commission)}</td>
              <td className="w-1/4">
                <div className="h-2 rounded bg-[#e9ecef] overflow-hidden">
                  <div className="h-full bg-[#28a745]" style={{ width: `${((r.claim + r.commission) / maxBar) * 100}%` }} />
                </div>
              </td>
              <td className="text-right font-mono text-[#6c757d]">{baht(r.topup)}</td>
            </tr>
          ))}
        </DataTable>
      </Card>
      <p className="text-sm text-[#6c757d]">
        * ตารางรายเดือนนับเฉพาะค่าจับจองและค่าคอม · ค่าโปรโมทนับเป็นรายได้เมื่ออนุมัติ ระหว่างรอพิจารณาเป็นเงินที่ถือไว้ (อาจต้องคืน) ·
        เงินเติมเข้ากระเป๋าเป็นเงินของผู้ใช้ (หนี้สินของแพลตฟอร์ม) ไม่นับเป็นรายได้
      </p>
    </>
  )
}

export function AuditPage({ data }: AdminPageProps) {
  return (
    <Card title={`บันทึกการใช้งานของผู้ดูแลระบบ (${data.auditLog.length})`} icon={History} outline="secondary" flush>
      <DataTable head={['เวลา', 'ผู้ดูแล', 'การกระทำ', 'รายละเอียด']} empty="ยังไม่มีการเปลี่ยนแปลง">
        {data.auditLog.map((e) => (
          <tr key={e.id}>
            <td className="whitespace-nowrap">{thaiDateTime(e.at)}</td>
            <td className="whitespace-nowrap">{e.adminName}</td>
            <td className="whitespace-nowrap">
              <Badge tone="primary">{e.action}</Badge>
            </td>
            <td>{e.detail}</td>
          </tr>
        ))}
      </DataTable>
    </Card>
  )
}
