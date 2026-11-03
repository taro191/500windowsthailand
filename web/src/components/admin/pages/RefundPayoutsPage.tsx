import { useCallback, useEffect, useState } from 'react'
import { Check, Undo2, Wallet } from 'lucide-react'
import type { RefundPayout } from '@shared/types'
import { decideRefundPayout, loadRefundPayouts } from '@/lib/adminApi'
import type { AdminPageProps } from '../adminData'
import { Badge, baht, Button, Callout, Card, DataTable, FormRow, inputClass, Modal, thaiDateTime } from '../ui'

const STATUS: Record<RefundPayout['status'], { label: string; tone: 'warning' | 'success' | 'secondary' }> = {
  pending: { label: 'รอโอน', tone: 'warning' },
  paid: { label: 'โอนแล้ว', tone: 'success' },
  returned: { label: 'คืนเข้ากระเป๋าแล้ว', tone: 'secondary' },
}

/** Window refunds the owner asked to receive in their bank account: transfer, then record the reference. */
export function RefundPayoutsPage({ notify, refresh }: AdminPageProps) {
  const [payouts, setPayouts] = useState<RefundPayout[] | null>(null)
  const [deciding, setDeciding] = useState<{ payout: RefundPayout; decision: 'paid' | 'returned'; note: string } | null>(null)
  const [busy, setBusy] = useState(false)

  const load = useCallback(async () => {
    const result = await loadRefundPayouts()
    if (!result.success) return notify(result.error, 'error')
    setPayouts(result.payouts)
  }, [notify])
  useEffect(() => {
    void load()
  }, [load])

  const decide = async () => {
    if (!deciding) return
    setBusy(true)
    const result = await decideRefundPayout(deciding.payout.id, deciding.decision, deciding.note)
    setBusy(false)
    if (!result.success) return notify(result.error, 'error')
    setPayouts(result.payouts)
    setDeciding(null)
    notify(deciding.decision === 'paid' ? 'บันทึกการโอนแล้ว' : 'คืนเงินเข้ากระเป๋าเงินของผู้ใช้แล้ว')
    void refresh()
  }

  return (
    <div className="max-w-6xl">
      <Callout tone="info">
        ผู้ใช้ขอคืนบานภายใน 15 วัน และเลือกรับเงินคืนทางบัญชีธนาคาร/พร้อมเพย์ · บานถูกคืนเข้าระบบแล้ว เหลือแค่โอนเงิน · โอนตามบัญชีในรายการ แล้วกด
        <b> โอนแล้ว</b> พร้อมเลขอ้างอิง · ถ้าโอนไม่ได้ (เช่น บัญชีผิด) กด <b>คืนเข้ากระเป๋า</b> แทน เงินจะเข้ากระเป๋าเงินของผู้ใช้ทันที
      </Callout>
      <Card title="คืนเงินเข้าบัญชี" icon={Undo2} outline="warning" flush>
        <DataTable head={['วันที่ขอ', 'ผู้ใช้', 'บาน', 'ยอด', 'บัญชีรับเงิน', 'สถานะ', '']} empty={payouts ? 'ยังไม่มีคำขอ' : 'กำลังโหลด…'}>
          {(payouts ?? []).map((p) => (
            <tr key={p.id}>
              <td className="whitespace-nowrap">{thaiDateTime(p.createdAt)}</td>
              <td>{p.userName}</td>
              <td>
                <span className="font-mono">{p.windowCode}</span>
                <div className="text-[0.8rem] text-[#6c757d]">{p.windowTitle}</div>
              </td>
              <td className="text-right font-mono font-bold">{baht(p.amount)}</td>
              <td className="text-[0.85rem]">
                {p.account.type === 'bank' ? p.account.bankName : 'พร้อมเพย์'} · <span className="font-mono">{p.account.accountNumber}</span>
                <div className="text-[#6c757d]">{p.account.accountName}</div>
              </td>
              <td>
                <Badge tone={STATUS[p.status].tone}>{STATUS[p.status].label}</Badge>
                {p.status !== 'pending' && (
                  <div className="text-[0.75rem] text-[#6c757d]">
                    {p.note} · {p.decidedBy} · {thaiDateTime(p.decidedAt)}
                  </div>
                )}
              </td>
              <td className="whitespace-nowrap">
                {p.status === 'pending' && (
                  <div className="flex gap-1">
                    <Button size="sm" tone="success" onClick={() => setDeciding({ payout: p, decision: 'paid', note: '' })}>
                      <Check className="w-3.5 h-3.5" /> โอนแล้ว
                    </Button>
                    <Button size="sm" tone="secondary" outline onClick={() => setDeciding({ payout: p, decision: 'returned', note: '' })}>
                      <Wallet className="w-3.5 h-3.5" /> คืนเข้ากระเป๋า
                    </Button>
                  </div>
                )}
              </td>
            </tr>
          ))}
        </DataTable>
      </Card>

      {deciding && (
        <Modal
          title={deciding.decision === 'paid' ? 'บันทึกการโอนเงินคืน' : 'คืนเงินเข้ากระเป๋าแทนการโอน'}
          icon={deciding.decision === 'paid' ? Check : Wallet}
          onClose={() => setDeciding(null)}
          footer={
            <Button tone={deciding.decision === 'paid' ? 'success' : 'primary'} disabled={busy || !deciding.note.trim()} onClick={decide}>
              ยืนยัน
            </Button>
          }
        >
          <p className="text-sm mb-3">
            {deciding.payout.userName} · {deciding.payout.windowCode} · <b>{baht(deciding.payout.amount)}</b>
          </p>
          <FormRow label={deciding.decision === 'paid' ? 'เลขอ้างอิงการโอน' : 'เหตุผล (ผู้ใช้จะเห็นในประวัติธุรกรรม)'}>
            <input value={deciding.note} maxLength={500} onChange={(e) => setDeciding({ ...deciding, note: e.target.value })} className={inputClass} />
          </FormRow>
        </Modal>
      )}
    </div>
  )
}
