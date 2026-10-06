import { useState } from 'react'
import { Check, FileCheck2, X } from 'lucide-react'
import type { PaymentOrder, PaymentOrderKind, PaymentOrderStatus } from '@shared/types'
import { decideOrder } from '@/lib/adminApi'
import type { AdminPageProps } from '../adminData'
import { Badge, baht, Button, Callout, Card, DataTable, thaiDateTime } from '../ui'

const STATUS_LABELS: Record<PaymentOrderStatus, string> = { pending: 'รอตรวจสลิป', approved: 'อนุมัติแล้ว', rejected: 'ไม่อนุมัติ' }
const KIND_LABELS: Record<PaymentOrderKind, string> = { topup: 'เติมเงิน', claim: 'จับจองบาน', resale: 'ซื้อต่อ', promo: 'โปรโมท' }

/**
 * Transfer slips waiting for an admin. Approving completes the purchase or top-up;
 * rejecting returns the wallet part and frees the held window.
 */
export function PaymentsPage({ data, refresh, notify }: AdminPageProps) {
  const [filter, setFilter] = useState<PaymentOrderStatus | 'all'>('pending')
  const [busyId, setBusyId] = useState<string | null>(null)
  const [preview, setPreview] = useState<PaymentOrder | null>(null)
  const orders = data.orders.filter((o) => (filter === 'all' || o.status === filter) && o.slipUrl)
  const count = (status: PaymentOrderStatus | 'all') => data.orders.filter((o) => o.slipUrl && (status === 'all' || o.status === status)).length

  const decide = async (order: PaymentOrder, decision: 'approved' | 'rejected') => {
    let note = ''
    if (decision === 'approved') {
      if (!window.confirm(`ยืนยันว่าได้รับเงิน ${baht(order.externalAmount)} ผ่าน ${order.channelName} จาก ${order.userName} แล้ว?`)) return
    } else {
      note = window.prompt(`เหตุผลที่ไม่อนุมัติสลิปของ ${order.userName} (ผู้ใช้จะเห็นข้อความนี้):`, 'ยอดเงินไม่ตรง / ไม่พบรายการโอน')?.trim() || ''
      if (!note) return
    }
    setBusyId(order.id)
    const result = await decideOrder(order.id, decision, note)
    setBusyId(null)
    if (!result.success) return notify(result.error, 'error')
    await refresh()
    notify(
      decision === 'approved'
        ? `อนุมัติแล้ว: ${order.label} (${order.userName})`
        : `ไม่อนุมัติ: ${order.label}${order.walletAmount > 0 ? ` · คืน ${baht(order.walletAmount)} เข้ากระเป๋าแล้ว` : ''}`,
    )
  }

  return (
    <>
      <Callout tone="warning" title="ตรวจสลิปก่อนอนุมัติทุกครั้ง">
        เปิดแอปธนาคาร/บัญชีรับเงินเพื่อยืนยันว่าได้รับยอดตรงตามสลิปจริง · <b>อนุมัติ</b> = ทำรายการให้เสร็จ (โอนสิทธิ์บาน / เติมเงิน /
        ยืนยันค่าโปรโมท) · <b>ไม่อนุมัติ</b> = คืนส่วนที่ตัดจากกระเป๋าและปล่อยบานที่จองไว้ (ยอดที่โอนเข้ามาจริงต้องโอนคืนเอง)
      </Callout>
      <Card
        title="ตรวจสลิปชำระเงิน"
        icon={FileCheck2}
        outline="warning"
        flush
        tools={
          <div className="flex gap-1">
            {(['pending', 'approved', 'rejected', 'all'] as const).map((s) => (
              <Button key={s} size="sm" tone="secondary" outline={filter !== s} onClick={() => setFilter(s)}>
                {s === 'all' ? 'ทั้งหมด' : STATUS_LABELS[s]} ({count(s)})
              </Button>
            ))}
          </div>
        }
      >
        <DataTable head={['ส่งเมื่อ', 'สลิป', 'ผู้ชำระ', 'รายการ', 'ยอดโอน', 'จากกระเป๋า', 'ช่องทาง / เลขที่', 'สถานะ', 'จัดการ']} empty="ไม่มีรายการในสถานะนี้">
          {orders.map((o) => (
            <tr key={o.id}>
              <td className="whitespace-nowrap">{thaiDateTime(o.createdAt)}</td>
              <td>
                <button type="button" onClick={() => setPreview(o)} className="block cursor-pointer" title="ดูสลิปขนาดใหญ่">
                  <img src={o.slipUrl} alt="สลิป" className="w-12 h-16 object-cover rounded border border-[#dee2e6]" />
                </button>
              </td>
              <td className="whitespace-nowrap">{o.userName}</td>
              <td className="whitespace-nowrap">
                <Badge tone="info">{KIND_LABELS[o.kind]}</Badge> {o.label}
              </td>
              <td className="text-right font-mono font-bold">{baht(o.externalAmount)}</td>
              <td className="text-right font-mono text-[#6c757d]">{o.walletAmount ? baht(o.walletAmount) : '-'}</td>
              <td className="whitespace-nowrap text-[#6c757d]">
                {o.channelName}
                <div className="font-mono text-[0.75rem]">{o.slipRef || '-'}</div>
              </td>
              <td>
                <Badge tone={o.status === 'approved' ? 'success' : o.status === 'rejected' ? 'danger' : 'warning'}>{STATUS_LABELS[o.status]}</Badge>
                {o.note && <div className="text-[0.75rem] text-[#6c757d] max-w-[12rem]">{o.note}</div>}
              </td>
              <td className="whitespace-nowrap">
                {o.status === 'pending' ? (
                  <div className="flex gap-1">
                    <Button size="sm" tone="success" disabled={busyId === o.id} onClick={() => decide(o, 'approved')}>
                      <Check className="w-3.5 h-3.5" /> อนุมัติ
                    </Button>
                    <Button size="sm" tone="danger" disabled={busyId === o.id} onClick={() => decide(o, 'rejected')}>
                      <X className="w-3.5 h-3.5" /> ไม่อนุมัติ
                    </Button>
                  </div>
                ) : (
                  <span className="text-[#6c757d] text-[0.8rem]">{thaiDateTime(o.decidedAt)}</span>
                )}
              </td>
            </tr>
          ))}
        </DataTable>
      </Card>

      {preview && (
        <Card
          title={`สลิป: ${preview.label} · ${preview.userName}`}
          outline="info"
          tools={
            <Button size="sm" tone="secondary" outline onClick={() => setPreview(null)}>
              ปิด
            </Button>
          }
        >
          <div className="flex flex-col md:flex-row gap-4 text-sm">
            <a href={preview.slipUrl} target="_blank" rel="noreferrer">
              <img src={preview.slipUrl} alt="สลิป" className="max-h-[70vh] rounded border border-[#dee2e6]" />
            </a>
            <div className="space-y-1">
              <p className="m-0">ยอดที่ต้องได้รับ: <b className="font-mono">{baht(preview.externalAmount)}</b></p>
              <p className="m-0">ช่องทาง: {preview.channelName}</p>
              <p className="m-0">เลขที่รายการ (ผู้ใช้กรอก): <span className="font-mono">{preview.slipRef || '-'}</span></p>
              <p className="m-0 text-[#6c757d]">เลขที่คำสั่งซื้อ: {preview.id}</p>
            </div>
          </div>
        </Card>
      )}
    </>
  )
}
