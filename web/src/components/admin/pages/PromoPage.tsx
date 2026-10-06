import { useState } from 'react'
import { Check, Megaphone, X } from 'lucide-react'
import { decidePromoRequest } from '@/lib/adminApi'
import type { PromoRequest, PromoRequestStatus } from '@/lib/promo'
import type { AdminPageProps } from '../adminData'
import { Badge, baht, Button, Callout, Card, DataTable, thaiDateTime } from '../ui'

const STATUS_LABELS: Record<PromoRequestStatus, string> = { pending: 'รอตรวจสอบ', approved: 'อนุมัติแล้ว', rejected: 'ไม่อนุมัติ' }

function PromoStatus({ status }: { status: PromoRequestStatus }) {
  return <Badge tone={status === 'approved' ? 'success' : status === 'rejected' ? 'danger' : 'warning'}>{STATUS_LABELS[status]}</Badge>
}

export function PromoPage({ data, refresh, notify }: AdminPageProps) {
  const [filter, setFilter] = useState<PromoRequestStatus | 'all'>('pending')
  const [preview, setPreview] = useState<PromoRequest | null>(null)
  const users = new Map(data.users.map((u) => [u.id, u]))
  const requests = data.promoRequests.filter((r) => filter === 'all' || r.status === filter)

  const decide = async (request: PromoRequest, decision: 'approved' | 'rejected') => {
    let note = ''
    if (decision === 'rejected') {
      note =
        window
          .prompt(`ไม่อนุมัติ "${request.brand}"? ระบบจะคืนเงิน ${baht(request.payment?.amount || 0)} เข้ากระเป๋าของผู้ขอ · ระบุเหตุผล:`, 'เนื้อหาไม่เป็นไปตามเงื่อนไข')
          ?.trim() || ''
      if (!note) return
    }
    const result = await decidePromoRequest(request.id, decision, note)
    if (!result.success) return notify(result.error, 'error')
    await refresh()
    notify(
      decision === 'approved'
        ? `อนุมัติ "${request.brand}" แล้ว โฆษณาแสดงบนบาน 481–486`
        : `ไม่อนุมัติ "${request.brand}"${result.refunded ? ` · คืนเงิน ${baht(result.refunded)} เข้ากระเป๋าแล้ว` : ''}`,
    )
  }

  return (
    <>
      <Callout tone="info" title="พื้นที่โปรโมท บาน 481–486">
        ผู้ขอชำระเงินตอนส่งคำขอ · ถ้าชำระด้วยการโอน ต้องอนุมัติสลิปในเมนู "ตรวจสลิปชำระเงิน" ก่อน · <b>อนุมัติ</b> =
        โฆษณาขึ้นตารางทันทีและนับเป็นรายได้ · <b>ไม่อนุมัติ</b> = คืนเงินเต็มจำนวนเข้ากระเป๋าผู้ขอทันที
      </Callout>
      <Card
        title="คำขอโปรโมท"
        icon={Megaphone}
        outline="danger"
        flush
        tools={
          <div className="flex gap-1">
            {(['pending', 'approved', 'rejected', 'all'] as const).map((s) => (
              <Button key={s} size="sm" tone="secondary" outline={filter !== s} onClick={() => setFilter(s)}>
                {s === 'all' ? 'ทั้งหมด' : STATUS_LABELS[s]} ({s === 'all' ? data.promoRequests.length : data.promoRequests.filter((r) => r.status === s).length})
              </Button>
            ))}
          </div>
        }
      >
        <DataTable head={['ส่งเมื่อ', 'แบรนด์', 'ผู้ขอ', 'แพ็กเกจ', 'วันที่โปรโมท', 'ราคา', 'การชำระเงิน', 'สถานะ', 'จัดการ']} empty="ไม่มีคำขอในสถานะนี้">
          {requests.map((r) => (
            <tr key={r.id}>
              <td className="whitespace-nowrap">{thaiDateTime(r.createdAt)}</td>
              <td>
                <button type="button" onClick={() => setPreview(r)} className="text-[#007bff] hover:underline cursor-pointer text-left">
                  {r.brand}
                </button>
              </td>
              <td className="whitespace-nowrap">{users.get(r.userId)?.name || r.userId}</td>
              <td className="whitespace-nowrap">
                {r.size} บาน · {r.rounds ?? '-'} รอบ
              </td>
              <td className="whitespace-nowrap">{r.startDate || '-'}</td>
              <td className="text-right font-mono">{Number.isFinite(r.price) ? baht(r.price) : '-'}</td>
              <td className="whitespace-nowrap text-[#6c757d]">
                {r.refund ? (
                  <Badge tone="secondary">คืนเงินแล้ว {baht(r.refund.amount)}</Badge>
                ) : r.payment ? (
                  <>
                    {r.payment.orderStatus === 'pending' ? <Badge tone="warning">รอตรวจสลิป</Badge> : <Badge tone="success">ชำระแล้ว</Badge>}
                    <div className="text-[0.75rem]">
                      กระเป๋า {baht(r.payment.walletAmount)}
                      {r.payment.externalAmount > 0 && ` + ${r.payment.channelName} ${baht(r.payment.externalAmount)}`}
                    </div>
                  </>
                ) : (
                  <Badge tone="warning">ยังไม่ชำระ (คำขอเดิม)</Badge>
                )}
              </td>
              <td>
                <PromoStatus status={r.status} />
              </td>
              <td className="whitespace-nowrap">
                {r.status === 'pending' ? (
                  <div className="flex gap-1">
                    <Button size="sm" tone="success" onClick={() => decide(r, 'approved')}>
                      <Check className="w-3.5 h-3.5" /> อนุมัติ
                    </Button>
                    <Button size="sm" tone="danger" onClick={() => decide(r, 'rejected')}>
                      <X className="w-3.5 h-3.5" /> ไม่อนุมัติ{r.payment ? ' + คืนเงิน' : ''}
                    </Button>
                  </div>
                ) : (
                  <span className="text-[#6c757d] text-[0.8rem]">พิจารณาแล้ว</span>
                )}
              </td>
            </tr>
          ))}
        </DataTable>
      </Card>

      {preview && (
        <Card title={`รายละเอียด: ${preview.brand}`} outline="info" tools={<Button size="sm" tone="secondary" outline onClick={() => setPreview(null)}>ปิด</Button>}>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm">
            <div className="md:col-span-2 space-y-1">
              <p className="whitespace-pre-wrap m-0">{preview.tagline || '(ไม่มีข้อความ)'}</p>
              <p className="m-0 text-[#6c757d]">ลิงก์: {preview.link || '-'}</p>
              <p className="m-0 text-[#6c757d]">ติดต่อกลับ: {preview.contact || '-'}</p>
              <p className="m-0 text-[#6c757d]">เลขคำขอ: {preview.id}</p>
            </div>
            <div className="grid grid-cols-3 gap-2">
              {preview.images?.map((img, i) => (
                <img key={i} src={img} alt="" className="w-full aspect-square object-cover rounded border border-[#dee2e6]" />
              ))}
            </div>
          </div>
        </Card>
      )}
    </>
  )
}
